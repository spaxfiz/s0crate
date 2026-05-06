import { useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { NodeStatus, SyllabusNode } from '../../lib/types'

type View = 'home' | 'chat' | 'map' | 'fork'

const EMPTY_SYLLABUS: SyllabusNode[] = []

function StatusDot({ status, size = 8 }: { status: NodeStatus; size?: number }) {
  const cls = status === 'in_progress' ? 'dot-pulse' : ''
  const bg = status === 'completed' ? 'var(--moss)' : status === 'in_progress' ? 'var(--crimson)' : 'transparent'
  const border = status === 'pending' ? '1px solid var(--ink-faint)' : 'none'
  return <span className={cls} style={{ width: size, height: size, borderRadius: '50%', background: bg, border, display: 'inline-block', flexShrink: 0 }} />
}

function getExpandablePath(nodes: SyllabusNode[], targetId: string, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const hasChildren = node.children && node.children.length > 0
    if (node.id === targetId) {
      return hasChildren ? [...ancestors, node.id] : ancestors
    }
    if (hasChildren) {
      const path = getExpandablePath(node.children, targetId, [...ancestors, node.id])
      if (path) return path
    }
  }
  return null
}

export function Sidebar({ view, setView, onNavigate, onNewSession }: {
  view: View; setView: (v: View) => void; onNavigate: (id: string) => void; onNewSession: () => void
}) {
  const { sessions, current } = useSessionStore()
  const openSettings = useSettingsStore(s => s.open)
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [syllabusOpen, setSyllabusOpen] = useState(true)
  const syllabus = current?.syllabus?.children ?? EMPTY_SYLLABUS
  const currentNodeId = current?.currentNodeId
  const expanded = useMemo(
    () => new Set(currentNodeId ? getExpandablePath(syllabus, currentNodeId) || [] : []),
    [currentNodeId, syllabus],
  )

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
                    <div onClick={() => onNavigate(p.id)}
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
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path fillRule="evenodd" fill="currentColor" d="M7.96 2.5 A4.6 4.6 0 0 1 10.42 3.92 L11.57 3.43 A5.8 5.8 0 0 1 12.38 4.83 L11.38 5.58 A4.6 4.6 0 0 1 11.38 8.42 L12.38 9.17 A5.8 5.8 0 0 1 11.57 10.57 L10.42 10.08 A4.6 4.6 0 0 1 7.96 11.5 L7.81 12.74 A5.8 5.8 0 0 1 6.19 12.74 L6.04 11.5 A4.6 4.6 0 0 1 3.58 10.08 L2.43 10.57 A5.8 5.8 0 0 1 1.62 9.17 L2.63 8.42 A4.6 4.6 0 0 1 2.63 5.58 L1.62 4.83 A5.8 5.8 0 0 1 2.43 3.43 L3.58 3.92 A4.6 4.6 0 0 1 6.04 2.5 L6.19 1.26 A5.8 5.8 0 0 1 7.81 1.26 Z M7 5.2 A1.8 1.8 0 0 1 7 8.8 A1.8 1.8 0 0 1 7 5.2 Z"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
