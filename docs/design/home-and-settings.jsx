/* global React */
const { useState } = React;

/* ─────────────────── Home / Inquiry-list view ─────────────────── */
function HomeView({ onOpenSession, onNewSession }){
  const { SESSIONS } = window.SocrateData;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow:'auto' }} className="paper-grain thin-scroll">
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '64px 56px 56px' }}>
        <div style={{ textAlign:'center', marginBottom: 56 }}>
          <div className="label" style={{ marginBottom: 10 }}>Bibliotheca · 学习库</div>
          <h1 style={{ fontFamily:'var(--display)', fontSize: 56, fontWeight: 600, margin: 0, color:'var(--ink)', letterSpacing:'0.01em' }}>
            今天学什么?
          </h1>
          <div style={{ fontFamily:'var(--serif)', fontSize: 17, color:'var(--ink-soft)', marginTop: 8, fontStyle:'italic' }}>
            提出一个问题，让 Socrate 与你一同求索。
          </div>
          <div className="ornament" style={{ marginTop: 20 }}>✦  ❦  ✦</div>
        </div>

        {/* Question composer */}
        <div style={{
          padding: '20px 22px', border:'1px solid var(--rule)', borderRadius: 4,
          background: 'var(--paper)',
          boxShadow: '0 2px 0 rgba(120,90,40,0.06), inset 0 1px 0 rgba(255,250,235,0.7)',
          marginBottom: 48,
        }}>
          <div className="label" style={{ marginBottom: 8 }}>New Inquiry · 新会话</div>
          <textarea
            placeholder="我想学习……（如 经济学基础、Rust 编程、量子力学直觉）"
            rows={2}
            style={{
              width: '100%', border:'none', outline:'none', resize:'none',
              fontFamily:'var(--serif)', fontSize: 18, lineHeight: 1.5,
              background:'transparent', color:'var(--ink)',
            }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 10, paddingTop: 10, borderTop: '1px dotted var(--rule)' }}>
            <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
              {['经济学基础', 'Rust 编程', '量子力学直觉', '存在主义哲学'].map(s => (
                <button key={s} className="btn" style={{ fontSize: 11.5, padding: '4px 10px' }}>{s}</button>
              ))}
            </div>
            <button className="btn-primary btn" onClick={onNewSession}>Begin →</button>
          </div>
        </div>

        {/* Past inquiries */}
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily:'var(--display)', fontSize: 24, fontWeight: 600, margin: 0, color:'var(--ink)' }}>Past Inquiries</h2>
          <span style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 13, color:'var(--ink-mute)' }}>5 inquiries · 38 folios</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
          {SESSIONS.map(s => {
            const pct = Math.round(s.progress[0] / s.progress[1] * 100);
            const done = pct === 100;
            return (
              <div key={s.id} onClick={()=>onOpenSession(s.id)}
                style={{
                  padding: '18px 20px',
                  border:'1px solid var(--rule)', borderRadius: 4,
                  background: 'var(--paper)',
                  cursor:'pointer', position:'relative',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translate(-1px,-1px)'; e.currentTarget.style.boxShadow='3px 3px 0 var(--rule)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--rule)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
                  <div className="label">{s.topic}</div>
                  {done ? (
                    <span style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 11, color:'var(--moss)' }}>completed</span>
                  ) : (
                    <span style={{ fontFamily:'var(--mono)', fontSize: 10, color:'var(--ink-mute)' }}>{s.progress[0]}/{s.progress[1]}</span>
                  )}
                </div>
                <h3 style={{ fontFamily:'var(--serif)', fontSize: 19, fontWeight: 600, margin: 0, color:'var(--ink)', lineHeight: 1.3 }}>
                  {s.name}
                </h3>
                <div style={{ marginTop: 12, height: 2, background:'var(--rule-soft)', position:'relative', borderRadius: 1 }}>
                  <div style={{ position:'absolute', left: 0, top: 0, height:'100%', width: `${pct}%`, background: done ? 'var(--moss)' : 'var(--accent)' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10 }}>
                  <span style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 12, color:'var(--ink-mute)' }}>{s.date}</span>
                  <span style={{ fontFamily:'var(--sans)', fontSize: 11, color:'var(--ink-mute)' }}>resume →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Settings modal ─────────────────── */
function SettingsModal({ onClose }){
  const [provider, setProvider] = useState('anthropic');
  const [keys, setKeys] = useState({ anthropic: 'sk-ant-****…7Bf2', openai: '', google: '' });
  return (
    <div style={{
      position:'absolute', inset: 0, background:'rgba(40,30,20,0.45)',
      backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{
          width: 540, background:'var(--paper)', border:'1px solid var(--rule)', borderRadius: 4,
          boxShadow:'0 16px 48px rgba(0,0,0,0.25)',
          padding: '28px 32px',
        }} className="paper-grain">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 6 }}>
          <h2 style={{ fontFamily:'var(--display)', fontSize: 26, fontWeight: 600, margin: 0, color:'var(--ink)' }}>Settings</h2>
          <button onClick={onClose} className="btn-ghost btn" style={{ padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 13, color:'var(--ink-mute)', marginBottom: 20 }}>
          Personalia · 偏好与凭证
        </div>

        <div className="label" style={{ marginBottom: 8 }}>AI Provider · 供应商</div>
        <div style={{ display:'flex', gap: 8, marginBottom: 18 }}>
          {[
            { id:'anthropic', label:'Anthropic · Claude' },
            { id:'openai',    label:'OpenAI · GPT-4o' },
            { id:'google',    label:'Google · Gemini' },
          ].map(p => (
            <button key={p.id} onClick={()=>setProvider(p.id)}
              style={{
                flex: 1, padding: '10px 12px',
                border: '1px solid', borderColor: provider===p.id ? 'var(--accent)' : 'var(--rule)',
                background: provider===p.id ? 'rgba(139,111,71,0.1)' : 'var(--paper)',
                fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink)',
                cursor:'pointer', borderRadius: 3,
              }}>{p.label}</button>
          ))}
        </div>

        <div className="label" style={{ marginBottom: 6 }}>API Key</div>
        <input value={keys[provider]} onChange={e=>setKeys({...keys, [provider]: e.target.value})}
          placeholder="sk-…"
          style={{
            width:'100%', padding:'10px 12px', border:'1px solid var(--rule)',
            background:'var(--paper-deep)', borderRadius: 3,
            fontFamily:'var(--mono)', fontSize: 13, color:'var(--ink)',
            outline:'none', marginBottom: 18,
          }}/>

        <div className="label" style={{ marginBottom: 6 }}>Default Model · 默认模型</div>
        <select style={{
          width:'100%', padding:'10px 12px', border:'1px solid var(--rule)',
          background:'var(--paper-deep)', borderRadius: 3,
          fontFamily:'var(--serif)', fontSize: 14, color:'var(--ink)', marginBottom: 18,
        }}>
          <option>claude-3-5-sonnet-20241022</option>
          <option>claude-3-5-haiku-20241022</option>
          <option>claude-3-opus-20240229</option>
        </select>

        <div className="label" style={{ marginBottom: 6 }}>Output Directory · 学习产物目录</div>
        <div style={{
          padding:'10px 12px', border:'1px solid var(--rule)',
          background:'var(--paper-deep)', borderRadius: 3,
          fontFamily:'var(--mono)', fontSize: 12, color:'var(--ink-soft)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          ~/Documents/Socrate/learning-output/
          <button className="btn-ghost btn" style={{ padding:'2px 8px', fontSize: 11 }}>Change</button>
        </div>

        <hr className="rule" style={{ margin: '22px 0 16px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'var(--sans)', fontSize: 11, color:'var(--ink-mute)' }}>
          <span>Socrate v0.1 · sidecar :8421</span>
          <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <i style={{ width: 6, height: 6, borderRadius:'50%', background:'var(--moss)', display:'inline-block' }}/>
            Connected
          </span>
        </div>
      </div>
    </div>
  );
}

window.HomeView = HomeView;
window.SettingsModal = SettingsModal;
