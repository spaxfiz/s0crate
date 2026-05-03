/* global React */
const { useState } = React;

/* ─────────────────── Knowledge Map (constellation view) ─────────────────── */
function MapView({ onPickNode, currentNodeId }){
  const { SYLLABUS } = window.SocrateData;

  // hand-laid positions for a constellation feel
  const layout = {
    n1:   { x: 130, y: 120 },
    'n1.1':{x: 60,  y: 230 }, 'n1.2':{x: 170, y: 250 }, 'n1.3':{x: 100, y: 360 },
    n2:   { x: 380, y: 180 },
    'n2.1':{x: 320, y: 300 }, 'n2.2':{x: 430, y: 320 }, 'n2.3':{x: 380, y: 430 }, 'n2.4':{x: 510, y: 220 },
    n3:   { x: 660, y: 130 },
    'n3.1':{x: 620, y: 250 }, 'n3.2':{x: 730, y: 230 }, 'n3.3':{x: 700, y: 350 },
    n4:   { x: 920, y: 200 },
    'n4.1':{x: 870, y: 330 }, 'n4.2':{x: 970, y: 340 },
    n5:   { x: 1140,y: 130 },
    'n5.1':{x: 1080,y: 250 }, 'n5.2':{x: 1190,y: 270 },
  };

  const [hover, setHover] = useState(null);

  const all = [];
  SYLLABUS.forEach(p => {
    all.push({ ...p, depth: 0 });
    p.children?.forEach(c => all.push({ ...c, depth: 1, parentId: p.id }));
  });

  const lines = [];
  SYLLABUS.forEach(p => {
    p.children?.forEach(c => {
      if (layout[p.id] && layout[c.id]) lines.push({ from: layout[p.id], to: layout[c.id], status: c.status });
    });
  });
  // connect topic spines
  for (let i = 0; i < SYLLABUS.length - 1; i++){
    const a = layout[SYLLABUS[i].id], b = layout[SYLLABUS[i+1].id];
    if (a && b) lines.push({ from: a, to: b, status: 'spine' });
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position:'relative', overflow:'hidden' }} className="paper-grain">
      {/* Top bar */}
      <div style={{
        padding: '14px 32px', borderBottom:'1px solid var(--rule-soft)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div>
          <div className="label">Mappa Cognitionis · 知识地图</div>
          <div style={{ fontFamily:'var(--display)', fontSize: 22, fontWeight: 600, color:'var(--ink)', marginTop: 2 }}>
            理解经济学基础
          </div>
        </div>
        <div style={{ display:'flex', gap: 14, alignItems:'center', fontFamily:'var(--sans)', fontSize: 11, color:'var(--ink-mute)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          <span style={{ display:'flex', alignItems:'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius:'50%', background:'var(--moss)', display:'inline-block' }}/> Completed · 3</span>
          <span style={{ display:'flex', alignItems:'center', gap: 5 }}><i className="dot-pulse" style={{ width: 8, height: 8, borderRadius:'50%', background:'var(--crimson)', display:'inline-block' }}/> Current · 1</span>
          <span style={{ display:'flex', alignItems:'center', gap: 5 }}><i style={{ width: 8, height: 8, borderRadius:'50%', border:'1px solid var(--ink-faint)', display:'inline-block' }}/> Pending · 8</span>
        </div>
      </div>

      <div className="map-grid" style={{ position:'absolute', inset: '70px 0 0 0', overflow:'auto' }}>
        <svg width="1300" height="560" style={{ display:'block' }}>
          {/* ornamental compass rose */}
          <g transform="translate(1230, 60)" opacity="0.3">
            <circle r="22" fill="none" stroke="var(--accent)" strokeWidth="0.5"/>
            <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="0.5"/>
            <path d="M0,-22 L4,0 L0,22 L-4,0 Z M-22,0 L0,-4 L22,0 L0,4 Z" fill="var(--accent)" opacity="0.5"/>
            <text y="-26" textAnchor="middle" fontFamily="Cormorant Garamond" fontSize="10" fontStyle="italic" fill="var(--accent-deep)">N</text>
          </g>

          {/* connecting lines */}
          {lines.map((l, i) => {
            const isSpine = l.status === 'spine';
            return (
              <line key={i}
                x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
                stroke={isSpine ? 'var(--accent-soft)' : (l.status === 'completed' ? 'var(--moss)' : 'var(--rule)')}
                strokeWidth={isSpine ? 1.2 : 0.8}
                strokeDasharray={isSpine ? '4 3' : (l.status === 'pending' ? '2 4' : '0')}
                opacity={isSpine ? 0.5 : 0.7}
              />
            );
          })}

          {/* nodes */}
          {all.map(n => {
            const pos = layout[n.id];
            if (!pos) return null;
            const top = n.depth === 0;
            const isCur = n.id === currentNodeId || n.current;
            const fill =
              n.status === 'completed'  ? 'var(--moss)' :
              n.status === 'in_progress'? 'var(--crimson)' :
                                          'var(--paper)';
            const r = top ? 22 : (isCur ? 14 : 10);
            return (
              <g key={n.id} transform={`translate(${pos.x},${pos.y})`}
                 style={{ cursor: 'pointer' }}
                 onMouseEnter={()=>setHover(n.id)} onMouseLeave={()=>setHover(null)}
                 onClick={()=>onPickNode(n.id)}>
                {/* halo for current */}
                {isCur && <circle r={r + 8} fill="none" stroke="var(--crimson)" strokeWidth="0.8" opacity="0.4"/>}
                {top && <circle r={r + 6} fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.4"/>}
                <circle r={r}
                  fill={fill}
                  stroke={top ? 'var(--accent-deep)' : (n.status === 'pending' ? 'var(--ink-faint)' : 'transparent')}
                  strokeWidth={top ? 1.5 : 1}
                />
                {top && (
                  <text textAnchor="middle" dy="5"
                    fontFamily="Cormorant Garamond" fontSize="14" fontWeight="600" fontStyle="italic"
                    fill="var(--paper)">
                    {n.num}
                  </text>
                )}
                {n.status === 'completed' && !top && (
                  <path d="M-3.5,-0.5 L-1,2 L3.5,-2.5" stroke="var(--paper)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                )}
                {n.status === 'in_progress' && !top && (
                  <circle r="3" fill="var(--paper)"/>
                )}
                {/* label */}
                <text y={top ? -r - 14 : r + 16} textAnchor="middle"
                  fontFamily={top ? 'Cormorant Garamond' : 'Noto Serif SC'}
                  fontSize={top ? 15 : 12}
                  fontWeight={top ? 600 : (isCur ? 600 : 400)}
                  fill={top ? 'var(--ink)' : 'var(--ink-soft)'}>
                  {n.title}
                </text>
                {top && (
                  <text y={-r - 28} textAnchor="middle"
                    fontFamily="Inter" fontSize="9" letterSpacing="2"
                    fill="var(--ink-mute)">
                    {`PARS · ${n.num}`}
                  </text>
                )}
                {/* hover description */}
                {hover === n.id && (
                  <g>
                    <rect x={-90} y={top ? r + 12 : r + 24} width={180} height={32} rx={2}
                      fill="var(--paper)" stroke="var(--accent)" strokeWidth="0.8"/>
                    <text y={top ? r + 32 : r + 44} textAnchor="middle"
                      fontFamily="Noto Serif SC" fontSize="11" fontStyle="italic" fill="var(--ink-soft)">
                      {n.desc}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* parchment edge ornament */}
          <text x="40" y="540" fontFamily="Cormorant Garamond" fontStyle="italic" fontSize="13" fill="var(--ink-mute)" opacity="0.5">
            "Per aspera ad astra · 循路而行，方达星辰"
          </text>
        </svg>
      </div>
    </div>
  );
}

window.MapView = MapView;
