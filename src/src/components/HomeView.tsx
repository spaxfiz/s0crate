import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'

export function HomeView({ onStartSession, onOpenSession }: {
  onStartSession: (question: string, tier: 'fast' | 'pro') => void
  onOpenSession: (id: string) => void
}) {
  const { sessions, deleteSession } = useSessionStore()
  const [question, setQuestion] = useState('')
  const [tier, setTier] = useState<'fast' | 'pro'>('fast')

  const suggestions = ['经济学基础', 'Rust 编程', '量子力学直觉', '存在主义哲学']

  const handleStart = () => {
    if (question.trim()) onStartSession(question.trim(), tier)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="paper-grain thin-scroll">
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '64px 56px 56px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 10 }}>
            Bibliotheca · 学习库
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 56, fontWeight: 600, margin: 0, color: 'var(--ink)', letterSpacing: '0.01em' }}>
            今天学什么?
          </h1>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink-soft)', marginTop: 8, fontStyle: 'italic' }}>
            提出一个问题，让 Socrate 与你一同求索。
          </div>
          <div className="ornament" style={{ marginTop: 20 }}>✦  ❦  ✦</div>
        </div>

        {/* Question composer */}
        <div style={{
          padding: '20px 22px', border: '1px solid var(--rule)', borderRadius: 4,
          background: 'var(--paper)',
          boxShadow: '0 2px 0 rgba(120,90,40,0.06), inset 0 1px 0 rgba(255,250,235,0.7)',
          marginBottom: 48,
        }}>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
            New Inquiry · 新会话
          </div>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStart(); } }}
            placeholder="我想学习……（如 经济学基础、Rust 编程、量子力学直觉）"
            rows={2}
            style={{
              width: '100%', border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dotted var(--rule)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setQuestion(s)} style={{
                  fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 11.5, padding: '4px 10px',
                  borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Fast / Pro tier toggle */}
              <div style={{
                display: 'flex', borderRadius: 999, border: '1px solid var(--rule)',
                overflow: 'hidden', fontFamily: 'var(--sans)', fontSize: 11.5,
              }}>
                {(['fast', 'pro'] as const).map(t => (
                  <button key={t} onClick={() => setTier(t)} style={{
                    padding: '5px 12px', border: 'none', cursor: 'pointer',
                    background: tier === t ? 'var(--ink)' : 'transparent',
                    color: tier === t ? 'var(--paper)' : 'var(--ink-mute)',
                    fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 11.5,
                    letterSpacing: '0.04em',
                  }}>
                    {t === 'fast' ? '⚡ Fast' : '✦ Pro'}
                  </button>
                ))}
              </div>
              <button onClick={handleStart} style={{
                fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '7px 14px',
                borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', cursor: 'pointer',
              }}>Begin →</button>
            </div>
          </div>
        </div>

        {/* Past inquiries */}
        {sessions.length === 0 ? (
          <div style={{
            marginTop: 24,
            textAlign: 'center',
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--ink-mute)',
          }}>
            尚无历史会话。提出一个问题开始第一段学习。
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Past Inquiries</h2>
              <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-mute)' }}>
                {sessions.length} inquiries
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {sessions.map(s => {
                const pct = s.progress[1] > 0 ? Math.round(s.progress[0] / s.progress[1] * 100) : 0
                const done = pct === 100
                return (
                  <div key={s.id} onClick={() => onOpenSession(s.id)}
                    style={{
                      padding: '18px 20px', border: '1px solid var(--rule)', borderRadius: 4,
                      background: 'var(--paper)', cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                        {s.phase}
                      </div>
                      {done ? (
                        <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--moss)' }}>completed</span>
                      ) : (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute)' }}>{s.progress[0]}/{s.progress[1]}</span>
                      )}
                    </div>
                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 600, margin: 0, color: 'var(--ink)', lineHeight: 1.3 }}>{s.name}</h3>
                    <div style={{ marginTop: 12, height: 2, background: 'var(--rule-soft)', position: 'relative', borderRadius: 1 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: done ? 'var(--moss)' : 'var(--accent)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-mute)' }}>
                        {new Date(s.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '·')}
                      </span>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteSession(s.id)
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--sans)',
                            fontSize: 11,
                            color: 'var(--crimson)',
                          }}
                        >
                          delete
                        </button>
                        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)' }}>resume →</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
