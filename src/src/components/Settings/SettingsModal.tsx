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
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-haiku-4-20250414', label: 'Claude Haiku 4' },
      { id: 'anthropic/claude-opus-4-20250514', label: 'Claude Opus 4' },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', nameCn: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
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
      { id: 'xai/grok-3', label: 'Grok 3' },
      { id: 'xai/grok-3-mini', label: 'Grok 3 Mini' },
    ],
  },
  {
    id: 'groq', name: 'Groq', nameCn: 'Groq',
    models: [
      { id: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
      { id: 'groq/mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
  },
  {
    id: 'mistral', name: 'Mistral', nameCn: 'Mistral',
    models: [
      { id: 'mistral/mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral/mistral-small-latest', label: 'Mistral Small' },
      { id: 'mistral/codestral-latest', label: 'Codestral' },
    ],
  },
  {
    id: 'together_ai', name: 'Together AI', nameCn: 'Together AI',
    models: [
      { id: 'together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
      { id: 'together_ai/Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B' },
    ],
  },
  {
    id: 'fireworks_ai', name: 'Fireworks AI', nameCn: 'Fireworks AI',
    models: [
      { id: 'fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B' },
      { id: 'fireworks_ai/accounts/fireworks/models/qwen2p5-72b-instruct', label: 'Qwen 2.5 72B' },
    ],
  },
  {
    id: 'cohere', name: 'Cohere', nameCn: 'Cohere',
    models: [
      { id: 'cohere/command-r-plus', label: 'Command R+' },
      { id: 'cohere/command-r', label: 'Command R' },
    ],
  },
  {
    id: 'perplexity', name: 'Perplexity', nameCn: 'Perplexity',
    models: [
      { id: 'perplexity/sonar-pro', label: 'Sonar Pro' },
      { id: 'perplexity/sonar', label: 'Sonar' },
    ],
  },
  {
    id: 'dashscope', name: 'DashScope', nameCn: '通义千问',
    models: [
      { id: 'dashscope/qwen-max', label: 'Qwen Max' },
      { id: 'dashscope/qwen-plus', label: 'Qwen Plus' },
      { id: 'dashscope/qwen-turbo', label: 'Qwen Turbo' },
    ],
  },
  {
    id: 'zhipuai', name: 'ZhipuAI', nameCn: '智谱 AI',
    models: [
      { id: 'zhipuai/glm-4-plus', label: 'GLM-4 Plus' },
      { id: 'zhipuai/glm-4-flash', label: 'GLM-4 Flash' },
    ],
  },
  {
    id: 'moonshot', name: 'Moonshot', nameCn: '月之暗面',
    models: [
      { id: 'moonshot/moonshot-v1-128k', label: 'Moonshot v1 128K' },
      { id: 'moonshot/moonshot-v1-32k', label: 'Moonshot v1 32K' },
    ],
  },
  {
    id: 'volcengine', name: 'Volcengine', nameCn: '火山引擎',
    models: [
      { id: 'volcengine/doubao-1.5-pro-256k', label: 'Doubao 1.5 Pro 256K' },
      { id: 'volcengine/doubao-1.5-lite-32k', label: 'Doubao 1.5 Lite 32K' },
    ],
  },
  {
    id: 'minimax', name: 'MiniMax', nameCn: 'MiniMax',
    models: [
      { id: 'minimax/MiniMax-Text-01', label: 'MiniMax Text 01' },
    ],
  },
  {
    id: 'spark', name: 'Spark', nameCn: '讯飞星火',
    models: [
      { id: 'spark/spark4.0-ultra', label: 'Spark 4.0 Ultra' },
      { id: 'spark/spark-max', label: 'Spark Max' },
    ],
  },
  {
    id: 'azure', name: 'Azure', nameCn: 'Azure OpenAI',
    models: [
      { id: 'azure/gpt-4o', label: 'GPT-4o (Azure)' },
      { id: 'azure/gpt-4o-mini', label: 'GPT-4o Mini (Azure)' },
    ],
  },
  {
    id: 'bedrock', name: 'AWS Bedrock', nameCn: 'AWS Bedrock',
    models: [
      { id: 'bedrock/anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
      { id: 'bedrock/anthropic.claude-haiku-4-20250414-v1:0', label: 'Claude Haiku 4' },
    ],
  },
  {
    id: 'databricks', name: 'Databricks', nameCn: 'Databricks',
    models: [
      { id: 'databricks/databricks-meta-llama-3-3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'huggingface', name: 'Hugging Face', nameCn: 'Hugging Face',
    models: [
      { id: 'huggingface/meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'deepinfra', name: 'DeepInfra', nameCn: 'DeepInfra',
    models: [
      { id: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
      { id: 'deepinfra/Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B' },
    ],
  },
  {
    id: 'nvidia', name: 'NVIDIA', nameCn: 'NVIDIA',
    models: [
      { id: 'nvidia/meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'replicate', name: 'Replicate', nameCn: 'Replicate',
    models: [
      { id: 'replicate/meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
  },
  {
    id: 'ollama', name: 'Ollama', nameCn: 'Ollama (本地)',
    models: [
      { id: 'ollama/llama3.3', label: 'Llama 3.3' },
      { id: 'ollama/qwen2.5', label: 'Qwen 2.5' },
      { id: 'ollama/deepseek-r1', label: 'DeepSeek R1' },
    ],
  },
]

export function SettingsModal() {
  const { settings, editingKeys, close, save, setEditingKey } = useSettingsStore()
  const [selectedProvider, setSelectedProvider] = useState(() => {
    // Find which provider the current default model belongs to
    const currentModel = settings.defaultModel
    const match = PROVIDERS.find(p => currentModel.startsWith(p.id + '/'))
    return match?.id || 'anthropic'
  })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

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
    setSaving(true)
    try {
      // Build api_keys dict with only the changed provider
      const keysToSave: Record<string, string> = {}
      if (currentEditingKey) {
        keysToSave[selectedProvider] = currentEditingKey
      }
      // Preserve existing keys from other providers
      const allKeys: Record<string, string> = {}
      for (const [k, v] of Object.entries(settings.apiKeys)) {
        if (v) allKeys[k] = ''  // We don't have the actual value, just the flag
      }
      await save({ apiKeys: { ...allKeys, ...keysToSave } })
    } finally {
      setSaving(false)
    }
  }

  const handleModelChange = (modelId: string) => {
    save({ defaultModel: modelId })
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const keysToSave: Record<string, string> = {}
      for (const [k, v] of Object.entries(editingKeys)) {
        if (v) keysToSave[k] = v
      }
      await save({
        defaultModel: settings.defaultModel,
        apiKeys: keysToSave,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(40,30,20,0.45)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={close}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 680, maxHeight: '85vh', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 4,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} className="paper-grain">
        {/* Header */}
        <div style={{ padding: '24px 32px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Settings</h2>
            <button onClick={close} style={{
              padding: '4px 10px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink-mute)',
            }}>✕</button>
          </div>
          <div style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-mute)', marginBottom: 16 }}>
            Personalia · 偏好与凭证
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 32px 24px', gap: 24 }}>
          {/* Left: Provider list */}
          <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
              Provider · 供应商
            </div>
            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', padding: '6px 10px', border: '1px solid var(--rule)',
                background: 'var(--paper-deep)', borderRadius: 3,
                fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)', outline: 'none', marginBottom: 8,
              }}
            />
            <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredProviders.map(p => (
                <button key={p.id} onClick={() => setSelectedProvider(p.id)} style={{
                  padding: '8px 10px', textAlign: 'left',
                  border: '1px solid', borderColor: selectedProvider === p.id ? 'var(--accent)' : 'transparent',
                  background: selectedProvider === p.id ? 'rgba(139,111,71,0.1)' : 'transparent',
                  fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)',
                  cursor: 'pointer', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {settings.apiKeys[p.id] && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--moss)', flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Provider detail */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
              {selectedProviderData.name}
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 8 }}>
                {selectedProviderData.nameCn}
              </span>
            </div>

            {/* API Key */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                API Key
                {settings.apiKeys[selectedProvider] && (
                  <span style={{ color: 'var(--moss)', marginLeft: 8, letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>✓ configured</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={currentEditingKey}
                  onChange={e => setEditingKey(selectedProvider, e.target.value)}
                  placeholder={settings.apiKeys[selectedProvider] ? '••••••••••••••••' : 'sk-…'}
                  type="password"
                  style={{
                    flex: 1, padding: '8px 10px', border: '1px solid var(--rule)',
                    background: 'var(--paper-deep)', borderRadius: 3,
                    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', outline: 'none',
                  }}
                />
                <button onClick={handleSaveKey} disabled={saving || !currentEditingKey} style={{
                  padding: '8px 14px', border: '1px solid var(--rule)',
                  background: currentEditingKey ? 'var(--paper-deep)' : 'transparent',
                  fontFamily: 'var(--sans)', fontSize: 11, color: currentEditingKey ? 'var(--ink)' : 'var(--ink-faint)',
                  cursor: currentEditingKey ? 'pointer' : 'default', borderRadius: 3, whiteSpace: 'nowrap',
                }}>
                  {saving ? '…' : 'Save Key'}
                </button>
              </div>
              {selectedProvider === 'ollama' && (
                <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                  Ollama runs locally — no API key needed. Ensure Ollama is running on localhost:11434.
                </div>
              )}
            </div>

            {/* Model selector */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Default Model · 默认模型
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedProviderData.models.map(m => (
                  <button key={m.id} onClick={() => handleModelChange(m.id)} style={{
                    padding: '8px 12px', textAlign: 'left',
                    border: '1px solid', borderColor: settings.defaultModel === m.id ? 'var(--accent)' : 'var(--rule-soft)',
                    background: settings.defaultModel === m.id ? 'rgba(139,111,71,0.1)' : 'var(--paper)',
                    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
                    cursor: 'pointer', borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{m.label}</span>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink-mute)' }}>{m.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom model input */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Custom Model · 自定义模型
              </div>
              <input
                value={settings.defaultModel}
                onChange={e => handleModelChange(e.target.value)}
                placeholder="provider/model-name"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid var(--rule)',
                  background: 'var(--paper-deep)', borderRadius: 3,
                  fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', outline: 'none',
                }}
              />
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                LiteLLM format: provider/model-name (e.g., openai/gpt-4o, deepseek/deepseek-chat)
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 32px 20px' }}>
          <hr style={{ border: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--rule) 10%, var(--rule) 90%, transparent)', margin: '0 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)' }}>
              Socrate v0.1 · powered by LiteLLM
            </span>
            <button onClick={handleSaveAll} disabled={saving} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '7px 18px',
              borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', cursor: 'pointer',
            }}>Save · 保存</button>
          </div>
        </div>
      </div>
    </div>
  )
}
