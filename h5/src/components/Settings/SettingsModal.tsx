import { useState, useMemo } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'

interface Provider {
  id: string
  name: string
  nameCn: string
  models: { id: string; label: string }[]
}

const PROVIDERS: Provider[] = [
  {
    id: 'anthropic', name: 'Anthropic', nameCn: 'Anthropic',
    models: [
      { id: 'anthropic/claude-haiku-4-20250414', label: 'Claude Haiku 4' },
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-opus-4-20250514', label: 'Claude Opus 4' },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', nameCn: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'openai/o3-mini', label: 'o3-mini' },
    ],
  },
  {
    id: 'google', name: 'Google', nameCn: 'Google',
    models: [
      { id: 'gemini/gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
      { id: 'gemini/gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', nameCn: 'DeepSeek',
    models: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
      { id: 'deepseek/deepseek-reasoner', label: 'DeepSeek R1' },
    ],
  },
  {
    id: 'xai', name: 'xAI', nameCn: 'xAI',
    models: [
      { id: 'xai/grok-3-mini', label: 'Grok 3 Mini' },
      { id: 'xai/grok-3', label: 'Grok 3' },
    ],
  },
  {
    id: 'groq', name: 'Groq', nameCn: 'Groq',
    models: [
      { id: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
      { id: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'groq/mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
  },
  {
    id: 'mistral', name: 'Mistral', nameCn: 'Mistral',
    models: [
      { id: 'mistral/mistral-small-latest', label: 'Mistral Small' },
      { id: 'mistral/mistral-large-latest', label: 'Mistral Large' },
    ],
  },
  {
    id: 'dashscope', name: 'DashScope', nameCn: '通义千问',
    models: [
      { id: 'dashscope/qwen-turbo', label: 'Qwen Turbo' },
      { id: 'dashscope/qwen-plus', label: 'Qwen Plus' },
      { id: 'dashscope/qwen-max', label: 'Qwen Max' },
    ],
  },
  {
    id: 'zhipuai', name: 'ZhipuAI', nameCn: '智谱 AI',
    models: [
      { id: 'zhipuai/glm-4-flash', label: 'GLM-4 Flash' },
      { id: 'zhipuai/glm-4-plus', label: 'GLM-4 Plus' },
    ],
  },
  {
    id: 'moonshot', name: 'Moonshot', nameCn: '月之暗面',
    models: [
      { id: 'moonshot/moonshot-v1-32k', label: 'Moonshot v1 32K' },
      { id: 'moonshot/moonshot-v1-128k', label: 'Moonshot v1 128K' },
    ],
  },
  {
    id: 'ollama', name: 'Ollama', nameCn: 'Ollama (本地)',
    models: [
      { id: 'ollama/llama3.3', label: 'Llama 3.3' },
      { id: 'ollama/qwen2.5', label: 'Qwen 2.5' },
    ],
  },
]

const SETTINGS_SAVE_DISABLED = true

export function SettingsModal() {
  const { settings, editingKeys, close, save, setEditingKey } = useSettingsStore()
  const [selectedProvider, setSelectedProvider] = useState(() => {
    const match = PROVIDERS.find(p => settings.fastModel.startsWith(p.id + '/'))
    return match?.id || 'anthropic'
  })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showProviders, setShowProviders] = useState(false)

  const selectedProviderData = PROVIDERS.find(p => p.id === selectedProvider)!
  const currentEditingKey = editingKeys[selectedProvider] || ''

  const filteredProviders = useMemo(() => {
    if (!search) return PROVIDERS
    const q = search.toLowerCase()
    return PROVIDERS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nameCn.includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  }, [search])

  const handleSaveKey = async () => {
    if (SETTINGS_SAVE_DISABLED) return
    setSaving(true)
    try {
      const keysToSave: Record<string, string> = {}
      if (currentEditingKey) {
        keysToSave[selectedProvider] = currentEditingKey
      }
      await save({ apiKeys: keysToSave })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        maxHeight: '85vh',
        background: 'var(--paper)',
        borderTop: '1px solid var(--rule)',
        borderRadius: '12px 12px 0 0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} className="paper-grain slide-up">
        {/* Handle bar */}
        <div style={{ padding: '8px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--rule)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '4px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 21, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Settings</h2>
            <div style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
              Personalia · 偏好与凭证
            </div>
          </div>
          <button onClick={close} style={{
            padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--sans)', fontSize: 17, color: 'var(--ink-mute)',
          }}>✕</button>
        </div>

        {/* Body */}
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
          {/* Provider selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
              Provider · 供应商
            </div>
            {/* Current provider (tap to expand list) */}
            <button onClick={() => setShowProviders(!showProviders)} style={{
              width: '100%', padding: '8px 10px',
              border: '1px solid var(--rule)', borderRadius: 3,
              background: 'var(--paper-deep)',
              fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{selectedProviderData.name} <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>{selectedProviderData.nameCn}</span></span>
              <span style={{ fontSize: 11, color: 'var(--ink-mute)', transform: showProviders ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>▾</span>
            </button>

            {showProviders && (
              <div style={{ marginTop: 6, border: '1px solid var(--rule)', borderRadius: 3, background: 'var(--paper)', overflow: 'hidden' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  style={{
                    width: '100%', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--rule-soft)',
                    background: 'var(--paper-deep)',
                    fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', outline: 'none',
                  }}
                />
                <div className="thin-scroll" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filteredProviders.map(p => (
                    <button key={p.id} onClick={() => { setSelectedProvider(p.id); setShowProviders(false); setSearch('') }} style={{
                      width: '100%', padding: '8px 10px', textAlign: 'left',
                      border: 'none', borderBottom: '1px solid var(--rule-soft)',
                      background: selectedProvider === p.id ? 'rgba(139,111,71,0.1)' : 'transparent',
                      fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {settings.apiKeys[p.id] && (
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--moss)', flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* API Key */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
              API Key
              {settings.apiKeys[selectedProvider] && (
                <span style={{ color: 'var(--moss)', marginLeft: 6, letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>✓ configured</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={currentEditingKey}
                onChange={e => {
                  if (SETTINGS_SAVE_DISABLED) return
                  setEditingKey(selectedProvider, e.target.value)
                }}
                placeholder={settings.apiKeys[selectedProvider] ? '••••••••••••••••' : 'sk-…'}
                type="password"
                disabled={SETTINGS_SAVE_DISABLED}
                style={{
                  flex: 1, padding: '7px 9px', border: '1px solid var(--rule)',
                  background: 'var(--paper-deep)', borderRadius: 3,
                  fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', outline: 'none',
                  opacity: SETTINGS_SAVE_DISABLED ? 0.6 : 1,
                }}
              />
              <button onClick={handleSaveKey} disabled={SETTINGS_SAVE_DISABLED || saving || !currentEditingKey} style={{
                padding: '7px 12px', border: '1px solid var(--rule)',
                background: currentEditingKey && !SETTINGS_SAVE_DISABLED ? 'var(--paper-deep)' : 'transparent',
                fontFamily: 'var(--sans)', fontSize: 11, color: currentEditingKey && !SETTINGS_SAVE_DISABLED ? 'var(--ink)' : 'var(--ink-faint)',
                cursor: 'default', borderRadius: 3, whiteSpace: 'nowrap',
              }}>
                {saving ? '…' : 'Save'}
              </button>
            </div>
            {selectedProvider === 'ollama' && (
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                Ollama runs locally — no API key needed.
              </div>
            )}
          </div>

          {/* Fast Model selector */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
              ⚡ Fast Model · 快速模型
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {selectedProviderData.models.map(m => (
                <button key={m.id} disabled={SETTINGS_SAVE_DISABLED} onClick={() => save({ fastModel: m.id })} style={{
                  padding: '7px 10px', textAlign: 'left',
                  border: '1px solid', borderColor: settings.fastModel === m.id ? 'var(--accent)' : 'var(--rule-soft)',
                  background: settings.fastModel === m.id ? 'rgba(139,111,71,0.1)' : 'var(--paper)',
                  fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
                  cursor: 'default', borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: SETTINGS_SAVE_DISABLED && settings.fastModel !== m.id ? 0.62 : 1,
                }}>
                  <span>{m.label}</span>
                  {settings.fastModel === m.id && <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--accent-deep)' }}>✓</span>}
                </button>
              ))}
            </div>
            <input
              value={settings.fastModel}
              onChange={e => {
                if (SETTINGS_SAVE_DISABLED) return
                save({ fastModel: e.target.value })
              }}
              placeholder="provider/model-name"
              disabled={SETTINGS_SAVE_DISABLED}
              style={{
                width: '100%', padding: '6px 9px', border: '1px solid var(--rule)',
                background: 'var(--paper-deep)', borderRadius: 3,
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', outline: 'none',
                opacity: SETTINGS_SAVE_DISABLED ? 0.6 : 1,
              }}
            />
            <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
              LiteLLM format: provider/model-name
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 20px 14px', paddingBottom: 'max(14px, var(--safe-bottom))' }}>
          <hr style={{ border: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--rule) 10%, var(--rule) 90%, transparent)', margin: '0 0 10px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)' }}>
              Socrate H5 v0.1 · LiteLLM
            </span>
            <button onClick={handleSaveKey} disabled={SETTINGS_SAVE_DISABLED || saving || !currentEditingKey} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13, padding: '6px 16px',
              borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
              cursor: 'default',
              opacity: 0.45,
            }}>
              {saving ? '…' : 'Save · 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
