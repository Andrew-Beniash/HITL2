import { ChangeEvent } from 'react'

interface Props {
  filename: string | null
  currentChapter: number
  totalChapters: number
  zoomPercent: number
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onOpenNew: () => void
  onFile: (file: File) => void
  isLoaded: boolean
}

const INPUT_ID = 'toolbar-file-input'

export function Toolbar({
  filename,
  currentChapter,
  totalChapters,
  zoomPercent,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenNew,
  onFile,
  isLoaded,
}: Props) {
  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { onFile(file); onOpenNew() }
    e.target.value = ''
  }

  return (
    <div style={toolbarStyle}>
      {/* Hidden file input for toolbar "Open" */}
      <input
        id={INPUT_ID}
        type="file"
        accept="application/pdf,.pdf,text/markdown,.md,.markdown,application/epub+zip,.epub"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        onChange={handleInputChange}
      />

      {/* Open button — pill label */}
      <label htmlFor={INPUT_ID} style={openBtnStyle} title="Open another document">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        Open
      </label>

      {/* Filename */}
      {filename && (
        <span style={filenameStyle} title={filename}>
          {filename.replace(/\.(pdf|md|markdown|epub)$/i, '')}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Navigation + zoom */}
      {isLoaded && (
        <>
          <div style={groupStyle}>
            <IconBtn onClick={onPrev} disabled={currentChapter <= 1} title="Previous (←)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </IconBtn>

            <span style={pageInfoStyle}>
              {currentChapter}
              <span style={{ color: '#aeaeb2', margin: '0 3px' }}>/</span>
              {totalChapters}
            </span>

            <IconBtn onClick={onNext} disabled={currentChapter >= totalChapters} title="Next (→)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </IconBtn>
          </div>

          <div style={sepStyle} />

          <div style={groupStyle}>
            <IconBtn onClick={onZoomOut} disabled={zoomPercent <= 50} title="Zoom out (−)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </IconBtn>

            <button style={zoomLabelStyle} onClick={onZoomReset} title="Reset zoom (0)">
              {zoomPercent}%
            </button>

            <IconBtn onClick={onZoomIn} disabled={zoomPercent >= 200} title="Zoom in (+)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </IconBtn>
          </div>
        </>
      )}
    </div>
  )
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...iconBtnBase,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '0 16px',
  height: '50px',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  flexShrink: 0,
  position: 'relative',
  zIndex: 10,
}

const openBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  background: '#007AFF',
  color: '#fff',
  borderRadius: '980px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
  letterSpacing: '-0.01em',
  fontFamily: 'inherit',
  transition: 'filter 0.15s',
}

const filenameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#3c3c43',
  maxWidth: '280px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginLeft: '6px',
}

const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
}

const sepStyle: React.CSSProperties = {
  width: '1px',
  height: '18px',
  background: 'rgba(0,0,0,0.1)',
  margin: '0 8px',
}

const pageInfoStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#1d1d1f',
  minWidth: '56px',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#6e6e73',
  minWidth: '44px',
  textAlign: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '4px 6px',
  borderRadius: '6px',
  fontVariantNumeric: 'tabular-nums',
}

const iconBtnBase: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#3c3c43',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  transition: 'background 0.12s',
}
