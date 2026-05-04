import type {
  ChatMessage,
  LearningSession,
  NavigationResponse,
  SaveSettingsPayload,
  SessionSummary,
  SettingsResponse,
} from './types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      const isConnRefused = message.includes('ECONNREFUSED') || message.includes('Failed to fetch')
      if (isConnRefused && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  // Sessions
  createSession: (question: string, modelTier: 'fast' | 'pro' = 'fast') =>
    request<LearningSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ question, model_tier: modelTier }),
    }),

  listSessions: () => request<SessionSummary[]>('/sessions'),

  getSession: (id: string) => request<LearningSession>(`/sessions/${id}`),

  deleteSession: (id: string) =>
    request<{ ok: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),

  // Start session (triggers first AI question, returns SSE stream)
  startSession: (id: string, signal?: AbortSignal) =>
    fetch(`${BASE}/sessions/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
    }),

  // Navigation
  navigate: (id: string, nodeId: string) =>
    request<NavigationResponse>(
      `/sessions/${id}/navigate`,
      { method: 'POST', body: JSON.stringify({ node_id: nodeId }) }
    ),

  navigateBack: (id: string) =>
    request<NavigationResponse>(
      `/sessions/${id}/back`,
      { method: 'POST' }
    ),

  navigateOverview: (id: string) =>
    request<NavigationResponse>(
      `/sessions/${id}/overview`,
      { method: 'POST' }
    ),

  navigateNext: (id: string) =>
    request<NavigationResponse>(
      `/sessions/${id}/next`,
      { method: 'POST' }
    ),

  getMessages: (id: string) => request<ChatMessage[]>(`/sessions/${id}/messages`),

  createSummary: (id: string, signal?: AbortSignal) =>
    fetch(`${BASE}/sessions/${id}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
    }),

  // Chat (returns SSE stream)
  chat: (id: string, message: string, signal?: AbortSignal) =>
    fetch(`${BASE}/sessions/${id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    }),

  // Settings
  getSettings: () => request<SettingsResponse>('/settings'),
  saveSettings: (settings: SaveSettingsPayload) =>
    request<{ ok: boolean }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
}
