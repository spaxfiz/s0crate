import { create } from 'zustand'
import { api } from '../lib/api'

interface Settings {
  fastModel: string
  proModel: string
  apiKeys: Record<string, boolean>  // provider -> hasKey (masked from backend)
}

interface SettingsState {
  settings: Settings
  editingKeys: Record<string, string>  // provider -> key being edited (plaintext)
  isOpen: boolean
  open: () => void
  close: () => void
  load: () => Promise<void>
  save: (partial: { fastModel?: string; proModel?: string; apiKeys?: Record<string, string> }) => Promise<void>
  setEditingKey: (provider: string, key: string) => void
}

const DEFAULT_FAST = 'anthropic/claude-haiku-4-20250414'
const DEFAULT_PRO = 'anthropic/claude-sonnet-4-20250514'

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    fastModel: DEFAULT_FAST,
    proModel: DEFAULT_PRO,
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
          proModel: data.proModel || DEFAULT_PRO,
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
        proModel: partial.proModel ?? current.proModel,
        apiKeys: partial.apiKeys ? current.apiKeys : current.apiKeys,
      },
    })
    await api.saveSettings({
      fast_model: partial.fastModel,
      pro_model: partial.proModel,
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
