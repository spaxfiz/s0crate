import { useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { NodeStatus } from '../../lib/types'

type View = 'home' | 'chat' | 'map'

function StatusDot({ status, size = 8 }: { status: NodeStatus; size?: number }) {
  const cls = status === 'in_progress' ? 'dot-pulse' : ''
  const bg = status === 'completed' ? 'var(--moss)' : status === 'in_progress' ? 'var(--crimson)' : 'transparent'
  const border = status === 'pending' ? '1px solid var(--ink-faint)' : 'none'
  return <span className={cls} style={{ width: size, height: size, borderRadius: '50%', background: bg, border, display: 'inline-block', flexShrink: 0 }} />
}

export function Sidebar({ view, setView, onNavigate, onNewSession }: {
  view: View; setView: (v: View) => void; onNavigate: (id: string) => void; onNewSession: () => void
}) {
  const { sessions, current } = useSessionStore()
  const openSettings = useSettingsStore(s => s.open)
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [syllabusOpen, setSyllabusOpen] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const syllabus = current?.syllabus?.children || []
  const currentNodeId = current?.currentNodeId

  return (
    <aside style={{
      width: 268, flexShrink: 0,
      borderRight: '1px solid var(--rule)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--paper-deep)',
      backgroundImage: 'linear-gradient(180deg, rgba(255,250,235,0.4), rgba(214,205,179,0.15))',
    }} className="thin-scroll">
      {/* Brand */}
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--rule-soft)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28,
          background: 'radial-gradient(circle at 30% 30%, var(--accent-soft), var(--accent-deep))',
          color: 'var(--paper)', borderRadius: '50%',
          fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13,
        }}>Σ</div>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 19, letterSpacing: '0.02em', color: 'var(--ink)', lineHeight: 1 }}>Socrate</div>
          <div style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}>ars discendi · 学习的技艺</div>
        </div>
      </div>

      {/* New session */}
      <div style={{ padding: '12px 14px 0' }}>
        <button onClick={onNewSession} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '7px 14px',
          borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M5.5 1v9 M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          New Inquiry
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0 4px' }} className="thin-scroll">
        {/* Syllabus tree */}
        {syllabus.length > 0 && (
          <>
            <div style={{ padding: '0 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                 onClick={() => setSyllabusOpen(!syllabusOpen)}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                Syllabus · 大纲
              </span>
              <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)' }}>
                {current?.name || ''}
              </span>
            </div>
            {syllabusOpen && (
              <div style={{ padding: '6px 10px 8px' }}>
                {syllabus.map((p) => (
                  <div key={p.id} style={{ marginBottom: 4 }}>
                    <div onClick={() => { toggle(p.id); onNavigate(p.id); }}
                         style={{
                           display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
                           borderRadius: 3, cursor: 'pointer',
                           background: currentNodeId === p.id ? 'rgba(139,111,71,0.10)' : 'transparent',
                         }}>
                      <span style={{ width: 10, fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--accent-deep)', textAlign: 'center' }}>
                        {expanded.has(p.id) ? '–' : '+'}
                      </span>
                      <StatusDot status={p.status} size={7} />
                      <span style={{ fontFamily: 'var(--display)', fontSize: 12, fontWeight: 600, color: 'var(--accent-deep)', minWidth: 16 }}>{p.num}.</span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 13.5, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{p.title}</span>
                    </div>
                    {expanded.has(p.id) && p.children && (
                      <div style={{ marginLeft: 14, borderLeft: '1px dotted var(--rule)', paddingLeft: 8, marginTop: 2 }}>
                        {p.children.map(c => (
                          <div key={c.id} onClick={() => onNavigate(c.id)}
                               style={{
                                 display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                                 borderRadius: 3, cursor: 'pointer',
                                 background: currentNodeId === c.id ? 'rgba(139,111,71,0.18)' : 'transparent',
                                 marginBottom: 1,
                               }}>
                            <StatusDot status={c.status} size={6} />
                            <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)', minWidth: 10 }}>{c.num}</span>
                            <span style={{
                              fontFamily: 'var(--serif)', fontSize: 12.5,
                              color: currentNodeId === c.id ? 'var(--ink)' : 'var(--ink-soft)',
                              fontWeight: currentNodeId === c.id ? 600 : 400, flex: 1,
                            }}>{c.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <hr style={{ border: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--rule) 10%, var(--rule) 90%, transparent)', margin: '8px 14px' }} />
          </>
        )}

        {/* Sessions list */}
        <div style={{ padding: '6px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
             onClick={() => setSessionsOpen(!sessionsOpen)}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            Inquiries · 会话
          </span>
          <span style={{ fontSize: 9, color: 'var(--ink-mute)', transform: sessionsOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</span>
        </div>
        {sessionsOpen && (
          <div style={{ padding: '4px 8px 8px' }}>
            {sessions.map(s => (
              <div key={s.id} onClick={() => { useSessionStore.getState().loadSession(s.id).then(() => setView('chat')); }}
                   style={{
                     padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                     background: current?.id === s.id ? 'rgba(139,111,71,0.12)' : 'transparent',
                     borderLeft: current?.id === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                     marginBottom: 2,
                   }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, color: 'var(--ink)', fontWeight: current?.id === s.id ? 600 : 400, lineHeight: 1.3 }}>{s.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)' }}>
                    {new Date(s.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '·')}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: s.progress[0] === s.progress[1] ? 'var(--moss)' : 'var(--ink-mute)' }}>
                    {s.progress[0]}/{s.progress[1]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View switcher */}
      <div style={{ borderTop: '1px solid var(--rule-soft)', padding: 10, display: 'flex', gap: 4 }}>
        {[
          { id: 'chat' as View, label: 'Reading', icon: '𝓡' },
          { id: 'map' as View, label: 'Map', icon: '✦' },
          { id: 'home' as View, label: 'Home', icon: '⌂' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
                  style={{
                    flex: 1, padding: '6px 4px', border: 'none', cursor: 'pointer',
                    background: view === v.id ? 'rgba(139,111,71,0.14)' : 'transparent',
                    borderRadius: 4,
                    fontFamily: 'var(--sans)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: view === v.id ? 'var(--accent-deep)' : 'var(--ink-mute)',
                    fontWeight: view === v.id ? 600 : 500,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 14 }}>{v.icon}</span>
            {v.label}
          </button>
        ))}
        <button onClick={openSettings}
                style={{ padding: '6px 8px', border: 'none', cursor: 'pointer', background: 'transparent', borderRadius: 4, color: 'var(--ink-mute)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 1v2 M7 11v2 M1 7h2 M11 7h2 M2.5 2.5l1.4 1.4 M10.1 10.1l1.4 1.4 M2.5 11.5l1.4-1.4 M10.1 3.9l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
