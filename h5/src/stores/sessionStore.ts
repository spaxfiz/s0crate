import { create } from 'zustand'
import type {
  ChatMessage,
  LearningPhase,
  LearningSession,
  SSEChunk,
  SessionSummary,
} from '../lib/types'
import { api } from '../lib/api'

interface SessionState {
  sessions: SessionSummary[]
  current: LearningSession | null
  isStreaming: boolean
  streamContent: string
  syllabusStatus: string | null
  syllabusRetrying: boolean
  errorMessage: string | null
  noticeMessage: string | null
  abortController: AbortController | null
  forkExcerpt: string | null
  forkHistory: ChatMessage[]
  forkIsStreaming: boolean
  forkStreamContent: string

  loadSessions: () => Promise<void>
  createSession: (question: string) => Promise<LearningSession>
  loadSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  sendMessage: (message: string) => Promise<void>
  startSession: () => Promise<void>
  createSummary: () => Promise<void>
  navigateToNode: (nodeId: string) => Promise<void>
  navigateBack: () => Promise<void>
  navigateOverview: () => Promise<void>
  navigateNext: () => Promise<void>
  setForkExcerpt: (text: string) => void
  sendForkMessage: (message: string) => Promise<void>
  clearFork: () => void
  abortStreaming: () => void
  clearError: () => void
  clearCurrent: () => void
}

async function* readSSEStream(response: Response): AsyncGenerator<SSEChunk> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ${text}`)
  }

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = 'message'
  let dataLines: string[] = []

  const emit = function* (): Generator<SSEChunk> {
    if (dataLines.length === 0) return
    const raw = dataLines.join('\n')
    dataLines = []
    eventType = 'message'
    try {
      yield JSON.parse(raw) as SSEChunk
    } catch (error) {
      console.error('Invalid SSE payload:', eventType, raw, error)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      for (const chunk of emit()) yield chunk
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trimEnd()
      if (trimmed === '') {
        for (const chunk of emit()) yield chunk
        continue
      }
      if (trimmed.startsWith('event: ')) {
        eventType = trimmed.slice(7)
      } else if (trimmed.startsWith('data: ')) {
        dataLines.push(trimmed.slice(6))
      }
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function refreshCurrent(set: (partial: Partial<SessionState>) => void, current: LearningSession | null) {
  if (!current) return
  const session = await api.getSession(current.id)
  set({ current: session })
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  current: null,
  isStreaming: false,
  streamContent: '',
  syllabusStatus: null,
  syllabusRetrying: false,
  errorMessage: null,
  noticeMessage: null,
  abortController: null,
  forkExcerpt: null,
  forkHistory: [],
  forkIsStreaming: false,
  forkStreamContent: '',

  loadSessions: async () => {
    const sessions = await api.listSessions()
    set({ sessions })
  },

  createSession: async (question: string) => {
    const session = await api.createSession(question, 'fast')
    set({ current: session, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false, forkExcerpt: null, forkHistory: [], forkIsStreaming: false, forkStreamContent: '' })
    void get().loadSessions()
    void get().startSession()
    return session
  },

  loadSession: async (id: string) => {
    const session = await api.getSession(id)
    set({ current: session, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false, forkExcerpt: null, forkHistory: [], forkIsStreaming: false, forkStreamContent: '' })
  },

  deleteSession: async (id: string) => {
    await api.deleteSession(id)
    const { current } = get()
    if (current?.id === id) set({ current: null, forkExcerpt: null, forkHistory: [], forkIsStreaming: false, forkStreamContent: '' })
    void get().loadSessions()
  },

  startSession: async () => {
    const { current } = get()
    if (!current) return

    const controller = new AbortController()
    set({
      isStreaming: true,
      streamContent: '',
      syllabusStatus: null,
      syllabusRetrying: false,
      errorMessage: null,
      noticeMessage: null,
      abortController: controller,
    })

    try {
      const response = await api.startSession(current.id, controller.signal)
      let fullContent = ''
      let hasError = false
      let phaseChanged = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          fullContent += data.content
          set({ streamContent: fullContent })
        } else if (data.type === 'phase_change') {
          phaseChanged = true
          const active = get().current
          if (active) set({ current: { ...active, phase: data.content as LearningPhase } })
        } else if (data.type === 'done') {
          if (!phaseChanged && data.content) {
            const aiMsg: ChatMessage = {
              role: 'assistant',
              content: data.content,
              timestamp: new Date().toISOString(),
              nodeId: get().current?.currentNodeId ?? null,
              options: data.options?.length ? data.options : null,
            }
            const active = get().current
            if (active) set({ current: { ...active, messages: [...active.messages, aiMsg] } })
          }
        } else if (data.type === 'syllabus_update') {
          set({ syllabusStatus: '大纲通过校验，正在展开第一节…', syllabusRetrying: false, noticeMessage: null })
          await refreshCurrent(set, get().current)
        } else if (data.type === 'syllabus_retry') {
          set({ syllabusStatus: data.content, syllabusRetrying: true, noticeMessage: data.content })
        } else if (data.type === 'syllabus_review') {
          set({ syllabusStatus: data.content, syllabusRetrying: false, noticeMessage: null })
        } else if (data.type === 'error') {
          hasError = true
          set({ errorMessage: data.content })
        }
      }

      if (!hasError) {
        await refreshCurrent(set, get().current)
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        set({ noticeMessage: '已停止生成' })
      } else {
        console.error('Start session error:', error)
        set({ errorMessage: errorText(error) })
      }
    } finally {
      set({ isStreaming: false, streamContent: '', syllabusStatus: null, syllabusRetrying: false, abortController: null })
      try {
        await refreshCurrent(set, get().current)
        set({ errorMessage: null })
      } catch { /* best effort */ }
    }
  },

  sendMessage: async (message: string) => {
    const { current } = get()
    if (!current) return

    const controller = new AbortController()
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      nodeId: current.currentNodeId,
      options: null,
    }

    set({
      current: { ...current, messages: [...current.messages, userMsg] },
      isStreaming: true,
      streamContent: '',
      syllabusStatus: null,
      syllabusRetrying: false,
      errorMessage: null,
      noticeMessage: null,
      abortController: controller,
    })

    try {
      const response = await api.chat(current.id, message, controller.signal)
      let fullContent = ''
      let hasError = false
      let phaseChanged = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          fullContent += data.content
          set({ streamContent: fullContent })
        } else if (data.type === 'phase_change') {
          phaseChanged = true
          const active = get().current
          if (active) set({ current: { ...active, phase: data.content as LearningPhase } })
        } else if (data.type === 'done') {
          // Commit the AI message immediately so content doesn't vanish while
          // waiting for refreshCurrent. Skip when a phase_change happened —
          // that means syllabus generation ran and refreshCurrent will reconcile.
          if (!phaseChanged && data.content) {
            const aiMsg: ChatMessage = {
              role: 'assistant',
              content: data.content,
              timestamp: new Date().toISOString(),
              nodeId: get().current?.currentNodeId ?? null,
              options: data.options?.length ? data.options : null,
            }
            const active = get().current
            if (active) set({ current: { ...active, messages: [...active.messages, aiMsg] } })
          }
        } else if (data.type === 'syllabus_update') {
          set({ syllabusStatus: '大纲通过校验，正在展开第一节…', syllabusRetrying: false, noticeMessage: null })
          await refreshCurrent(set, get().current)
        } else if (data.type === 'syllabus_retry') {
          set({ syllabusStatus: data.content, syllabusRetrying: true, noticeMessage: data.content })
        } else if (data.type === 'syllabus_review') {
          set({ syllabusStatus: data.content, syllabusRetrying: false, noticeMessage: null })
        } else if (data.type === 'next_unavailable') {
          set({ noticeMessage: data.content })
        } else if (data.type === 'navigate_to_next') {
          await get().navigateNext()
        } else if (data.type === 'error') {
          hasError = true
          set({ errorMessage: data.content })
        }
      }

      if (!hasError) {
        await refreshCurrent(set, get().current)
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        set({ noticeMessage: '已停止生成' })
      } else {
        console.error('Chat error:', error)
        set({ errorMessage: errorText(error) })
      }
    } finally {
      set({ isStreaming: false, streamContent: '', syllabusStatus: null, syllabusRetrying: false, abortController: null })
      try {
        await refreshCurrent(set, get().current)
        set({ errorMessage: null })
      } catch { /* best effort */ }
    }
  },

  createSummary: async () => {
    const { current } = get()
    if (!current) return

    const controller = new AbortController()
    set({ isStreaming: true, streamContent: '', errorMessage: null, noticeMessage: null, abortController: controller })

    try {
      const response = await api.createSummary(current.id, controller.signal)
      let fullContent = ''
      let hasError = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          fullContent += data.content
          set({ streamContent: fullContent })
        } else if (data.type === 'phase_change') {
          const active = get().current
          if (active) set({ current: { ...active, phase: data.content as LearningPhase } })
        } else if (data.type === 'navigate_to_next') {
          await get().navigateNext()
        } else if (data.type === 'error') {
          hasError = true
          set({ errorMessage: data.content })
        }
      }

      if (!hasError) {
        await refreshCurrent(set, get().current)
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        set({ noticeMessage: '已停止生成' })
      } else {
        console.error('Summary error:', error)
        set({ errorMessage: errorText(error) })
      }
    } finally {
      set({ isStreaming: false, streamContent: '', abortController: null })
      try {
        await refreshCurrent(set, get().current)
        set({ errorMessage: null })
      } catch { /* best effort */ }
    }
  },

  navigateToNode: async (nodeId: string) => {
    const { current } = get()
    if (!current) return
    const result = await api.navigate(current.id, nodeId)
    set({
      current: {
        ...current,
        currentNodeId: result.currentNodeId,
        phase: result.phase,
        breadcrumb: result.breadcrumb,
        messages: result.messages,
      },
      errorMessage: null,
      noticeMessage: null,
    })
  },

  navigateBack: async () => {
    const { current } = get()
    if (!current) return
    const result = await api.navigateBack(current.id)
    set({
      current: {
        ...current,
        currentNodeId: result.currentNodeId,
        phase: result.phase,
        breadcrumb: result.breadcrumb,
        messages: result.messages,
      },
    })
  },

  navigateOverview: async () => {
    const { current } = get()
    if (!current) return
    const result = await api.navigateOverview(current.id)
    set({
      current: {
        ...current,
        currentNodeId: result.currentNodeId,
        phase: result.phase,
        breadcrumb: result.breadcrumb,
        messages: result.messages,
      },
    })
  },

  navigateNext: async () => {
    const { current } = get()
    if (!current) return
    const result = await api.navigateNext(current.id)
    set({
      current: {
        ...current,
        currentNodeId: result.currentNodeId,
        phase: result.phase,
        breadcrumb: result.breadcrumb,
        messages: result.messages,
      },
      noticeMessage: result.hasNext === false ? '已经到达当前层级的最后一节' : null,
    })
    await refreshCurrent(set, get().current)
  },

  setForkExcerpt: (text: string) => {
    set({
      forkExcerpt: text,
      forkHistory: [],
      forkIsStreaming: false,
      forkStreamContent: '',
      errorMessage: null,
      noticeMessage: null,
    })
  },

  sendForkMessage: async (message: string) => {
    const { current, forkExcerpt, forkHistory } = get()
    const trimmed = message.trim()
    if (!current || !forkExcerpt || !trimmed) return

    const controller = new AbortController()
    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      nodeId: current.currentNodeId,
      options: null,
    }
    const historyBeforeSend = forkHistory

    set({
      forkHistory: [...historyBeforeSend, userMsg],
      forkIsStreaming: true,
      forkStreamContent: '',
      errorMessage: null,
      noticeMessage: null,
      abortController: controller,
    })

    try {
      const response = await api.forkChat(current.id, {
        excerpt: forkExcerpt,
        message: trimmed,
        history: historyBeforeSend.map(({ role, content }) => ({ role, content })),
      }, controller.signal)
      let fullContent = ''

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          fullContent += data.content
          set({ forkStreamContent: fullContent })
        } else if (data.type === 'done') {
          const aiMsg: ChatMessage = {
            role: 'assistant',
            content: data.content,
            timestamp: new Date().toISOString(),
            nodeId: get().current?.currentNodeId ?? null,
            options: data.options?.length ? data.options : null,
          }
          set({ forkHistory: [...get().forkHistory, aiMsg] })
        } else if (data.type === 'error') {
          set({ errorMessage: data.content })
        }
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        set({ noticeMessage: '已停止生成' })
      } else {
        console.error('Fork chat error:', error)
        set({ errorMessage: errorText(error) })
      }
    } finally {
      set({ forkIsStreaming: false, forkStreamContent: '', abortController: null })
    }
  },

  clearFork: () => set({ forkExcerpt: null, forkHistory: [], forkIsStreaming: false, forkStreamContent: '' }),

  abortStreaming: () => {
    get().abortController?.abort()
  },

  clearError: () => set({ errorMessage: null, noticeMessage: null }),

  clearCurrent: () => set({ current: null, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false, forkExcerpt: null, forkHistory: [], forkIsStreaming: false, forkStreamContent: '' }),
}))
