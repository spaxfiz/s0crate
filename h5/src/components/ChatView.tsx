import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
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
            fontFamily: 'var(--display)', fontWeight: 700, fontSize: 11,
          }}>Σ</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
            Socrate
          </span>
        </>
      ) : (
        <>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--ink-mute)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-mute)',
          }}>Q</div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
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

function SyllabusGeneratingState({ status, retrying }: { status: string | null; retrying: boolean }) {
  const stageText = retrying ? 'Retrying · 正在重试' : 'Syllabus · 大纲生成中'
  const detailText = status || '正在把你的目标和回答整理成学习路径。'

  return (
    <div style={{
      margin: '22px auto 0',
      padding: '20px 18px',
      borderTop: '1px solid var(--rule-soft)',
      borderBottom: '1px solid var(--rule-soft)',
      textAlign: 'center',
    }}>
      <div className="syllabus-orb" style={{
        width: 44,
        height: 44,
        margin: '0 auto 12px',
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
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M8 6.5h12M8 14h12M8 21.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 6.5h.01M5 14h.01M5 21.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{
        fontFamily: 'var(--sans)',
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--accent-deep)',
        marginBottom: 7,
      }}>
        {stageText}
      </div>
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 16,
        lineHeight: 1.65,
        color: 'var(--ink)',
      }}>
        {detailText}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 14 }}>
        {['整理目标', '搭建结构', retrying ? '重新生成' : '校验大纲'].map((label, index) => (
          <div key={label} className="syllabus-step" style={{ animationDelay: `${index * 0.18}s` }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 8,
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--ink-mute)',
      }}>
        正在校准章节顺序
        <span className="bob1">.</span><span className="bob2">.</span><span className="bob3">.</span>
      </div>
    </div>
  )
}

function hasEnoughForkSelection(text: string): boolean {
  return Array.from(text.replace(/\s+/g, '')).length >= 2
}

export function ChatView({ onOpenDrawer, onOpenFork }: { onOpenDrawer?: () => void; onOpenFork?: () => void }) {
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
      x: Math.min(window.innerWidth - 82, Math.max(12, rect.left + rect.width / 2 - 32)),
      y: Math.max(12, rect.top - 40),
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
    { l: '↷ 不用了，继续', v: '不用了，继续' },
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
            fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--accent-deep)', background: 'rgba(139,111,71,0.1)',
            padding: '2px 6px', borderRadius: 3, flexShrink: 0,
          }}>
            {PHASE_LABELS[phase] || phase}
          </span>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {crumbTitle}
          </span>
        </div>
        {folio && (
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-mute)', flexShrink: 0, marginLeft: 8 }}>
            {folio}
          </span>
        )}
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="thin-scroll"
        onMouseUp={() => scheduleSelectionCapture()}
        onTouchEnd={() => scheduleSelectionCapture(80)}
        style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 16px' }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Title block */}
          {phase === 'deep_dive' && currentNode && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>
                Capitulum · {currentNode.num}
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 29, fontWeight: 600, margin: 0, letterSpacing: '0.01em', color: 'var(--ink)' }}>{currentNode.title}</h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink-soft)', marginTop: 3 }}>{currentNode.description}</div>
              <div className="ornament" style={{ marginTop: 10 }}>✦ ❦ ✦</div>
            </div>
          )}
          {phase === 'questioning' && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>
                Prologus · 序章
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 23, fontWeight: 500, margin: 0, color: 'var(--ink)' }}>
                "Know thyself first."
              </h1>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink-mute)', marginTop: 4 }}>
                先认识你自己，再认识世界。
              </div>
            </div>
          )}
          {phase === 'summarization' && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>
                Colophon · 跋
              </div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 25, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Looking Back</h1>
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
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--ink-soft)',
                marginBottom: 12,
              }}>
                本节还没有学习内容。
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {onOpenDrawer && (
                  <button onClick={onOpenDrawer} style={{
                    fontFamily: 'var(--sans)',
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: '0.08em',
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: '1px solid var(--rule)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}>
                    查看大纲
                  </button>
                )}
                <button onClick={() => send('开始学习本节')} style={{
                  fontFamily: 'var(--sans)',
                  fontWeight: 600,
                  fontSize: 13,
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
            </div>
          )}

          {/* Streaming */}
          {isStreaming && phase === 'syllabus' && (
            <SyllabusGeneratingState status={syllabusStatus} retrying={syllabusRetrying} />
          )}
          {isStreaming && phase !== 'syllabus' && (
            <div style={{ marginTop: 20 }}>
              <MessageHeader role="assistant" />
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }} className="md stream-caret">
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
              fontSize: 12.5,
              lineHeight: 1.5,
            }}>
              {errorMessage || noticeMessage}
            </div>
          )}

          {/* Options */}
          {showOptions && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, borderLeft: '1px solid var(--rule-soft)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 2 }}>
                Choose · 选择
              </div>
              {lastMsg!.options!.map((opt, i) => (
                <button key={i} onClick={() => onChip(opt)} style={{
                  fontFamily: 'var(--serif)', fontSize: 14, padding: '7px 12px',
                  borderRadius: 4, border: '1px solid var(--rule)',
                  background: opt.type === 'custom' ? 'transparent' : 'var(--paper)',
                  color: opt.type === 'custom' ? 'var(--ink-mute)' : 'var(--ink)',
                  cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'baseline', gap: 8,
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

          <div style={{ height: 12 }} />
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

      {/* Quick actions - horizontal scroll */}
      {((phase === 'deep_dive' && !isEmptyLeafNode) || phase === 'summarization') && !isStreaming && (
        <div style={{
          flexShrink: 0,
          padding: '0 16px', borderTop: '1px solid var(--rule-soft)',
          display: 'flex', gap: 6, paddingTop: 8, paddingBottom: 4,
          overflowX: 'auto', whiteSpace: 'nowrap',
        }} className="thin-scroll">
          {phase === 'deep_dive' && quickActions.map((b, i) => (
            <button key={i} onClick={() => send(b.v)} style={{
              border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 13,
              padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
            }}>{b.l}</button>
          ))}
          <button onClick={() => navigateNext()} style={{
            border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 13,
            padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
          }}>⤴ {phase === 'summarization' ? '继续学习下一节' : '下一节'}</button>
          {phase === 'deep_dive' && (
            <button onClick={() => createSummary()} style={{
              border: 'none', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 13,
              padding: '4px 8px', cursor: 'pointer', color: 'var(--ink-mute)', flexShrink: 0,
            }}>☉ 总结</button>
          )}
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
          <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-mute)', paddingTop: 3 }}>Q.</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={phase === 'questioning' ? '回答 Socrate 的问题…' : '继续追问…'}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.5,
              background: 'transparent', color: 'var(--ink)', minHeight: 20, maxHeight: 80,
            }}
          />
          {isStreaming ? (
            <button onClick={abortStreaming} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '6px 12px',
              borderRadius: 999, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', alignSelf: 'flex-end',
            }}>■ Stop</button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim()} style={{
              fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, padding: '6px 12px',
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
