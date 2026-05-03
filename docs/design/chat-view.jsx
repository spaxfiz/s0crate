/* global React */
const { useState, useEffect, useRef } = React;

/* ─────────────────── Chat View ─────────────────── */
function ChatView({ phase, currentNode, onPhaseChange }){
  const { TRANSCRIPTS, FLAT_NODES } = window.SocrateData;
  const Markdown = window.Markdown;

  const baseTranscript =
    phase === 'questioning' ? TRANSCRIPTS.questioning :
    phase === 'summary'     ? TRANSCRIPTS.summary :
                              TRANSCRIPTS.deepDive;

  const [messages, setMessages] = useState(baseTranscript);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(null); // {content: full, shown: partial, options}
  const [optionsHidden, setOptionsHidden] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(()=>{
    setMessages(baseTranscript);
    setOptionsHidden(false);
    setStreaming(null);
  }, [phase, currentNode?.id]);

  useEffect(()=>{
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  /* simulate streaming for a synthetic AI reply */
  const simulateReply = (userText) => {
    let reply;
    if (phase === 'questioning'){
      reply = {
        role: 'assistant',
        content: '我理解了你的需求：\n\n- 已有零散概念基础\n- 目标是看懂经济新闻\n- 偏好**案例驱动**的学习\n\n基于此，我为你拟定一份学习大纲——以真实经济现象为线索，把概念串成可用的思维工具。',
        options: [
          { label: '查看大纲', value: '展示大纲' },
          { label: '调整目标', value: '我想调整一下目标' },
          { label: '自定义...', value: '', type: 'custom' },
        ],
        action: 'generate_syllabus',
      };
    } else if (phase === 'summary'){
      reply = {
        role: 'assistant',
        content: '## 学习总结\n\n### 核心要点\n\n1. **稀缺**是经济学的起点：资源有限，人需要选择\n2. **机会成本**让选择有了真正的代价\n3. **边际思维**揭示了决策发生在"边缘"\n4. 市场通过**价格信号**协调亿万陌生人的行为\n\n### 概念关系\n\n稀缺 → 选择 → 机会成本 → 激励 → 价格 → 均衡',
        options: [
          { label: '保存总结', value: '保存为 summary.md' },
          { label: '继续深入', value: '我想继续深入下一阶段' },
          { label: '自定义...', value: '', type: 'custom' },
        ],
      };
    } else {
      reply = {
        role: 'assistant',
        content: '好问题。让我换个角度——\n\n想象**两位面包师**：一位用古老的石窑，一位用现代电烤箱。当面包价格从 10 元涨到 50 元时：\n\n- 石窑师傅每天最多多做 20 个，因为石窑容量有限\n- 电烤箱师傅可以加开第二班次，多做 200 个\n\n这就是**边际成本递增**的体现：每多做一个面包，所付出的代价（时间、人力、磨损）会上升。供给曲线之所以**向上倾斜**，正是因为只有更高的价格才能补偿更高的边际成本。',
        options: [
          { label: '那弹性呢？', value: '那供给的弹性怎么理解？' },
          { label: '我理解了', value: '我理解了，进入下一节' },
          { label: '自定义...', value: '', type: 'custom' },
        ],
      };
    }

    const fullText = reply.content;
    let i = 0;
    setStreaming({ content: '', options: null });
    const tick = () => {
      i += Math.max(2, Math.floor(Math.random()*5));
      if (i >= fullText.length){
        setStreaming(null);
        setMessages(m => [...m, reply]);
        setOptionsHidden(false);
        return;
      }
      setStreaming({ content: fullText.slice(0, i), options: null });
      setTimeout(tick, 22);
    };
    setTimeout(tick, 350);
  };

  const send = (text) => {
    if (!text || !text.trim()) return;
    setMessages(m => [...m, { role:'user', content: text }]);
    setInput('');
    setOptionsHidden(true);
    simulateReply(text);
  };

  const onChip = (opt) => {
    if (opt.type === 'custom'){
      inputRef.current?.focus();
      return;
    }
    send(opt.value);
  };

  const lastMsg = messages[messages.length - 1];
  const showOptions = !streaming && lastMsg?.role === 'assistant' && lastMsg.options && !optionsHidden;

  /* breadcrumb */
  const crumb =
    phase === 'questioning' ? ['理解经济学基础', '反向提问 · Inquiry'] :
    phase === 'summary'     ? ['理解经济学基础', '学习总结 · Conclusion'] :
                              ['理解经济学基础', currentNode?.parentTitle || '供给与需求', currentNode?.title || '供给曲线'];

  /* Folio number */
  const folio = phase === 'questioning' ? '— prologue —' :
                phase === 'summary'     ? '— colophon —' :
                `folio · ${currentNode?.num || '2'}`;

  return (
    <div style={{ flex: 1, display:'flex', flexDirection:'column', minHeight: 0, position:'relative' }} className="paper-grain">
      {/* Top: breadcrumb + tools */}
      <div style={{
        padding: '14px 56px 10px 56px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom: '1px solid var(--rule-soft)',
      }}>
        <div style={{ display:'flex', alignItems:'baseline', gap: 10, flexWrap:'wrap' }}>
          {crumb.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ fontFamily:'var(--display)', color:'var(--ink-faint)', fontSize: 14 }}>›</span>}
              <span style={{
                fontFamily: i === crumb.length-1 ? 'var(--serif)' : 'var(--display)',
                fontStyle: i < crumb.length-1 ? 'italic' : 'normal',
                fontSize: i === crumb.length-1 ? 15 : 13,
                color: i === crumb.length-1 ? 'var(--ink)' : 'var(--ink-mute)',
                fontWeight: i === crumb.length-1 ? 600 : 400,
                cursor: i < crumb.length-1 ? 'pointer' : 'default',
              }}>{c}</span>
            </React.Fragment>
          ))}
        </div>
        <span className="folio">{folio}</span>
      </div>

      {/* Phase strip */}
      <div style={{ padding: '8px 56px', borderBottom: '1px solid var(--rule-soft)', display:'flex', alignItems:'center', gap: 14, fontFamily:'var(--sans)', fontSize: 11, letterSpacing:'0.1em', textTransform:'uppercase' }}>
        {[
          { id:'questioning', label:'Inquiry · 反向提问'},
          { id:'syllabus',    label:'Syllabus · 大纲', isView: 'map' },
          { id:'deepDive',    label:'Deep Dive · 深入'},
          { id:'summary',     label:'Summary · 总结'},
        ].map((p, i, arr) => (
          <React.Fragment key={p.id}>
            <button onClick={()=>onPhaseChange(p.id)}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor:'pointer',
                fontFamily: 'inherit', fontSize: 'inherit', letterSpacing:'inherit', textTransform:'inherit',
                color: phase === p.id ? 'var(--accent-deep)' : 'var(--ink-faint)',
                fontWeight: phase === p.id ? 700 : 500,
                borderBottom: phase === p.id ? '1px solid var(--accent)' : '1px solid transparent',
                paddingBottom: 2,
              }}>{p.label}</button>
            {i < arr.length - 1 && <span style={{color:'var(--ink-faint)', fontSize: 9}}>◆</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 56px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Title block for the topic */}
          {phase === 'deepDive' && (
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 8 }}>Capitulum II · 2</div>
              <h1 style={{
                fontFamily:'var(--display)', fontSize: 42, fontWeight: 600,
                margin: 0, letterSpacing: '0.01em', color: 'var(--ink)',
              }}>The Supply Curve</h1>
              <div style={{ fontFamily:'var(--serif)', fontSize: 18, color:'var(--ink-soft)', marginTop: 4 }}>
                供给曲线
              </div>
              <div className="ornament" style={{ marginTop: 14 }}>✦  ❦  ✦</div>
            </div>
          )}

          {phase === 'questioning' && (
            <div style={{ marginBottom: 28, textAlign:'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Prologus · 序章</div>
              <h1 style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 32, fontWeight: 500, margin: 0, color:'var(--ink)' }}>
                "Know thyself first."
              </h1>
              <div style={{ fontFamily:'var(--serif)', fontSize: 13, color:'var(--ink-mute)', marginTop: 6 }}>
                先认识你自己，再认识世界。
              </div>
            </div>
          )}

          {phase === 'summary' && (
            <div style={{ marginBottom: 28, textAlign:'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Colophon · 跋</div>
              <h1 style={{ fontFamily:'var(--display)', fontSize: 36, fontWeight: 600, margin: 0, color:'var(--ink)' }}>
                Looking Back
              </h1>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} index={i}/>
          ))}

          {streaming && (
            <div style={{ marginTop: 28 }}>
              <MessageHeader role="assistant" />
              <div style={{ fontFamily:'var(--serif)', fontSize: 16, lineHeight: 1.75, color:'var(--ink)' }} className="md stream-caret">
                <Markdown text={streaming.content}/>
              </div>
            </div>
          )}

          {/* options */}
          {showOptions && (
            <div style={{ marginTop: 24, display:'flex', flexDirection:'column', gap: 8, paddingLeft: 28, borderLeft:'1px solid var(--rule-soft)' }}>
              <div className="label" style={{ marginBottom: 2 }}>Choose · 选择</div>
              {lastMsg.options.map((opt, i) => (
                <button key={i} className={`chip ${opt.type === 'custom' ? 'chip-custom' : ''}`} onClick={()=>onChip(opt)} style={{ alignSelf:'flex-start', maxWidth: '100%' }}>
                  <span className="chip-num">{String.fromCharCode(945 + i)}.</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* topic_complete action card (deep dive) */}
          {phase === 'deepDive' && messages.length >= 3 && !streaming && (
            <div style={{ marginTop: 40, padding: '16px 22px', border:'1px solid var(--rule)', borderRadius: 4, background: 'rgba(184,144,47,0.06)', display:'flex', alignItems:'center', gap: 16 }}>
              <span style={{ fontFamily:'var(--display)', fontSize: 22, color:'var(--accent)' }}>❦</span>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ marginBottom: 2 }}>Suggested Next · 建议</div>
                <div style={{ fontFamily:'var(--serif)', fontSize: 14, color:'var(--ink-soft)' }}>
                  下一节：<span style={{ fontWeight: 600, color:'var(--ink)' }}>市场均衡</span> — 看不见的手如何让两条曲线相遇
                </div>
              </div>
              <button className="btn">→ Continue</button>
            </div>
          )}

          <div style={{ height: 16 }}/>
        </div>
      </div>

      {/* Quick action bar (deep dive only) */}
      {phase === 'deepDive' && (
        <div style={{ padding: '0 56px', borderTop: '1px solid var(--rule-soft)', display:'flex', gap: 8, paddingTop: 10, paddingBottom: 4 }}>
          {[
            { l: '✓ 理解了，继续', v: '我理解了，请继续' },
            { l: '✎ 举个例子',   v: '能再举一个具体的例子吗？' },
            { l: '∇ 深入原理',   v: '我想深入了解一下背后的原理' },
            { l: '⤴ 跳到下一节', v: '跳到下一节' },
          ].map((b, i) => (
            <button key={i} onClick={()=>send(b.v)} className="btn-ghost"
              style={{ border:'none', background:'transparent', fontFamily:'var(--serif)', fontSize: 12.5, padding: '4px 8px', cursor:'pointer', color:'var(--ink-mute)' }}>
              {b.l}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '14px 56px 18px', borderTop: '1px solid var(--rule)' }}>
        <div style={{
          display:'flex', alignItems:'flex-end', gap: 12,
          border:'1px solid var(--rule)', borderRadius: 4,
          background: 'var(--paper)',
          padding: '10px 12px',
          boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.6), 0 1px 0 rgba(120,90,40,0.08)',
        }}>
          <span style={{ fontFamily:'var(--display)', fontStyle:'italic', fontSize: 14, color:'var(--ink-mute)', paddingTop: 4 }}>Q.</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{
              if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(input); }
            }}
            placeholder={phase === 'questioning' ? '回答 Socrate 的问题，或描述你的想法…' : '继续追问，或要求换个角度…'}
            rows={1}
            style={{
              flex: 1, border:'none', outline:'none', resize:'none',
              fontFamily:'var(--serif)', fontSize: 15, lineHeight: 1.5,
              background:'transparent', color:'var(--ink)',
              minHeight: 22, maxHeight: 120,
            }}
          />
          {streaming ? (
            <button onClick={()=>{ setStreaming(null); }} className="btn"
              style={{ alignSelf:'flex-end' }}>
              ■ Stop
            </button>
          ) : (
            <button onClick={()=>send(input)} className="btn-primary btn"
              style={{ alignSelf:'flex-end' }} disabled={!input.trim()}>
              Send ⏎
            </button>
          )}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop: 6, fontFamily:'var(--sans)', fontSize: 10.5, color:'var(--ink-faint)', letterSpacing:'0.05em' }}>
          <span>Enter ↵ to send · Shift+Enter for newline · Esc to stop</span>
          <span>claude-3.5-sonnet · streaming</span>
        </div>
      </div>
    </div>
  );
}

function MessageHeader({ role }){
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 8 }}>
      {role === 'assistant' ? (
        <>
          <div className="seal" style={{ width: 22, height: 22, fontSize: 11 }}>Σ</div>
          <span className="label">Socrate · 苏格拉底</span>
        </>
      ) : (
        <>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border:'1px solid var(--ink-mute)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--display)', fontStyle:'italic', fontSize: 12, color:'var(--ink-mute)' }}>Q</div>
          <span className="label">You · 学徒</span>
        </>
      )}
    </div>
  );
}

function Message({ message, index }){
  const Markdown = window.Markdown;
  const isUser = message.role === 'user';
  return (
    <div style={{ marginTop: index === 0 ? 0 : 28 }}>
      <MessageHeader role={message.role}/>
      {isUser ? (
        <div style={{
          fontFamily:'var(--display)', fontStyle:'italic', fontSize: 17,
          color: 'var(--ink-soft)',
          paddingLeft: 12, borderLeft:'2px solid var(--accent-soft)',
          lineHeight: 1.55,
        }}>
          "{message.content}"
        </div>
      ) : (
        <div style={{ fontFamily:'var(--serif)', fontSize: 16, lineHeight: 1.75, color: 'var(--ink)' }} className="md">
          <Markdown text={message.content}/>
        </div>
      )}
    </div>
  );
}

window.ChatView = ChatView;
