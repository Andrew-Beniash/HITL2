import { ReactNode, useCallback } from 'react'
import { ChatPanel, ChatMessage } from './ChatPanel'

interface Props {
  filename: string | null
  documentText?: string
  children: ReactNode
}

/**
 * Wraps any document viewer with the collapsible ChatPanel on the right.
 * Streams replies from the server's /api/chat endpoint (OpenAI SSE).
 */
// Truncate document text to avoid exceeding context limits (~100k chars ≈ ~25k tokens)
const MAX_CONTEXT_CHARS = 100_000

export function ViewerLayout({ filename, documentText, children }: Props) {
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

      // Return an AsyncIterable that reads the SSE stream and yields token chunks
      return sseToIterable(res)
    },
    [filename, documentText]
  )

  return (
    <div style={layoutStyle}>
      <div style={viewerStyle}>{children}</div>
      <div style={chatWrapStyle}>
        <ChatPanel filename={filename} onSend={handleSend} />
      </div>
    </div>
  )
}

/**
 * Converts a fetch Response carrying a text/event-stream (SSE) into an
 * AsyncIterable<string> that yields one token chunk per event.
 *
 * Expected event format:  data: {"delta":"..."}
 * End-of-stream marker:   data: {"done":true}
 * Error marker:           data: {"error":"..."}
 */
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
      buffer = lines.pop() ?? ''   // keep incomplete last line

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
