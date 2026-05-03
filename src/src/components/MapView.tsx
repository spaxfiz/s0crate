import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import type { SyllabusNode, NodeStatus } from '../lib/types'

export function MapView({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { current } = useSessionStore()
  const [hover, setHover] = useState<string | null>(null)

  if (!current?.syllabus) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="paper-grain">
        <div style={{ textAlign: 'center', fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-mute)' }}>
          尚无大纲。请先开始一个学习会话。
        </div>
      </div>
    )
  }

  const syllabus = current.syllabus.children || []
  const currentNodeId = current.currentNodeId

  // Flatten nodes
  const allNodes: (SyllabusNode & { depth: number; parentId?: string })[] = []
  syllabus.forEach(p => {
    allNodes.push({ ...p, depth: 0 })
    p.children?.forEach(c => allNodes.push({ ...c, depth: 1, parentId: p.id }))
  })

  // Generate layout positions
  const layout: Record<string, { x: number; y: number }> = {}
  const xSpacing = 260
  const yBase = 120
  syllabus.forEach((p, pi) => {
    layout[p.id] = { x: 80 + pi * xSpacing, y: yBase }
    p.children?.forEach((c, ci) => {
      layout[c.id] = { x: 80 + pi * xSpacing - 60 + ci * 60, y: yBase + 120 + ci * 90 }
    })
  })

  // Lines
  const lines: { from: { x: number; y: number }; to: { x: number; y: number }; status: string }[] = []
  syllabus.forEach(p => {
    p.children?.forEach(c => {
      if (layout[p.id] && layout[c.id]) {
        lines.push({ from: layout[p.id], to: layout[c.id], status: c.status })
      }
    })
  })
  for (let i = 0; i < syllabus.length - 1; i++) {
    const a = layout[syllabus[i].id], b = layout[syllabus[i + 1].id]
    if (a && b) lines.push({ from: a, to: b, status: 'spine' })
  }

  const svgWidth = Math.max(1300, syllabus.length * xSpacing + 160)

  // Count progress
  const completed = allNodes.filter(n => n.status === 'completed').length
  const inProgress = allNodes.filter(n => n.status === 'in_progress').length
  const pending = allNodes.filter(n => n.status === 'pending').length

  const statusColor = (s: NodeStatus) =>
    s === 'completed' ? 'var(--moss)' : s === 'in_progress' ? 'var(--crimson)' : 'var(--paper)'

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }} className="paper-grain">
      {/* Top bar */}
      <div style={{
        padding: '14px 32px', borderBottom: '1px solid var(--rule-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            Mappa Cognitionis · 知识地图
          </div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
            {current.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--moss)', display: 'inline-block' }} /> Completed · {completed}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i className="dot-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--crimson)', display: 'inline-block' }} /> Current · {inProgress}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--ink-faint)', display: 'inline-block' }} /> Pending · {pending}</span>
        </div>
      </div>

      <div className="thin-scroll" style={{ position: 'absolute', inset: '70px 0 0 0', overflow: 'auto',
        backgroundImage: 'linear-gradient(rgba(180,140,80,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(180,140,80,0.07) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}>
        <svg width={svgWidth} height={560} style={{ display: 'block' }}>
          {/* Lines */}
          {lines.map((l, i) => {
            const isSpine = l.status === 'spine'
            return (
              <line key={i} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
                stroke={isSpine ? 'var(--accent-soft)' : (l.status === 'completed' ? 'var(--moss)' : 'var(--rule)')}
                strokeWidth={isSpine ? 1.2 : 0.8}
                strokeDasharray={isSpine ? '4 3' : (l.status === 'pending' ? '2 4' : '0')}
                opacity={isSpine ? 0.5 : 0.7}
              />
            )
          })}

          {/* Nodes */}
          {allNodes.map(n => {
            const pos = layout[n.id]
            if (!pos) return null
            const isTop = n.depth === 0
            const isCur = n.id === currentNodeId
            const r = isTop ? 22 : (isCur ? 14 : 10)

            return (
              <g key={n.id} transform={`translate(${pos.x},${pos.y})`}
                 style={{ cursor: 'pointer' }}
                 onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                 onClick={() => onNavigate(n.id)}>
                {isCur && <circle r={r + 8} fill="none" stroke="var(--crimson)" strokeWidth="0.8" opacity="0.4" />}
                {isTop && <circle r={r + 6} fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.4" />}
                <circle r={r} fill={statusColor(n.status)} stroke={isTop ? 'var(--accent-deep)' : (n.status === 'pending' ? 'var(--ink-faint)' : 'transparent')} strokeWidth={isTop ? 1.5 : 1} />
                {isTop && (
                  <text textAnchor="middle" dy="5" fontFamily="Cormorant Garamond" fontSize="14" fontWeight="600" fontStyle="italic" fill="var(--paper)">{n.num}</text>
                )}
                {n.status === 'completed' && !isTop && (
                  <path d="M-3.5,-0.5 L-1,2 L3.5,-2.5" stroke="var(--paper)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {n.status === 'in_progress' && !isTop && <circle r="3" fill="var(--paper)" />}
                <text y={isTop ? -r - 14 : r + 16} textAnchor="middle"
                  fontFamily={isTop ? 'Cormorant Garamond' : 'Noto Serif SC'}
                  fontSize={isTop ? 15 : 12} fontWeight={isTop ? 600 : (isCur ? 600 : 400)}
                  fill={isTop ? 'var(--ink)' : 'var(--ink-soft)'}>
                  {n.title}
                </text>
                {hover === n.id && (
                  <g>
                    <rect x={-90} y={isTop ? r + 12 : r + 24} width={180} height={32} rx={2} fill="var(--paper)" stroke="var(--accent)" strokeWidth="0.8" />
                    <text y={isTop ? r + 32 : r + 44} textAnchor="middle" fontFamily="Noto Serif SC" fontSize="11" fontStyle="italic" fill="var(--ink-soft)">
                      {n.description}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          <text x="40" y="540" fontFamily="Cormorant Garamond" fontStyle="italic" fontSize="13" fill="var(--ink-mute)" opacity="0.5">
            "Per aspera ad astra · 循路而行，方达星辰"
          </text>
        </svg>
      </div>
    </div>
  )
}
