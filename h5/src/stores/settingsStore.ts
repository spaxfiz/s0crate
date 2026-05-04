import { create } from 'zustand'
import { api } from '../lib/api'

interface Settings {
  fastModel: string
  apiKeys: Record<string, boolean>
}

interface SettingsState {
  settings: Settings
  editingKeys: Record<string, string>
  isOpen: boolean
  open: () => void
  close: () => void
  load: () => Promise<void>
  save: (partial: { fastModel?: string; apiKeys?: Record<string, string> }) => Promise<void>
  setEditingKey: (provider: string, key: string) => void
}

const DEFAULT_FAST = 'anthropic/claude-haiku-4-20250414'

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    fastModel: DEFAULT_FAST,
    apiKeys: {},
  },
  editingKeys: {},
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  load: async () => {
    try {
      const data = await api.getSettings()
      set({
        settings: {
          fastModel: data.fastModel || DEFAULT_FAST,
          apiKeys: data.apiKeys || {},
        },
      })
    } catch (error) {
      console.error('Load settings error:', error)
    }
  },
  save: async (partial) => {
    const current = get().settings
    set({
      settings: {
        fastModel: partial.fastModel ?? current.fastModel,
        apiKeys: partial.apiKeys ? current.apiKeys : current.apiKeys,
      },
    })
    await api.saveSettings({
      fast_model: partial.fastModel,
      api_keys: partial.apiKeys || undefined,
    })
    await get().load()
    set({ editingKeys: {} })
  },
  setEditingKey: (provider, key) => {
    set({ editingKeys: { ...get().editingKeys, [provider]: key } })
  },
}))
