import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import type { NodeStatus, SyllabusNode } from '../lib/types'

function StatusDot({ status, size = 7 }: { status: NodeStatus; size?: number }) {
  const cls = status === 'in_progress' ? 'dot-pulse' : ''
  const bg = status === 'completed' ? 'var(--moss)' : status === 'in_progress' ? 'var(--crimson)' : 'transparent'
  const border = status === 'pending' ? '1px solid var(--ink-faint)' : 'none'
  return <span className={cls} style={{ width: size, height: size, borderRadius: '50%', background: bg, border, display: 'inline-block', flexShrink: 0 }} />
}

export function DrawerNav({ onNavigate, onNewSession, onClose }: {
  onNavigate: (nodeId: string) => void
  onNewSession: () => void
  onClose: () => void
}) {
  const { sessions, current, loadSession } = useSessionStore()
  const [sessionsOpen, setSessionsOpen] = useState(true)
  const [syllabusOpen, setSyllabusOpen] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [])

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const syllabus = current?.syllabus?.children || []
  const currentNodeId = current?.currentNodeId

  return (
    <div className="fade-in" onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex',
    }}>
      {/* Backdrop */}
      <div style={{ flex: 1, background: 'rgba(40,30,20,0.45)' }} />

      {/* Drawer panel */}
      <div className="slide-in" onClick={e => e.stopPropagation()} style={{
        width: 280, maxWidth: '80vw',
        background: 'var(--paper-deep)',
        backgroundImage: 'linear-gradient(180deg, rgba(255,250,235,0.4), rgba(214,205,179,0.15))',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--rule)',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{
          padding: '14px 16px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--rule-soft)',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            background: 'radial-gradient(circle at 30% 30%, var(--accent-soft), var(--accent-deep))',
            color: 'var(--paper)', borderRadius: '50%',
            fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13,
          }}>Σ</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', lineHeight: 1 }}>Socrate</div>
            <div style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>ars discendi</div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--ink-mute)', fontSize: 18, padding: '4px 8px',
          }}>✕</button>
        </div>

        {/* New session */}
        <div style={{ padding: '10px 12px 0' }}>
          <button onClick={() => { onNewSession(); onClose(); }} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12, padding: '7px 12px',
            borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
          }}>
            <svg width="10" height="10" viewBox="0 0 11 11"><path d="M5.5 1v9 M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            New Inquiry
          </button>
        </div>

        <div ref={scrollRef} className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 0 4px' }}>
          {/* Syllabus tree */}
          {syllabus.length > 0 && (
            <>
              <div style={{ padding: '0 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                   onClick={() => setSyllabusOpen(!syllabusOpen)}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                  Syllabus · 大纲
                </span>
                <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-mute)' }}>
                  {current?.name || ''}
                </span>
              </div>
              {syllabusOpen && (
                <div style={{ padding: '4px 8px 6px' }}>
                  {syllabus.map((p) => (
                    <SyllabusParentNode
                      key={p.id}
                      node={p}
                      currentNodeId={currentNodeId ?? null}
                      expanded={expanded.has(p.id)}
                      onToggle={() => toggle(p.id)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
              <hr style={{ border: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--rule) 10%, var(--rule) 90%, transparent)', margin: '6px 12px' }} />
            </>
          )}

          {/* Sessions list */}
          <div style={{ padding: '4px 12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
               onClick={() => setSessionsOpen(!sessionsOpen)}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
              Inquiries · 会话
            </span>
            <span style={{ fontSize: 8, color: 'var(--ink-mute)', transform: sessionsOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</span>
          </div>
          {sessionsOpen && (
            <div style={{ padding: '4px 6px 8px' }}>
              {sessions.map(s => (
                <div key={s.id} onClick={() => loadSession(s.id).then(() => { onNavigate(s.id); })}
                     style={{
                       padding: '7px 8px', borderRadius: 4, cursor: 'pointer',
                       background: current?.id === s.id ? 'rgba(139,111,71,0.12)' : 'transparent',
                       borderLeft: current?.id === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                       marginBottom: 1,
                     }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', fontWeight: current?.id === s.id ? 600 : 400, lineHeight: 1.3 }}>{s.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-mute)' }}>
                      {new Date(s.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '·')}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: s.progress[0] === s.progress[1] ? 'var(--moss)' : 'var(--ink-mute)' }}>
                      {s.progress[0]}/{s.progress[1]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SyllabusParentNode({ node, currentNodeId, expanded, onToggle, onNavigate }: {
  node: SyllabusNode
  currentNodeId: string | null
  expanded: boolean
  onToggle: () => void
  onNavigate: (id: string) => void
}) {
  const isLeaf = !node.children || node.children.length === 0

  const handleClick = () => {
    if (isLeaf) {
      onNavigate(node.id)
    } else {
      onToggle()
    }
  }

  return (
    <div style={{ marginBottom: 3 }}>
      <div onClick={handleClick}
           style={{
             display: 'flex', alignItems: 'center', gap: 6, padding: '4px 5px',
             borderRadius: 3, cursor: 'pointer',
             background: currentNodeId === node.id ? 'rgba(139,111,71,0.10)' : 'transparent',
           }}>
        {!isLeaf && (
          <span style={{ width: 10, fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 10, color: 'var(--accent-deep)', textAlign: 'center' }}>
            {expanded ? '–' : '+'}
          </span>
        )}
        {isLeaf && <span style={{ width: 10 }} />}
        <StatusDot status={node.status} size={6} />
        <span style={{ fontFamily: 'var(--display)', fontSize: 11, fontWeight: 600, color: 'var(--accent-deep)', minWidth: 14 }}>{node.num}.</span>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 12.5, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{node.title}</span>
      </div>
      {expanded && !isLeaf && (
        <div style={{ marginLeft: 12, borderLeft: '1px dotted var(--rule)', paddingLeft: 6, marginTop: 1 }}>
          {node.children.map(c => (
            <SyllabusChildNode
              key={c.id}
              node={c}
              currentNodeId={currentNodeId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SyllabusChildNode({ node, currentNodeId, onNavigate }: {
  node: SyllabusNode
  currentNodeId: string | null
  onNavigate: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLeaf = !node.children || node.children.length === 0

  const handleClick = () => {
    if (isLeaf) {
      onNavigate(node.id)
    } else {
      setExpanded(!expanded)
    }
  }

  return (
    <div>
      <div onClick={handleClick}
           style={{
             display: 'flex', alignItems: 'center', gap: 6, padding: '3px 5px',
             borderRadius: 3, cursor: 'pointer',
             background: currentNodeId === node.id ? 'rgba(139,111,71,0.18)' : 'transparent',
             marginBottom: 1,
           }}>
        {!isLeaf && (
          <span style={{ width: 8, fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 9, color: 'var(--accent-deep)', textAlign: 'center' }}>
            {expanded ? '–' : '+'}
          </span>
        )}
        {isLeaf && <span style={{ width: 8 }} />}
        <StatusDot status={node.status} size={5} />
        <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-mute)', minWidth: 10 }}>{node.num}</span>
        <span style={{
          fontFamily: 'var(--serif)', fontSize: 12,
          color: currentNodeId === node.id ? 'var(--ink)' : 'var(--ink-soft)',
          fontWeight: currentNodeId === node.id ? 600 : 400, flex: 1,
        }}>{node.title}</span>
      </div>
      {expanded && !isLeaf && (
        <div style={{ marginLeft: 14, borderLeft: '1px dotted var(--rule)', paddingLeft: 6, marginTop: 1 }}>
          {node.children.map(c => (
            <SyllabusChildNode
              key={c.id}
              node={c}
              currentNodeId={currentNodeId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
