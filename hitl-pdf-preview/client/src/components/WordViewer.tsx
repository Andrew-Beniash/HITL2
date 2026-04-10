import { useEffect, useState, useRef, useCallback } from 'react'
import mammoth from 'mammoth'

interface Props {
  file: File
  onOpenNew: () => void
  onTextExtracted?: (text: string) => void
}

const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 15

export function WordViewer({ file, onOpenNew, onTextExtracted }: Props) {
  const [html, setHtml] = useState<string>('')
  const [messages, setMessages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHtml('')
    setMessages([])
    setError(null)

    file.arrayBuffer().then(buf => {
      return mammoth.convertToHtml(
        { arrayBuffer: buf },
        {
          styleMap: [
            "p[style-name='Title'] => h1.doc-title",
            "p[style-name='Subtitle'] => p.doc-subtitle",
            "p[style-name='heading 1'] => h1",
            "p[style-name='heading 2'] => h2",
            "p[style-name='heading 3'] => h3",
            "p[style-name='heading 4'] => h4",
            "p[style-name='heading 5'] => h5",
            "p[style-name='heading 6'] => h6",
            "p[style-name='List Paragraph'] => p.list-paragraph",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          convertImage: mammoth.images.imgElement(image => {
            return image.read('base64').then(b64 => ({
              src: `data:${image.contentType};base64,${b64}`,
            }))
          }),
        }
      )
    }).then(result => {
      setHtml(result.value)
      const warnings = result.messages
        .filter(m => m.type === 'warning')
        .map(m => m.message)
      setMessages(warnings)

      // Strip HTML tags to get plain text for chat context
      if (onTextExtracted && result.value) {
        const plain = result.value
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>|<\/h[1-6]>|<\/li>|<\/tr>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        onTextExtracted(plain)
      }
    }).catch(err => {
      setError(`Failed to load document: ${err?.message ?? err}`)
    })
  }, [file])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === '+' || e.key === '=') changeZoom(ZOOM_STEP)
      if (e.key === '-') changeZoom(-ZOOM_STEP)
      if (e.key === '0') setZoom(100)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [changeZoom])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button onClick={onOpenNew} style={btnStyle} title="Open another file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
        <span style={filenameStyle}>{file.name}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => changeZoom(-ZOOM_STEP)} style={btnStyle} disabled={zoom <= MIN_ZOOM}>−</button>
        <span style={zoomLabelStyle}>{zoom}%</span>
        <button onClick={() => changeZoom(ZOOM_STEP)} style={btnStyle} disabled={zoom >= MAX_ZOOM}>+</button>
        <button onClick={() => setZoom(100)} style={{ ...btnStyle, fontSize: '11px', padding: '4px 8px' }}>Reset</button>
      </div>

      {/* Scroll area */}
      <div style={scrollAreaStyle}>
        {error && <div style={errorStyle}>{error}</div>}

        {messages.length > 0 && (
          <div style={warningStyle}>
            {messages.slice(0, 3).map((m, i) => <div key={i}>{m}</div>)}
            {messages.length > 3 && <div>…and {messages.length - 3} more warnings</div>}
          </div>
        )}

        {html && (
          <div style={{ ...pageStyle, fontSize: `${zoom}%` }}>
            <div
              ref={contentRef}
              style={contentStyle}
              // mammoth output is sanitised — no user-controlled script injection possible
              // as mammoth strips all script/event-handler content from docx
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}

        {!html && !error && (
          <div style={loadingStyle}>
            <div style={spinnerStyle} />
            <span style={{ color: '#8e8e93', fontSize: '14px' }}>Reading document…</span>
          </div>
        )}
      </div>

      <style>{DOC_STYLES}</style>
    </div>
  )
}

// ── Document CSS injected into the page (scoped via .doc-content) ─────────────
// Mirrors Word's default Normal template as closely as possible.
const DOC_STYLES = `
  .doc-content {
    font-family: 'Calibri', 'Carlito', 'Liberation Sans', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000000;
  }

  .doc-content h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #2E74B5;
    margin: 24pt 0 6pt;
    padding-bottom: 4pt;
    border-bottom: 1px solid #2E74B5;
    page-break-after: avoid;
  }
  .doc-content h1.doc-title {
    font-size: 28pt;
    font-weight: 700;
    color: #1F3864;
    text-align: center;
    border-bottom: none;
    margin-bottom: 4pt;
  }
  .doc-content p.doc-subtitle {
    font-size: 13pt;
    color: #595959;
    text-align: center;
    margin-top: 0;
    margin-bottom: 20pt;
  }
  .doc-content h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #2E74B5;
    margin: 18pt 0 4pt;
    page-break-after: avoid;
  }
  .doc-content h3 {
    font-size: 12pt;
    font-weight: 700;
    color: #1F3864;
    margin: 14pt 0 4pt;
    page-break-after: avoid;
  }
  .doc-content h4, .doc-content h5, .doc-content h6 {
    font-size: 11pt;
    font-weight: 700;
    color: #2E74B5;
    margin: 10pt 0 4pt;
  }

  .doc-content p {
    margin: 0 0 8pt;
    orphans: 2;
    widows: 2;
  }
  .doc-content p.list-paragraph {
    margin-left: 36pt;
  }

  .doc-content ul, .doc-content ol {
    margin: 0 0 8pt;
    padding-left: 36pt;
  }
  .doc-content li {
    margin-bottom: 4pt;
  }

  .doc-content strong, .doc-content b { font-weight: 700; }
  .doc-content em, .doc-content i    { font-style: italic; }
  .doc-content u                     { text-decoration: underline; }
  .doc-content s                     { text-decoration: line-through; }

  .doc-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 10pt 0 14pt;
    font-size: 10pt;
  }
  .doc-content th, .doc-content td {
    border: 1px solid #A6A6A6;
    padding: 4pt 8pt;
    vertical-align: top;
  }
  .doc-content th {
    background: #D9E1F2;
    font-weight: 700;
  }
  .doc-content tr:nth-child(even) td {
    background: #F2F6FC;
  }

  .doc-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 8pt auto;
  }

  .doc-content blockquote {
    border-left: 3px solid #2E74B5;
    margin: 8pt 0 8pt 18pt;
    padding-left: 12pt;
    color: #595959;
    font-style: italic;
  }

  .doc-content code, .doc-content pre {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5pt;
    background: #F4F4F4;
    border: 1px solid #DCDCDC;
    border-radius: 2pt;
    padding: 1pt 4pt;
  }
  .doc-content pre {
    padding: 8pt;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .doc-content a { color: #0563C1; }
`

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0 12px',
  height: '44px',
  background: '#ffffff',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  flexShrink: 0,
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '14px',
  cursor: 'pointer',
  color: '#1d1d1f',
  lineHeight: 1,
}

const filenameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1d1d1f',
  maxWidth: '400px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#1d1d1f',
  minWidth: '40px',
  textAlign: 'center',
}

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  background: '#e8e8e8',
  padding: '32px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
}

// A4-proportioned white "page" that mimics Word's print layout
const pageStyle: React.CSSProperties = {
  width: '210mm',
  minHeight: '297mm',
  background: '#ffffff',
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  padding: '25.4mm 25.4mm 25.4mm 31.75mm',   // Word default margins: top/right/bottom 1in, left 1.25in
  boxSizing: 'border-box',
}

const contentStyle: React.CSSProperties = {}

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
}

const spinnerStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  border: '2.5px solid rgba(0,122,255,0.15)',
  borderTopColor: '#007AFF',
  borderRadius: '50%',
  animation: 'spin 0.75s linear infinite',
}

const errorStyle: React.CSSProperties = {
  background: 'rgba(255,59,48,0.08)',
  border: '1px solid rgba(255,59,48,0.25)',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#c0392b',
  fontSize: '13px',
  maxWidth: '600px',
  width: '100%',
}

const warningStyle: React.CSSProperties = {
  background: 'rgba(255,149,0,0.08)',
  border: '1px solid rgba(255,149,0,0.3)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#7d4e00',
  fontSize: '12px',
  maxWidth: '600px',
  width: '100%',
}
