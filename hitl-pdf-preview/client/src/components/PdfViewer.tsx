import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Worker is served from /public so it runs in a separate thread without being
// bundled into the main chunk. Copy is at public/pdf.worker.min.mjs.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface Props {
  file: File
  onOpenNew: () => void
}

const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 15

export function PdfViewer({ file, onOpenNew }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Keep one canvas element per page (keyed by page number)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map())

  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, scale: number) => {
    const canvas = canvasRefs.current.get(pageNum)
    if (!canvas) return

    // Cancel any in-flight render for this page
    renderTasksRef.current.get(pageNum)?.cancel()

    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale / 100 })
    const ctx = canvas.getContext('2d')!

    // Use device pixel ratio for crisp rendering on HiDPI screens
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    ctx.scale(dpr, dpr)

    const task = page.render({ canvas, canvasContext: ctx, viewport })
    renderTasksRef.current.set(pageNum, task)
    try {
      await task.promise
    } catch (e: unknown) {
      // RenderingCancelledException is expected when zoom changes rapidly
      if (e instanceof Error && e.name !== 'RenderingCancelledException') throw e
    }
  }, [])

  // Load PDF from File
  useEffect(() => {
    let cancelled = false
    setError(null)
    setNumPages(0)
    canvasRefs.current.clear()

    file.arrayBuffer().then(buf => {
      if (cancelled) return
      return pdfjsLib.getDocument({ data: buf }).promise
    }).then(pdf => {
      if (!pdf || cancelled) return
      pdfRef.current = pdf
      setNumPages(pdf.numPages)
    }).catch(err => {
      if (!cancelled) setError(`Failed to load PDF: ${err?.message ?? err}`)
    })

    return () => { cancelled = true; pdfRef.current?.destroy(); pdfRef.current = null }
  }, [file])

  // Re-render all pages when numPages or zoom changes
  useEffect(() => {
    if (!pdfRef.current || numPages === 0) return
    const pdf = pdfRef.current
    for (let i = 1; i <= numPages; i++) {
      renderPage(pdf, i, zoom)
    }
  }, [numPages, zoom, renderPage])

  const changeZoom = (delta: number) => {
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === '+' || e.key === '=') changeZoom(ZOOM_STEP)
      if (e.key === '-') changeZoom(-ZOOM_STEP)
      if (e.key === '0') setZoom(100)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <button onClick={onOpenNew} style={btnStyle} title="Open another file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>

        <span style={filenameStyle}>{file.name}</span>
        <span style={pageCountStyle}>{numPages > 0 ? `${numPages} pages` : ''}</span>

        <div style={{ flex: 1 }} />

        <button onClick={() => changeZoom(-ZOOM_STEP)} style={btnStyle} disabled={zoom <= MIN_ZOOM}>−</button>
        <span style={zoomLabelStyle}>{zoom}%</span>
        <button onClick={() => changeZoom(ZOOM_STEP)} style={btnStyle} disabled={zoom >= MAX_ZOOM}>+</button>
        <button onClick={() => setZoom(100)} style={{ ...btnStyle, fontSize: '11px', padding: '4px 8px' }}>Reset</button>
      </div>

      {/* Pages */}
      <div ref={containerRef} style={scrollAreaStyle}>
        {error && (
          <div style={errorStyle}>{error}</div>
        )}
        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
          <div key={pageNum} style={pageWrapStyle}>
            <canvas
              ref={el => {
                if (el) canvasRefs.current.set(pageNum, el)
                else canvasRefs.current.delete(pageNum)
              }}
              style={canvasStyle}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

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
  maxWidth: '300px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const pageCountStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#8e8e93',
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
  background: '#525659',
  padding: '24px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
}

const pageWrapStyle: React.CSSProperties = {
  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  background: '#fff',
  lineHeight: 0,
}

const canvasStyle: React.CSSProperties = {
  display: 'block',
}

const errorStyle: React.CSSProperties = {
  background: 'rgba(255,59,48,0.1)',
  border: '1px solid rgba(255,59,48,0.3)',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#ff3b30',
  fontSize: '14px',
  maxWidth: '480px',
}
