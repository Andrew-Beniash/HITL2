import { useState, useCallback } from 'react'
import { useConvert } from './hooks/useConvert'
import { UploadZone } from './components/UploadZone'
import { EpubViewer } from './components/EpubViewer'
import { PdfViewer } from './components/PdfViewer'
import { ExcelViewer } from './components/ExcelViewer'
import { WordViewer } from './components/WordViewer'

function fileType(file: File): 'pdf' | 'excel' | 'word' | 'epub-md' {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel'
  if (name.endsWith('.docx')) return 'word'
  return 'epub-md'
}

export default function App() {
  const { status, epubUrl, filename, errorMessage, convert, reset } = useConvert()
  const [nativeFile, setNativeFile] = useState<{ file: File; type: 'pdf' | 'excel' | 'word' } | null>(null)

  const handleFile = useCallback((file: File) => {
    const type = fileType(file)
    if (type === 'pdf' || type === 'excel' || type === 'word') {
      reset()
      setNativeFile({ file, type })
    } else {
      setNativeFile(null)
      convert(file)
    }
  }, [convert, reset])

  const handleOpenNew = useCallback(() => {
    reset()
    setNativeFile(null)
  }, [reset])

  // Native PDF viewer
  if (nativeFile?.type === 'pdf') {
    return (
      <div style={rootStyle}>
        <PdfViewer file={nativeFile.file} onOpenNew={handleOpenNew} />
      </div>
    )
  }

  // Native Excel viewer
  if (nativeFile?.type === 'excel') {
    return (
      <div style={rootStyle}>
        <ExcelViewer file={nativeFile.file} onOpenNew={handleOpenNew} />
      </div>
    )
  }

  // Native Word viewer
  if (nativeFile?.type === 'word') {
    return (
      <div style={rootStyle}>
        <WordViewer file={nativeFile.file} onOpenNew={handleOpenNew} />
      </div>
    )
  }

  // EPUB / Markdown (server-converted)
  if (status === 'success' && epubUrl !== null) {
    return (
      <div style={rootStyle}>
        <EpubViewer epubUrl={epubUrl} filename={filename} onOpenNew={handleOpenNew} onFile={handleFile} />
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      <UploadZone
        onFile={handleFile}
        isConverting={status === 'converting'}
        errorMessage={errorMessage}
      />
    </div>
  )
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#f5f5f7',
}
