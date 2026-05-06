import { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../../stores/sessionStore'
import type { ChatMessage, ChatOption, SyllabusNode } from '../../lib/types'

const MessageHeader = memo(function MessageHeader({ role }: { role: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {role === 'assistant' ? (
        <>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22,
            background: 'radial-gradient(circle at 30% 30%, var(--accent-soft), var(--accent-deep))',
            color: 'var(--paper)', borderRadius: '50%',
            fontFamily: 'var(--display)', fontWeight: 700, fontSize: 11,
          }}>Σ</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            Socrate · 苏格拉底
          </span>
        </>
      ) : (
        <>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--ink-mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-mute)',
          }}>Q</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            You · 学徒
          </span>
        </>
      )}
    </div>
  )
})

const Message = memo(function Message({ message, index }: { message: ChatMessage; index: number }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ marginTop: index === 0 ? 0 : 28 }}>
      <MessageHeader role={message.role} />
      {isUser ? (
        <div style={{
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 17,
          color: 'var(--ink-soft)', paddingLeft: 12, borderLeft: '2px solid var(--accent-soft)', lineHeight: 1.55,
        }}>
          "{message.content}"
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.75, color: 'var(--ink)' }} className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
})

function SyllabusGeneratingState({ status, retrying }: { status: string | null; retrying: boolean }) {
  const stageText = retrying ? 'Retrying · 正在重试' : 'Syllabus · 大纲生成中'
  const detailText = status || 'Socrate 正在把你的目标、背景和回答整理成学习路径。'

  return (
    <div style={{
      margin: '30px auto 0',
      maxWidth: 520,
      padding: '28px 32px',
      borderTop: '1px solid var(--rule-soft)',
      borderBottom: '1px solid var(--rule-soft)',
      textAlign: 'center',
    }}>
      <div className="syllabus-orb" style={{
        width: 52,
        height: 52,
        margin: '0 auto 14px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        color: 'var(--accent-deep)',
        background: 'rgba(196,164,124,0.12)',
      }}>
        <span className="syllabus-ring" aria-hidden="true" />
        <span className="syllabus-scan" aria-hidden="true" />
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M8 6.5h12M8 14h12M8 21.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 6.5h.01M5 14h.01M5 21.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{
        fontFamily: 'var(--sans)',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--accent-deep)',
        marginBottom: 8,
      }}>
        {stageText}
      </div>
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 18,
        lineHeight: 1.7,
        color: 'var(--ink)',
      }}>
        {detailText}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
        {['整理目标', '搭建结构', retrying ? '重新生成' : '校验大纲'].map((label, index) => (
          <div key={label} className="syllabus-step" style={{ animationDelay: `${index * 0.18}s` }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10,
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 14,
        color: 'var(--ink-mute)',
      }}>
        正在校准章节顺序与每一节的切入角度
        <span className="bob1">.</span><span className="bob2">.</span><span className="bob3">.</span>
      </div>
    </div>
  )
}

function hasEnoughForkSelection(text: string): boolean {
  return Array.from(text.replace(/\s+/g, '')).length >= 2
}

export function ChatView({ onOpenFork }: { onOpenFork?: () => void }) {
  const {
    current,
    sendMessage,
    isStreaming,
    streamContent,
    syllabusStatus,
    syllabusRetrying,
    errorMessage,
    noticeMessage,
    abortStreaming,
    navigateNext,
    createSummary,
    clearError,
    setForkExcerpt,
  } = useSessionStore()
  const [input, setInput] = useState('')
  const [optionsHiddenAt, setOptionsHiddenAt] = useState<number | null>(null)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = useMemo(() => current?.messages || [], [current?.messages])
  const phase = current?.phase || 'questioning'
  const currentNodeId = current?.currentNodeId

  const currentNode = useMemo(() => {
    const findNode = (nodes: SyllabusNode[], id: string): SyllabusNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const found = findNode(n.children, id); if (found) return found }
      }
      return null
    }
    return current?.syllabus ? findNode(current.syllabus.children || [], currentNodeId || '') : null
  }, [current?.syllabus, currentNodeId])
  const isEmptyLeafNode = phase === 'deep_dive'
    && !!currentNode
    && (!currentNode.children || currentNode.children.length === 0)
    && messages.length === 0

  useEffect(() => {
    const scroller = scrollRef.current
    scroller?.scrollTo({
      top: scroller.scrollHeight,
      behavior: isStreaming ? 'auto' : 'smooth',
    })
  }, [messages, streamContent, errorMessage, noticeMessage, isStreaming])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isStreaming) {
        abortStreaming()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abortStreaming, isStreaming])

  const captureSelection = useCallback(() => {
    const container = scrollRef.current
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!container || !selection || !hasEnoughForkSelection(text) || selection.rangeCount === 0) {
      setSelectionPopup(null)
      return
    }
    const range = selection.getRangeAt(0)
    const elementFromNode = (node: Node | null): Element | null => {
      if (!node) return null
      return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
    }
    const anchorElement = elementFromNode(selection.anchorNode)
    const focusElement = elementFromNode(selection.focusNode)
    if (!anchorElement || !focusElement || !container.contains(anchorElement) || !container.contains(focusElement)) {
      setSelectionPopup(null)
      return
    }
    const boundingRect = range.getBoundingClientRect()
    const rect = (boundingRect.width || boundingRect.height)
      ? boundingRect
      : Array.from(range.getClientRects()).find(r => r.width || r.height)
    if (!rect || (!rect.width && !rect.height)) return
    setSelectionPopup({
      text,
      x: Math.min(window.innerWidth - 92, Math.max(12, rect.left + rect.width / 2 - 36)),
      y: Math.max(12, rect.top - 42),
    })
  }, [])

  const scheduleSelectionCapture = useCallback((delay = 0) => {
    window.setTimeout(captureSelection, delay)
  }, [captureSelection])

  useEffect(() => {
    let timer: number | null = null
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(captureSelection, 80)
    }
    document.addEventListener('selectionchange', schedule)
    document.addEventListener('pointerup', schedule)
    document.addEventListener('touchend', schedule)
    document.addEventListener('keyup', schedule)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('selectionchange', schedule)
      document.removeEventListener('pointerup', schedule)
      document.removeEventListener('touchend', schedule)
      document.removeEventListener('keyup', schedule)
    }
  }, [captureSelection])

  const openFork = () => {
    if (!selectionPopup) return
    setForkExcerpt(selectionPopup.text)
    setSelectionPopup(null)
    window.getSelection()?.removeAllRanges()
    onOpenFork?.()
  }

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

  // Breadcrumb
  const breadcrumb = current?.breadcrumb || []
  const crumb = phase === 'questioning'
    ? [{ title: current?.name || '' }, { title: '反向提问 · Inquiry' }]
    : phase === 'summarization'
    ? [{ title: current?.name || '' }, { title: '学习总结 · Conclusion' }]
    : [...breadcrumb]

  // Folio
  const folio = phase === 'questioning' ? '— prologue —' : phase === 'summarization' ? '— colophon —' : `folio · ${currentNode?.num || ''}`

  // Quick actions for deep_dive
  const quickActions = [
    { l: '✓ 理解了，继续', v: '我理解了，请继续' },
    { l: '↷ 不用了，继续', v: '不用了，继续' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }} className="paper-grain">
      {/* Top: breadcrumb + folio */}
      <div style={{
        padding: '14px 56px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--rule-soft)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          {crumb.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {i > 0 && <span style={{ fontFamily: 'var(--display)', color: 'var(--ink-faint)', fontSize: 14 }}>›</span>}
              <span style={{
                fontFamily: i === crumb.length - 1 ? 'var(--serif)' : 'var(--display)',
                fontStyle: i < crumb.length - 1 ? 'italic' : 'normal',
                fontSize: i === crumb.length - 1 ? 15 : 13,
                color: i === crumb.length - 1 ? 'var(--ink)' : 'var(--ink-mute)',
                fontWeight: i === crumb.length - 1 ? 600 : 400,
                cursor: i < crumb.length - 1 ? 'pointer' : 'default',
              }}>{c.title}</span>
            </span>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-mute)', letterSpacing: '0.05em' }}>{folio}</span>
      </div>

      {/* Phase strip */}
      <div style={{ padding: '8px 56px', borderBottom: '1px solid var(--rule-soft)', display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {[
          { id: 'questioning', label: 'Inquiry · 反向提问' },
          { id: 'syllabus', label: 'Syllabus · 大纲' },
          { id: 'deep_dive', label: 'Deep Dive · 深入' },
          { id: 'summarization', label: 'Summary · 总结' },
        ].map((p, i, arr) => (
          <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{
              color: phase === p.id ? 'var(--accent-deep)' : 'var(--ink-faint)',
              fontWeight: phase === p.id ? 700 : 500,
              borderBottom: phase === p.id ? '1px solid var(--accent)' : '1px solid transparent',
              paddingBottom: 2, cursor: 'default',
            }}>{p.label}</span>
            {i < arr.length - 1 && <span style={{ color: 'var(--ink-faint)', fontSize: 9 }}>◆</span>}
          </span>
        ))}
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="thin-scroll"
        onMouseUp={() => scheduleSelectionCapture()}
        onTouchEnd={() => scheduleSelectionCapture(80)}
        style={{ flex: 1, overflowY: 'auto', padding: '32px 56px 24px' }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Title block */}
          {phase === 'deep_dive' && currentNode && (
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
                Capitulum · {currentNode.num}
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 42, fontWeight: 600, margin: 0, letterSpacing: '0.01em', color: 'var(--ink)' }}>{currentNode.title}</h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-soft)', marginTop: 4 }}>{currentNode.description}</div>
              <div className="ornament" style={{ marginTop: 14 }}>✦  ❦  ✦</div>
            </div>
          )}
          {phase === 'questioning' && (
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Prologus · 序章
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 32, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>
                "Know thyself first."
              </h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-mute)', marginTop: 6 }}>
                先认识你自己，再认识世界。
              </div>
            </div>
          )}
          {phase === 'summarization' && (
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Colophon · 跋
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 36, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Looking Back</h1>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, i) => <Message key={i} message={m} index={i} />)}

          {isEmptyLeafNode && !isStreaming && (
            <div style={{
              margin: '28px auto 0',
              padding: '22px 24px',
              borderTop: '1px solid var(--rule-soft)',
              borderBottom: '1px solid var(--rule-soft)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 16,
                lineHeight: 1.7,
                color: 'var(--ink-soft)',
                marginBottom: 16,
              }}>
                本节还没有学习内容。
              </div>
              <button onClick={() => send('开始学习本节')} style={{
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '0.08em',
                padding: '9px 18px',
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
          {isStreaming && phase === 'syllabus' && (
            <SyllabusGeneratingState status={syllabusStatus} retrying={syllabusRetrying} />
          )}
          {isStreaming && phase !== 'syllabus' && (
            <div style={{ marginTop: 28 }}>
              <MessageHeader role="assistant" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.75, color: 'var(--ink)' }} className="md stream-caret">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {(errorMessage || noticeMessage) && (
            <div style={{
              marginTop: 20,
              padding: '10px 14px',
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

          {/* Options */}
          {showOptions && (
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 28, borderLeft: '1px solid var(--rule-soft)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 2 }}>
                Choose · 选择
              </div>
              {lastMsg!.options!.map((opt, i) => (
                <button key={i} onClick={() => onChip(opt)} style={{
                  fontFamily: 'var(--serif)', fontSize: 14, padding: '8px 16px',
                  borderRadius: 4, border: '1px solid var(--rule)',
                  background: opt.type === 'custom' ? 'transparent' : 'var(--paper)',
                  color: opt.type === 'custom' ? 'var(--ink-mute)' : 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'baseline', gap: 10,
                  alignSelf: 'flex-start', maxWidth: '100%',
                  fontStyle: opt.type === 'custom' ? 'italic' : 'normal',
                  borderStyle: opt.type === 'custom' ? 'dashed' : 'solid',
                }}>
                  <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                    {String.fromCharCode(945 + i)}.
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ height: 16 }} />
        </div>
      </div>

      {selectionPopup && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={openFork}
          style={{
            position: 'fixed',
            left: selectionPopup.x,
            top: selectionPopup.y,
            zIndex: 80,
            border: '1px solid var(--accent)',
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 999,
            padding: '7px 12px',
            boxShadow: '0 8px 24px rgba(60,40,20,0.18)',
            cursor: 'pointer',
            fontFamily: 'var(--sans)',
            fontSize: 12,
            letterSpacing: '0.06em',
          }}
        >
          Fork
        </button>
      )}

      {/* Quick actions */}
      {((phase === 'deep_dive' && !isEmptyLeafNode) || phase === 'summarization') && !isStreaming && (
        <div style={{ padding: '0 56px', borderTop: '1px solid var(--rule-soft)', display: 'flex', gap: 8, paddingTop: 10, paddingBottom: 4, flexWrap: 'wrap' }}>
          {phase === 'deep_dive' && quickActions.map((b, i) => (
            <button key={i} onClick={() => send(b.v)} style={{
              border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12.5,
              padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)',
            }}>{b.l}</button>
          ))}
          <button onClick={() => navigateNext()} style={{
            border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12.5,
            padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)',
          }}>⤴ {phase === 'summarization' ? '继续学习下一节' : '跳到下一节'}</button>
          {phase === 'deep_dive' && (
            <button onClick={() => createSummary()} style={{
              border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 12.5,
              padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)',
            }}>☉ 生成总结</button>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '14px 56px 18px', borderTop: '1px solid var(--rule)' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 12,
          border: '1px solid var(--rule)', borderRadius: 4,
          background: 'var(--paper)', padding: '10px 12px',
          boxShadow: 'inset 0 1px 0 rgba(255,250,235,0.6), 0 1px 0 rgba(120,90,40,0.08)',
        }}>
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-mute)', paddingTop: 4 }}>Q.</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={phase === 'questioning' ? '回答 Socrate 的问题，或描述你的想法…' : '继续追问，或要求换个角度…'}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)', minHeight: 22, maxHeight: 120,
            }}
          />
          {isStreaming ? (
            <button onClick={abortStreaming} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '7px 14px',
              borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', alignSelf: 'flex-end',
            }}>■ Stop</button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim()} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '7px 14px',
              borderRadius: 999, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
              cursor: input.trim() ? 'pointer' : 'default', alignSelf: 'flex-end',
              opacity: input.trim() ? 1 : 0.5,
            }}>Send ⏎</button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--sans)', fontSize: 10.5, color: 'var(--ink-faint)', letterSpacing: '0.05em' }}>
          <span>Enter ↵ to send · Shift+Enter for newline</span>
          <span>streaming</span>
        </div>
      </div>
    </div>
  )
}
