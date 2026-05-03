import { create } from 'zustand'
import { api } from '../lib/api'

interface Settings {
  defaultModel: string
  apiKeys: Record<string, boolean>  // provider -> hasKey (masked from backend)
}

interface SettingsState {
  settings: Settings
  editingKeys: Record<string, string>  // provider -> key being edited (plaintext)
  isOpen: boolean
  open: () => void
  close: () => void
  load: () => Promise<void>
  save: (partial: { defaultModel?: string; apiKeys?: Record<string, string> }) => Promise<void>
  setEditingKey: (provider: string, key: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
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
          defaultModel: data.defaultModel || 'anthropic/claude-sonnet-4-20250514',
          apiKeys: data.apiKeys || {},
        },
      })
    } catch (error) {
      console.error('Load settings error:', error)
    }
  },
  save: async (partial) => {
    const current = get().settings
    const newSettings = {
      ...current,
      ...partial,
    }
    set({ settings: { ...newSettings, apiKeys: partial.apiKeys ? {} : current.apiKeys } })
    await api.saveSettings({
      default_model: partial.defaultModel || current.defaultModel,
      api_keys: partial.apiKeys || undefined,
    })
    // Reload to get masked key status
    await get().load()
    set({ editingKeys: {} })
  },
  setEditingKey: (provider, key) => {
    set({ editingKeys: { ...get().editingKeys, [provider]: key } })
  },
}))
