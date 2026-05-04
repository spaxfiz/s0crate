import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../stores/sessionStore'
import type { ChatMessage, ChatOption, SyllabusNode } from '../lib/types'

const PHASE_LABELS: Record<string, string> = {
  questioning: 'Inquiry',
  syllabus: 'Syllabus',
  deep_dive: 'Deep Dive',
  summarization: 'Summary',
}

function MessageHeader({ role }: { role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {role === 'assistant' ? (
        <>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20,
            background: 'radial-gradient(circle at 30% 30%, var(--accent-soft), var(--accent-deep))',
            color: 'var(--paper)', borderRadius: '50%',
            fontFamily: 'var(--display)', fontWeight: 700, fontSize: 10,
          }}>Σ</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            Socrate
          </span>
        </>
      ) : (
        <>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--ink-mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)',
          }}>Q</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            You
          </span>
        </>
      )}
    </div>
  )
}

function Message({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ marginTop: index === 0 ? 0 : 20 }}>
      <MessageHeader role={message.role} />
      {isUser ? (
        <div style={{
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 15,
          color: 'var(--ink-soft)', paddingLeft: 10, borderLeft: '2px solid var(--accent-soft)', lineHeight: 1.5,
        }}>
          "{message.content}"
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }} className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export function ChatView() {
  const {
    current,
    sendMessage,
    isStreaming,
    streamContent,
    errorMessage,
    noticeMessage,
    abortStreaming,
    navigateNext,
    createSummary,
    clearError,
  } = useSessionStore()
  const [input, setInput] = useState('')
  const [optionsHiddenAt, setOptionsHiddenAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = useMemo(() => current?.messages || [], [current?.messages])
  const phase = current?.phase || 'questioning'
  const currentNodeId = current?.currentNodeId

  const findNode = (nodes: SyllabusNode[], id: string): SyllabusNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) { const found = findNode(n.children, id); if (found) return found }
    }
    return null
  }
  const currentNode = current?.syllabus ? findNode(current.syllabus.children || [], currentNodeId || '') : null
  const isEmptyLeafNode = phase === 'deep_dive'
    && !!currentNode
    && (!currentNode.children || currentNode.children.length === 0)
    && messages.length === 0

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamContent, errorMessage, noticeMessage])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isStreaming) {
        abortStreaming()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abortStreaming, isStreaming])

  const send = (text: string) => {
    if (!text.trim()) return
    clearError()
    setInput('')
    setOptionsHiddenAt(messages.length)
    sendMessage(text.trim())
  }

  const onChip = (opt: ChatOption) => {
    if (opt.type === 'custom') { inputRef.current?.focus(); return }
    send(opt.value)
  }

  const lastMsg = messages[messages.length - 1]
  const showOptions = !isStreaming && lastMsg?.role === 'assistant' && lastMsg.options && lastMsg.options.length > 0 && optionsHiddenAt !== messages.length

  // Compact breadcrumb: show only last segment
  const breadcrumb = current?.breadcrumb || []
  const crumbTitle = phase === 'questioning'
    ? current?.name || ''
    : phase === 'summarization'
    ? current?.name || ''
    : breadcrumb.length > 0
    ? breadcrumb[breadcrumb.length - 1].title
    : current?.name || ''

  const folio = phase === 'questioning' ? 'prologue' : phase === 'summarization' ? 'colophon' : currentNode?.num || ''

  const quickActions = [
    { l: '✓ 理解了', v: '我理解了，请继续' },
    { l: '✎ 举例', v: '能再举一个具体的例子吗？' },
    { l: '∇ 深入原理', v: '我想深入了解一下背后的原理' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }} className="paper-grain">
      {/* Top: compact breadcrumb + phase badge */}
      <div style={{
        padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--rule-soft)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--accent-deep)', background: 'rgba(139,111,71,0.1)',
            padding: '2px 6px', borderRadius: 3, flexShrink: 0,
          }}>
            {PHASE_LABELS[phase] || phase}
          </span>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {crumbTitle}
          </span>
        </div>
        {folio && (
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)', flexShrink: 0, marginLeft: 8 }}>
            {folio}
          </span>
        )}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 16px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Title block */}
          {phase === 'deep_dive' && currentNode && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Capitulum · {currentNode.num}
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: '0.01em', color: 'var(--ink)' }}>{currentNode.title}</h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-soft)', marginTop: 3 }}>{currentNode.description}</div>
              <div className="ornament" style={{ marginTop: 10 }}>✦ ❦ ✦</div>
            </div>
          )}
          {phase === 'questioning' && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>
                Prologus · 序章
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>
                "Know thyself first."
              </h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>
                先认识你自己，再认识世界。
              </div>
            </div>
          )}
          {phase === 'summarization' && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>
                Colophon · 跋
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Looking Back</h1>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, i) => <Message key={i} message={m} index={i} />)}

          {isEmptyLeafNode && !isStreaming && (
            <div style={{
              margin: '20px auto 0',
              padding: '16px 18px',
              borderTop: '1px solid var(--rule-soft)',
              borderBottom: '1px solid var(--rule-soft)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--ink-soft)',
                marginBottom: 12,
              }}>
                本节还没有学习内容。
              </div>
              <button onClick={() => send('开始学习本节')} style={{
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: '0.08em',
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid var(--accent-deep)',
                background: 'var(--accent-deep)',
                color: 'var(--paper)',
                cursor: 'pointer',
              }}>
                开始学习
              </button>
            </div>
          )}

          {/* Streaming */}
          {isStreaming && (
            <div style={{ marginTop: 20 }}>
              <MessageHeader role="assistant" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }} className="md stream-caret">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {(errorMessage || noticeMessage) && (
            <div style={{
              marginTop: 16,
              padding: '8px 12px',
              border: `1px solid ${errorMessage ? 'var(--crimson)' : 'var(--rule)'}`,
              background: errorMessage ? 'rgba(125,60,45,0.08)' : 'rgba(139,111,71,0.08)',
              color: errorMessage ? 'var(--crimson)' : 'var(--ink-soft)',
              borderRadius: 4,
              fontFamily: 'var(--sans)',
              fontSize: 11.5,
              lineHeight: 1.5,
            }}>
              {errorMessage || noticeMessage}
            </div>
          )}

          {/* Options */}
          {showOptions && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, borderLeft: '1px solid var(--rule-soft)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 2 }}>
                Choose · 选择
              </div>
              {lastMsg!.options!.map((opt, i) => (
                <button key={i} onClick={() => onChip(opt)} style={{
                  fontFamily: 'var(--serif)', fontSize: 13, padding: '7px 12px',
                  borderRadius: 4, border: '1px solid var(--rule)',
                  background: opt.type === 'custom' ? 'transparent' : 'var(--paper)',
                  color: opt.type === 'custom' ? 'var(--ink-mute)' : 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'baseline', gap: 8,
                  alignSelf: 'flex-start', maxWidth: '100%',
                  fontStyle: opt.type === 'custom' ? 'italic' : 'normal',
                  borderStyle: opt.type === 'custom' ? 'dashed' : 'solid',
                }}>
                  <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    {String.fromCharCode(945 + i)}.
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ height: 12 }} />
        </div>
      </div>

      {/* Quick actions (deep_dive) - horizontal scroll */}
      {phase === 'deep_dive' && !isStreaming && !isEmptyLeafNode && (
        <div style={{
          flexShrink: 0,
          padding: '0 16px', borderTop: '1px solid var(--rule-soft)',
          display: 'flex', gap: 6, paddingTop: 8, paddingBottom: 4,
          overflowX: 'auto', whiteSpace: 'nowrap',
        }} className="thin-scroll">
          {quickActions.map((b, i) => (
            <button key={i} onClick={() => send(b.v)} style={{
              border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12,
              padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
            }}>{b.l}</button>
          ))}
          <button onClick={() => navigateNext()} style={{
            border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12,
            padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
          }}>⤴ 下一节</button>
          <button onClick={() => createSummary()} style={{
            border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12,
            padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
          }}>☉ 总结</button>
        </div>
      )}

      {/* Input - sticky bottom */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px',
        paddingBottom: 'max(10px, var(--safe-bottom))',
        borderTop: '1px solid var(--rule)',
        background: 'var(--paper)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          border: '1px solid var(--rule)', borderRadius: 4,
          background: 'var(--paper)', padding: '8px 10px',
          boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.6), 0 1px 0 rgba(120,90,40,0.08)',
        }}>
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-mute)', paddingTop: 3 }}>Q.</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={phase === 'questioning' ? '回答 Socrate 的问题…' : '继续追问…'}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)', minHeight: 20, maxHeight: 80,
            }}
          />
          {isStreaming ? (
            <button onClick={abortStreaming} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 11.5, padding: '6px 12px',
              borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', alignSelf: 'flex-end',
            }}>■ Stop</button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim()} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 11.5, padding: '6px 12px',
              borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
              cursor: input.trim() ? 'pointer' : 'default', alignSelf: 'flex-end',
              opacity: input.trim() ? 1 : 0.5,
            }}>Send ⏎</button>
          )}
        </div>
      </div>
    </div>
  )
}
