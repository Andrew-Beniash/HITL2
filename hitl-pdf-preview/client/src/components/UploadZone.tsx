import { useState, DragEvent, ChangeEvent } from 'react'

interface Props {
  onFile: (file: File) => void
  isConverting: boolean
  errorMessage: string | null
}

const INPUT_ID = 'pdf-file-input'

export function UploadZone({ onFile, isConverting, errorMessage }: Props) {
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    const lower = file.name.toLowerCase()
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf'
    const isMarkdown = lower.endsWith('.md') || lower.endsWith('.markdown') || file.type === 'text/markdown'
    const isEpub = lower.endsWith('.epub') || file.type === 'application/epub+zip'
    const isExcel =
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel'
    if (!isPdf && !isMarkdown && !isEpub && !isExcel) return
    onFile(file)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div
      style={wrapStyle}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Hidden file input — triggered reliably via <label> */}
      <input
        id={INPUT_ID}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx,.xls,text/markdown,.md,.markdown,application/epub+zip,.epub"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        onChange={onInputChange}
        disabled={isConverting}
      />

      {/* Header */}
      <div style={headerStyle}>
        <div style={iconWrapStyle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <h1 style={titleStyle}>Document Preview</h1>
        <p style={subtitleStyle}>Open a PDF, Excel, Markdown, or EPUB file to get started</p>
      </div>

      {/* Drop card */}
      <label
        htmlFor={INPUT_ID}
        style={{
          ...dropCardStyle,
          ...(dragging ? dropCardDraggingStyle : {}),
          cursor: isConverting ? 'default' : 'pointer',
          pointerEvents: isConverting ? 'none' : 'auto',
        }}
      >
        {isConverting ? (
          <div style={convertingContentStyle}>
            <div style={spinnerStyle} />
            <p style={dropMainTextStyle}>Converting document…</p>
            <p style={dropSubTextStyle}>Extracting text and building EPUB structure</p>
          </div>
        ) : (
          <div style={dropContentStyle}>
            <div style={dropIconStyle}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragging ? '#007AFF' : '#8e8e93'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={{ ...dropMainTextStyle, color: dragging ? '#007AFF' : '#1d1d1f' }}>
              {dragging ? 'Drop to open' : 'Drop PDF, Excel, Markdown, or EPUB here'}
            </p>
            <p style={dropSubTextStyle}>or click to browse your files</p>
          </div>
        )}
      </label>

      {/* Open button — separate label so it works independently */}
      {!isConverting && (
        <label htmlFor={INPUT_ID} style={openBtnStyle}>
          Choose File…
        </label>
      )}

      {/* Error */}
      {errorMessage && (
        <div style={errorBoxStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', marginBottom: '2px' }}>
              Conversion failed
            </p>
            <p style={{ fontSize: '12px', color: '#6e6e73', lineHeight: 1.4 }}>{errorMessage}</p>
          </div>
        </div>
      )}

      <p style={hintStyle}>PDF, Excel (.xlsx/.xls), and Markdown convert to EPUB · Native EPUB opens directly</p>
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const wrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: '16px',
  padding: '48px 32px',
  background: '#f5f5f7',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
}

const iconWrapStyle: React.CSSProperties = {
  width: '56px',
  height: '56px',
  background: 'rgba(0,122,255,0.1)',
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '4px',
}

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  color: '#1d1d1f',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#6e6e73',
  fontWeight: 400,
}

const dropCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  maxWidth: '420px',
  minHeight: '200px',
  background: '#ffffff',
  border: '1.5px dashed rgba(0,0,0,0.15)',
  borderRadius: '20px',
  padding: '40px 32px',
  transition: 'all 0.18s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  userSelect: 'none',
}

const dropCardDraggingStyle: React.CSSProperties = {
  borderColor: '#007AFF',
  background: 'rgba(0,122,255,0.04)',
  boxShadow: '0 0 0 4px rgba(0,122,255,0.12), 0 4px 16px rgba(0,0,0,0.08)',
}

const dropContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
}

const convertingContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
}

const dropIconStyle: React.CSSProperties = {
  width: '52px',
  height: '52px',
  background: '#f5f5f7',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '4px',
}

const dropMainTextStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#1d1d1f',
  transition: 'color 0.18s',
}

const dropSubTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#8e8e93',
  fontWeight: 400,
}

const openBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 24px',
  background: '#007AFF',
  color: '#ffffff',
  borderRadius: '980px',   // Apple's pill button
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
  letterSpacing: '-0.01em',
  boxShadow: '0 1px 3px rgba(0,122,255,0.3)',
  transition: 'filter 0.15s',
  fontFamily: 'inherit',
}

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
  padding: '14px 16px',
  background: 'rgba(255,59,48,0.06)',
  border: '1px solid rgba(255,59,48,0.2)',
  borderRadius: '12px',
  maxWidth: '420px',
  width: '100%',
  animation: 'fadeIn 0.2s ease',
}

const spinnerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '2.5px solid rgba(0,122,255,0.15)',
  borderTopColor: '#007AFF',
  borderRadius: '50%',
  animation: 'spin 0.75s linear infinite',
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#aeaeb2',
  fontWeight: 400,
}
