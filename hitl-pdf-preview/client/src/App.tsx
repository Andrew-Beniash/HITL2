import { useCallback } from 'react'
import { useConvert } from './hooks/useConvert'
import { UploadZone } from './components/UploadZone'
import { EpubViewer } from './components/EpubViewer'

export default function App() {
  const { status, epubUrl, filename, errorMessage, convert, reset } = useConvert()

  const handleFile = useCallback((file: File) => { convert(file) }, [convert])
  const showViewer = status === 'success' && epubUrl !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f7' }}>
      {showViewer ? (
        <EpubViewer epubUrl={epubUrl} filename={filename} onOpenNew={reset} onFile={handleFile} />
      ) : (
        <UploadZone
          onFile={handleFile}
          isConverting={status === 'converting'}
          errorMessage={errorMessage}
        />
      )}
    </div>
  )
}
