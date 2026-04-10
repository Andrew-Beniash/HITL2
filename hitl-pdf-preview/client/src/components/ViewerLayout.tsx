import { ReactNode, useCallback, useState, useEffect, useRef } from 'react'
import { ChatPanel, ChatMessage } from './ChatPanel'
import { SelectionMenu } from './SelectionMenu'

interface Props {
  filename: string | null
  documentText?: string
  children: ReactNode
}

interface SelectionState {
  text: string
  x: number
  y: number
}

// Truncate document text to avoid exceeding context limits (~100k chars ≈ ~25k tokens)
const MAX_CONTEXT_CHARS = 100_000
// Selections shorter than this are likely accidental double-clicks
const MIN_SELECTION_LENGTH = 3

function makeKey() {
  return Math.random().toString(36).slice(2)
}

export function ViewerLayout({ filename, documentText, children }: Props) {
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [pendingMessage, setPendingMessage] = useState<{ text: string; key: string } | undefined>()
  const viewerRef = useRef<HTMLDivElement>(null)

  // Detect text selection inside the viewer pane
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // Ignore clicks inside the chat panel
      const chatEl = document.getElementById('chat-panel-root')
      if (chatEl?.contains(e.target as Node)) return

      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() ?? ''
        if (text.length < MIN_SELECTION_LENGTH) {
          setSelection(null)
          return
        }
        // Anchor the menu at the end of the selection range
        const range = sel!.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top,        // menu renders above this point
        })
      }, 0)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  const dismissMenu = useCallback(() => setSelection(null), [])

  const handleExplain = useCallback(() => {
    if (!selection) return
    const msg = `Please explain the following text from the document:\n\n"${selection.text}"`
    setPendingMessage({ text: msg, key: makeKey() })
    setSelection(null)
    // Clear the browser selection so it doesn't linger
    window.getSelection()?.removeAllRanges()
  }, [selection])

  const handleSend = useCallback(
    async (message: string, history: ChatMessage[]): Promise<AsyncIterable<string>> => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          filename,
          document_text: documentText
            ? documentText.slice(0, MAX_CONTEXT_CHARS)
            : undefined,
          history: history.slice(0, -1).map(m => ({ role: m.role, text: m.text })),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(body.detail ?? `Server error ${res.status}`)
      }

      return sseToIterable(res)
    },
    [filename, documentText]
  )

  return (
    <div style={layoutStyle}>
      <div ref={viewerRef} style={viewerStyle}>{children}</div>

      <div id="chat-panel-root" style={chatWrapStyle}>
        <ChatPanel
          filename={filename}
          onSend={handleSend}
          pendingMessage={pendingMessage}
        />
      </div>

      {selection && (
        <SelectionMenu
          x={selection.x}
          y={selection.y}
          onDismiss={dismissMenu}
          items={[
            {
              label: 'Explain selection',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ),
              onClick: handleExplain,
            },
            {
              label: 'Summarise selection',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="21" y1="10" x2="3" y2="10"/>
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/>
                  <line x1="21" y1="18" x2="11" y2="18"/>
                </svg>
              ),
              onClick: () => {
                if (!selection) return
                setPendingMessage({
                  text: `Please summarise the following text:\n\n"${selection.text}"`,
                  key: makeKey(),
                })
                setSelection(null)
                window.getSelection()?.removeAllRanges()
              },
            },
            {
              label: 'Ask about selection',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
              onClick: () => {
                if (!selection) return
                setPendingMessage({
                  text: `Regarding this text from the document: "${selection.text}"\n\n`,
                  key: makeKey() + '~ask',   // ~ask suffix → pre-fill only, don't auto-send
                })
                setSelection(null)
                window.getSelection()?.removeAllRanges()
              },
            },
          ]}
        />
      )}
    </div>
  )
}

async function* sseToIterable(res: Response): AsyncIterable<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue

        let parsed: { delta?: string; done?: boolean; error?: string }
        try { parsed = JSON.parse(jsonStr) } catch { continue }

        if (parsed.error) throw new Error(parsed.error)
        if (parsed.done) return
        if (parsed.delta) yield parsed.delta
      }
    }
  } finally {
    reader.releaseLock()
  }
}

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
}

const viewerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const chatWrapStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
}
