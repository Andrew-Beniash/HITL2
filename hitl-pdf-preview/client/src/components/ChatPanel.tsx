import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: Date
}

interface Props {
  filename: string | null
  /**
   * Called with the user message and full history.
   * May return a plain string (non-streaming) or an AsyncIterable<string>
   * (streaming — each yielded value is appended to the assistant bubble).
   */
  onSend?: (message: string, history: ChatMessage[]) => Promise<string | AsyncIterable<string>>
  /**
   * When set, the panel opens, pre-fills the message, and sends it automatically.
   * Pass a new object reference each time to trigger (use a counter or uuid as key).
   */
  pendingMessage?: { text: string; key: string }
}

const PANEL_WIDTH = 320

function makeId() {
  return Math.random().toString(36).slice(2)
}

export function ChatPanel({ filename, onSend, pendingMessage }: Props) {
  const [open, setOpen] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Core send logic — accepts text directly so it can be called from both
  // the textarea submit and the pendingMessage auto-send path.
  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { id: makeId(), role: 'user', text: text.trim(), ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const assistantId = makeId()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '', ts: new Date() }])

    try {
      const history = [...messages, userMsg]

      if (!onSend) {
        await new Promise(r => setTimeout(r, 600))
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, text: 'AI backend not connected yet. Add OPENAI_API_KEY to server/.env.' }
            : m
        ))
      } else {
        const result = await onSend(text.trim(), history)
        if (typeof result === 'string') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: result } : m))
        } else {
          for await (const chunk of result) {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, text: m.text + chunk } : m
            ))
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: `Error: ${err instanceof Error ? err.message : String(err)}` }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [loading, messages, onSend])

  const send = useCallback(() => sendText(input), [input, sendText])

  // Auto-send injected messages (e.g. "Explain selection")
  // pendingMessage.key changes each time — used as the effect trigger.
  // "Ask about selection" sets text but doesn't auto-send (key ends with '~ask').
  useEffect(() => {
    if (!pendingMessage) return
    setOpen(true)
    if (pendingMessage.key.endsWith('~ask')) {
      // Pre-fill only — let user finish the question
      setInput(pendingMessage.text)
    } else {
      setInput('')
      sendText(pendingMessage.text)
    }
  }, [pendingMessage?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }, [send])

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Collapse toggle tab */}
      <button
        onClick={() => setOpen(o => !o)}
        style={toggleBtnStyle}
        title={open ? 'Collapse chat' : 'Expand chat'}
        aria-label={open ? 'Collapse chat panel' : 'Expand chat panel'}
      >
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Panel body */}
      <div style={{
        ...panelStyle,
        width: open ? `${PANEL_WIDTH}px` : '0px',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
      }}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={headerIconStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div>
            <div style={headerTitleStyle}>Document Chat</div>
            {filename && (
              <div style={headerSubtitleStyle} title={filename}>
                {filename.length > 28 ? filename.slice(0, 25) + '…' : filename}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={messagesStyle}>
          {messages.length === 0 && (
            <div style={emptyStateStyle}>
              <div style={emptyIconStyle}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p style={emptyTitleStyle}>Ask about this document</p>
              <p style={emptySubStyle}>Summarise, extract data, or ask any question about the content.</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '2px' }}>
              <div style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle}>
                {msg.text}
              </div>
              <span style={timestampStyle}>{formatTime(msg.ts)}</span>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <div style={assistantBubbleStyle}>
                <span className="chat-typing-dots">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={inputAreaStyle}>
          <div style={inputWrapStyle}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a question… (Enter to send)"
              disabled={loading}
              rows={1}
              style={textareaStyle}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                ...sendBtnStyle,
                background: input.trim() && !loading ? '#007AFF' : '#c7c7cc',
              }}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p style={inputHintStyle}>Shift+Enter for new line</p>
        </div>
      </div>

      <style>{TYPING_ANIMATION}</style>
    </div>
  )
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toggleBtnStyle: React.CSSProperties = {
  position: 'absolute',
  left: '-16px',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
  width: '16px',
  height: '48px',
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRight: 'none',
  borderRadius: '6px 0 0 6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#8e8e93',
  padding: 0,
  boxShadow: '-2px 0 6px rgba(0,0,0,0.06)',
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#ffffff',
  borderLeft: '1px solid rgba(0,0,0,0.08)',
  overflow: 'hidden',
  transition: 'width 0.22s ease, opacity 0.18s ease',
  flexShrink: 0,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(0,0,0,0.07)',
  flexShrink: 0,
}

const headerIconStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  background: 'rgba(0,122,255,0.1)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1d1d1f',
  lineHeight: 1.3,
}

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#8e8e93',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: `${PANEL_WIDTH - 80}px`,
}

const messagesStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: '32px 16px',
  gap: '8px',
  textAlign: 'center',
}

const emptyIconStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  background: '#f5f5f7',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '4px',
}

const emptyTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1d1d1f',
  margin: 0,
}

const emptySubStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8e8e93',
  lineHeight: 1.5,
  margin: 0,
}

const userBubbleStyle: React.CSSProperties = {
  background: '#007AFF',
  color: '#ffffff',
  padding: '8px 12px',
  borderRadius: '16px 16px 4px 16px',
  fontSize: '13px',
  lineHeight: 1.5,
  maxWidth: '85%',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}

const assistantBubbleStyle: React.CSSProperties = {
  background: '#f1f1f2',
  color: '#1d1d1f',
  padding: '8px 12px',
  borderRadius: '16px 16px 16px 4px',
  fontSize: '13px',
  lineHeight: 1.5,
  maxWidth: '92%',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}

const timestampStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#aeaeb2',
  padding: '0 4px',
}

const inputAreaStyle: React.CSSProperties = {
  padding: '10px 12px 8px',
  borderTop: '1px solid rgba(0,0,0,0.07)',
  flexShrink: 0,
}

const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-end',
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  resize: 'none',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: '10px',
  padding: '8px 10px',
  fontSize: '13px',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  outline: 'none',
  overflowY: 'auto',
  minHeight: '36px',
  maxHeight: '120px',
  background: '#f9f9f9',
  color: '#1d1d1f',
}

const sendBtnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s',
  marginBottom: '2px',
}

const inputHintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#aeaeb2',
  margin: '4px 0 0',
  textAlign: 'right',
}

const TYPING_ANIMATION = `
@keyframes chatTypingDot {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}
.chat-typing-dots {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 16px;
}
.chat-typing-dots .dot {
  width: 6px; height: 6px;
  background: #8e8e93;
  border-radius: 50%;
  display: inline-block;
  animation: chatTypingDot 1.2s infinite;
}
.chat-typing-dots .dot:nth-child(2) { animation-delay: 0.2s; }
.chat-typing-dots .dot:nth-child(3) { animation-delay: 0.4s; }
`
