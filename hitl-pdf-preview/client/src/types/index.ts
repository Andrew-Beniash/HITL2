/** Conversion state managed by useConvert hook */
export type ConversionStatus = 'idle' | 'converting' | 'success' | 'error'

export interface ConversionState {
  status: ConversionStatus
  epubUrl: string | null
  filename: string | null
  errorMessage: string | null
  sourceType: 'pdf' | 'md' | 'epub' | null
}

/** epub.js viewer state managed by useEpub hook */
export interface ViewerState {
  isLoaded: boolean
  currentChapter: number   // 1-based
  totalChapters: number
  chapterTitles: string[]
  zoomPercent: number      // 100 = default
  errorMessage: string | null
}

export interface SpineItem {
  href: string
  label: string
  index: number
}
