import { create } from 'zustand'
import type {
  ChatMessage,
  LearningPhase,
  LearningSession,
  SSEChunk,
  SessionSummary,
} from '../lib/types'
import { api } from '../lib/api'

const STREAM_FLUSH_INTERVAL_MS = 50

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

  loadSessions: () => Promise<void>
  createSession: (question: string, modelTier?: 'fast' | 'pro') => Promise<LearningSession>
  loadSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  sendMessage: (message: string) => Promise<void>
  startSession: () => Promise<void>
  createSummary: () => Promise<void>
  navigateToNode: (nodeId: string) => Promise<void>
  navigateBack: () => Promise<void>
  navigateOverview: () => Promise<void>
  navigateNext: () => Promise<void>
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

function createStreamContentBuffer(set: (partial: Partial<SessionState>) => void) {
  let fullContent = ''
  let flushedContent = ''
  let timer: number | null = null

  const flush = () => {
    timer = null
    if (flushedContent === fullContent) return
    flushedContent = fullContent
    set({ streamContent: flushedContent })
  }

  return {
    append(content: string) {
      fullContent += content
      if (timer !== null) return
      timer = window.setTimeout(flush, STREAM_FLUSH_INTERVAL_MS)
    },
    flush() {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      flush()
    },
  }
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

  loadSessions: async () => {
    const sessions = await api.listSessions()
    set({ sessions })
  },

  createSession: async (question: string, modelTier: 'fast' | 'pro' = 'fast') => {
    const session = await api.createSession(question, modelTier)
    set({ current: session, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false })
    void get().loadSessions()
    void get().startSession()
    return session
  },

  loadSession: async (id: string) => {
    const session = await api.getSession(id)
    set({ current: session, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false })
  },

  deleteSession: async (id: string) => {
    await api.deleteSession(id)
    const { current } = get()
    if (current?.id === id) set({ current: null })
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
    const streamBuffer = createStreamContentBuffer(set)

    try {
      const response = await api.startSession(current.id, controller.signal)
      let hasError = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          streamBuffer.append(data.content)
        } else if (data.type === 'phase_change') {
          const active = get().current
          if (active) set({ current: { ...active, phase: data.content as LearningPhase } })
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
      streamBuffer.flush()
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
    const streamBuffer = createStreamContentBuffer(set)

    try {
      const response = await api.chat(current.id, message, controller.signal)
      let hasError = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          streamBuffer.append(data.content)
        } else if (data.type === 'phase_change') {
          const active = get().current
          if (active) set({ current: { ...active, phase: data.content as LearningPhase } })
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
      streamBuffer.flush()
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
    const streamBuffer = createStreamContentBuffer(set)

    try {
      const response = await api.createSummary(current.id, controller.signal)
      let hasError = false

      for await (const data of readSSEStream(response)) {
        if (data.type === 'token') {
          streamBuffer.append(data.content)
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
      streamBuffer.flush()
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

  abortStreaming: () => {
    get().abortController?.abort()
  },

  clearError: () => set({ errorMessage: null, noticeMessage: null }),

  clearCurrent: () => set({ current: null, errorMessage: null, noticeMessage: null, syllabusStatus: null, syllabusRetrying: false }),
}))
