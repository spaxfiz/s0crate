export type LearningPhase = 'questioning' | 'syllabus' | 'deep_dive' | 'summarization'
export type NodeStatus = 'pending' | 'in_progress' | 'completed'

export interface ChatOption {
  label: string
  value: string
  type: 'default' | 'custom'
}

export interface SyllabusNode {
  id: string
  title: string
  description: string
  num: string
  depth: number
  order: number
  status: NodeStatus
  children: SyllabusNode[]
  filePath: string | null
  conversationHistory: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  nodeId: string | null
  options: ChatOption[] | null
}

export interface LearningSession {
  id: string
  name: string
  slug: string
  originalQuestion: string
  createdAt: string
  updatedAt: string
  phase: LearningPhase
  modelTier: 'fast' | 'pro'
  syllabus: SyllabusNode | null
  currentNodeId: string | null
  contextSummary: string
  breadcrumb: { id: string; title: string }[]
  progress: [number, number]
  messages: ChatMessage[]
}

export interface SessionSummary {
  id: string
  name: string
  originalQuestion: string
  createdAt: string
  updatedAt: string
  phase: LearningPhase
  progress: [number, number]
}

export interface AIAction {
  type: string
  payload: Record<string, unknown>
}

export interface SSETokenChunk {
  type: 'token'
  content: string
}

export interface SSEDoneChunk {
  type: 'done'
  content: string
  options: ChatOption[] | null
  action: string | AIAction | null
}

export interface SSEErrorChunk {
  type: 'error'
  content: string
}

export interface SSEPhaseChangeChunk {
  type: 'phase_change'
  content: LearningPhase
}

export interface SSESyllabusUpdateChunk {
  type: 'syllabus_update'
  content: SyllabusNode
}

export interface SSESummaryUpdateChunk {
  type: 'summary_update'
  content: string
}

export interface SSENextUnavailableChunk {
  type: 'next_unavailable'
  content: string
}

export type SSEChunk =
  | SSETokenChunk
  | SSEDoneChunk
  | SSEErrorChunk
  | SSEPhaseChangeChunk
  | SSESyllabusUpdateChunk
  | SSESummaryUpdateChunk
  | SSENextUnavailableChunk

export interface NavigationResponse {
  currentNodeId: string | null
  phase: LearningPhase
  breadcrumb: { id: string; title: string }[]
  messages: ChatMessage[]
  hasNext?: boolean
}

export interface SettingsResponse {
  fastModel: string
  proModel: string
  apiKeys: Record<string, boolean>
}

export interface SaveSettingsPayload {
  fast_model?: string
  pro_model?: string
  api_keys?: Record<string, string>
}

export interface APIErrorResponse {
  detail?: string
  content?: string
  metadata?: Record<string, unknown>
}
