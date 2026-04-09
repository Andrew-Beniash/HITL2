import { useRef, useEffect } from 'react'
import { useEpub } from '../hooks/useEpub'
import { ThumbnailSidebar } from './ThumbnailSidebar'
import { Toolbar } from './Toolbar'

interface Props {
  epubUrl: string
  filename: string | null
  onOpenNew: () => void
  onFile: (file: File) => void
}

export function EpubViewer({ epubUrl, filename, onOpenNew, onFile }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    state,
    spineItems,
    load,
    goToChapter,
    nextChapter,
    prevChapter,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useEpub(containerRef)

  useEffect(() => {
    if (epubUrl) load(epubUrl)
  }, [epubUrl, load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        filename={filename}
        currentChapter={state.currentChapter}
        totalChapters={state.totalChapters}
        zoomPercent={state.zoomPercent}
        onPrev={prevChapter}
        onNext={nextChapter}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onOpenNew={onOpenNew}
        onFile={onFile}
        isLoaded={state.isLoaded}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {state.isLoaded && (
          <ThumbnailSidebar
            items={spineItems}
            currentChapter={state.currentChapter}
            onSelect={goToChapter}
          />
        )}

        {/* EPUB render area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f5f5f7' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {/* Loading state */}
          {!state.isLoaded && !state.errorMessage && (
            <div style={loadingStyle}>
              <div style={spinnerStyle} />
              <p style={{ fontSize: '14px', color: '#8e8e93', marginTop: '14px', fontWeight: 400 }}>
                Loading document…
              </p>
            </div>
          )}

          {state.errorMessage && (
            <div style={errorStyle}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                Could not open this EPUB
              </p>
              <p style={{ fontSize: '13px', color: '#6e6e73', margin: '8px 0 0' }}>
                {state.errorMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const loadingStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f5f5f7',
}

const spinnerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '2.5px solid rgba(0,122,255,0.15)',
  borderTopColor: '#007AFF',
  borderRadius: '50%',
  animation: 'spin 0.75s linear infinite',
}

const errorStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  textAlign: 'center',
  background: '#f5f5f7',
}
