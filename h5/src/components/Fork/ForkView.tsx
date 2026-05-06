import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../../stores/sessionStore'
import type { ChatMessage, ChatOption } from '../../lib/types'

function MessageHeader({ role }: { role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: '50%',
        border: role === 'assistant' ? 'none' : '1px solid var(--ink-mute)',
        background: role === 'assistant' ? 'radial-gradient(circle at 30% 30%, var(--accent-soft), var(--accent-deep))' : 'transparent',
        color: role === 'assistant' ? 'var(--paper)' : 'var(--ink-mute)',
        fontFamily: 'var(--display)', fontWeight: role === 'assistant' ? 700 : 400, fontStyle: role === 'assistant' ? 'normal' : 'italic', fontSize: 11,
      }}>
        {role === 'assistant' ? 'Σ' : 'Q'}
      </div>
      <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        {role === 'assistant' ? 'Socrate Fork' : 'You'}
      </span>
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
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 16,
          color: 'var(--ink-soft)', paddingLeft: 10, borderLeft: '2px solid var(--accent-soft)', lineHeight: 1.5,
        }}>
          "{message.content}"
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }} className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export function ForkView({ onBack }: { onBack: () => void }) {
  const {
    current,
    forkExcerpt,
    forkHistory,
    forkIsStreaming,
    forkStreamContent,
    sendForkMessage,
    abortStreaming,
    errorMessage,
    noticeMessage,
    clearError,
  } = useSessionStore()
  const [input, setInput] = useState('')
  const [optionsHiddenAt, setOptionsHiddenAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [forkHistory, forkStreamContent, errorMessage, noticeMessage])

  const send = (text: string) => {
    if (!text.trim() || forkIsStreaming) return
    clearError()
    setInput('')
    setOptionsHiddenAt(forkHistory.length)
    void sendForkMessage(text.trim())
  }

  const onChip = (opt: ChatOption) => {
    if (opt.type === 'custom') {
      inputRef.current?.focus()
      return
    }
    send(opt.value)
  }

  const lastMsg = forkHistory[forkHistory.length - 1]
  const showOptions = !forkIsStreaming && lastMsg?.role === 'assistant' && lastMsg.options && lastMsg.options.length > 0 && optionsHiddenAt !== forkHistory.length

  return (
    <div className="paper-grain" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{
        padding: '10px 16px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--rule-soft)',
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          border: '1px solid var(--rule)',
          background: 'transparent',
          color: 'var(--ink)',
          borderRadius: 999,
          padding: '6px 11px',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
          fontSize: 12.5,
          flexShrink: 0,
        }}>
          ← Back
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>
            Fork · 原文追问
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.name || 'Socrate'}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 16px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{
            borderLeft: '3px solid var(--accent)',
            background: 'rgba(139,111,71,0.08)',
            padding: '13px 14px',
            marginBottom: 22,
          }}>
            <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 7 }}>
              原文摘录
            </div>
            <blockquote style={{
              margin: 0,
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.65,
              color: 'var(--ink-soft)',
            }}>
              "{forkExcerpt || '请选择一段原文后再进入追问。'}"
            </blockquote>
          </div>

          {forkHistory.map((message, index) => (
            <Message key={index} message={message} index={index} />
          ))}

          {forkIsStreaming && (
            <div style={{ marginTop: 20 }}>
              <MessageHeader role="assistant" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }} className="md stream-caret">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{forkStreamContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {!forkHistory.length && !forkIsStreaming && (
            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink-mute)', textAlign: 'center', marginTop: 26 }}>
              围绕这段文字提出一个问题。
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
              fontSize: 12.5,
              lineHeight: 1.5,
            }}>
              {errorMessage || noticeMessage}
            </div>
          )}

          {showOptions && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, borderLeft: '1px solid var(--rule-soft)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
                Continue · 继续
              </div>
              {lastMsg.options!.map((opt, i) => (
                <button key={i} onClick={() => onChip(opt)} style={{
                  fontFamily: 'var(--serif)', fontSize: 14, padding: '7px 12px',
                  borderRadius: 4, border: '1px solid var(--rule)',
                  background: opt.type === 'custom' ? 'transparent' : 'var(--paper)',
                  color: opt.type === 'custom' ? 'var(--ink-mute)' : 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left', alignSelf: 'flex-start',
                  fontStyle: opt.type === 'custom' ? 'italic' : 'normal',
                  borderStyle: opt.type === 'custom' ? 'dashed' : 'solid',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-mute)', paddingTop: 3 }}>F.</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="关于这段文字，你想了解什么？"
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)', minHeight: 20, maxHeight: 80,
            }}
          />
          {forkIsStreaming ? (
            <button onClick={abortStreaming} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '6px 12px',
              borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', alignSelf: 'flex-end',
            }}>■ Stop</button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim() || !forkExcerpt} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '6px 12px',
              borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
              cursor: input.trim() && forkExcerpt ? 'pointer' : 'default', alignSelf: 'flex-end',
              opacity: input.trim() && forkExcerpt ? 1 : 0.5,
            }}>Send</button>
          )}
        </div>
      </div>
    </div>
  )
}
