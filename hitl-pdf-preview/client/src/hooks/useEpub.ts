import { useState, useRef, useCallback, useEffect } from 'react'
import Epub, { Book, Rendition } from 'epubjs'
import type { ViewerState, SpineItem } from '../types'

const DEFAULT_ZOOM = 100

export function useEpub(containerRef: React.RefObject<HTMLDivElement | null>) {
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const [state, setState] = useState<ViewerState>({
    isLoaded: false,
    currentChapter: 1,
    totalChapters: 0,
    chapterTitles: [],
    zoomPercent: DEFAULT_ZOOM,
    errorMessage: null,
  })
  const [spineItems, setSpineItems] = useState<SpineItem[]>([])

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async (epubUrl: string) => {
    // Destroy previous book
    if (bookRef.current) {
      bookRef.current.destroy()
      bookRef.current = null
      renditionRef.current = null
    }

    setSpineItems([])
    setState({
      isLoaded: false,
      currentChapter: 1,
      totalChapters: 0,
      chapterTitles: [],
      zoomPercent: DEFAULT_ZOOM,
      errorMessage: null,
    })

    try {
      const book = Epub(epubUrl, { openAs: 'epub' })
      bookRef.current = book

      await book.ready

      const items: SpineItem[] = []
      const spineArr = (book.spine as unknown as { items: Array<{ href: string; index: number }> }).items ?? []

      let tocMap: Record<string, string> = {}
      try {
        const nav = await book.loaded.navigation
        const flatten = (items: Array<{ href: string; label: string; subitems?: unknown[] }>): void => {
          items.forEach(item => {
            tocMap[item.href] = item.label.trim()
            if (item.subitems) flatten(item.subitems as typeof items)
          })
        }
        flatten(nav.toc as Array<{ href: string; label: string; subitems?: unknown[] }>)
      } catch {
        // nav may not be available; fall back to index labels
      }

      spineArr.forEach((item, i) => {
        const label = tocMap[item.href] ?? `Chapter ${i + 1}`
        items.push({ href: item.href, label, index: i })
      })

      const contentItems = items.filter(it => !it.href.includes('nav'))
      setSpineItems(contentItems)

      if (!containerRef.current) {
        throw new Error('Viewer container is not available.')
      }

      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'scrolled-doc',
        spread: 'none',
      })
      renditionRef.current = rendition

      const firstHref = contentItems[0]?.href ?? undefined
      await rendition.display(firstHref)

      rendition.on('relocated', (location: { start: { index: number } }) => {
        const spineIdx = location.start.index
        const ci = contentItems.findIndex(it => it.index === spineIdx)
        setState(prev => ({
          ...prev,
          currentChapter: ci >= 0 ? ci + 1 : prev.currentChapter,
        }))
      })

      setState({
        isLoaded: true,
        currentChapter: 1,
        totalChapters: contentItems.length,
        chapterTitles: contentItems.map(it => it.label),
        zoomPercent: DEFAULT_ZOOM,
        errorMessage: null,
      })
    } catch (error: unknown) {
      bookRef.current?.destroy()
      bookRef.current = null
      renditionRef.current = null
      setSpineItems([])
      setState({
        isLoaded: false,
        currentChapter: 1,
        totalChapters: 0,
        chapterTitles: [],
        zoomPercent: DEFAULT_ZOOM,
        errorMessage: error instanceof Error ? error.message : 'Failed to load EPUB.',
      })
    }
  }, [containerRef])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToChapter = useCallback((index: number) => {
    const item = spineItems[index]
    if (item && renditionRef.current) {
      renditionRef.current.display(item.href)
    }
  }, [spineItems])

  const nextChapter = useCallback(() => {
    goToChapter(state.currentChapter)   // currentChapter is 1-based → index = currentChapter
  }, [state.currentChapter, goToChapter])

  const prevChapter = useCallback(() => {
    goToChapter(state.currentChapter - 2) // go to (currentChapter - 1) → index
  }, [state.currentChapter, goToChapter])

  // ── Zoom ───────────────────────────────────────────────────────────────────

  const setZoom = useCallback((percent: number) => {
    const clamped = Math.max(50, Math.min(200, percent))
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${clamped}%`)
    }
    setState(prev => ({ ...prev, zoomPercent: clamped }))
  }, [])

  const zoomIn  = useCallback(() => setZoom(state.zoomPercent + 10), [state.zoomPercent, setZoom])
  const zoomOut = useCallback(() => setZoom(state.zoomPercent - 10), [state.zoomPercent, setZoom])
  const zoomReset = useCallback(() => setZoom(DEFAULT_ZOOM), [setZoom])

  // ── Keyboard shortcuts (Functional Spec §7.2) ──────────────────────────────
  useEffect(() => {
    if (!state.isLoaded) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' || e.key === ']') nextChapter()
      if (e.key === 'ArrowLeft'  || e.key === '[') prevChapter()
      if (e.key === '+'  || e.key === '=') zoomIn()
      if (e.key === '-')  zoomOut()
      if (e.key === '0')  zoomReset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.isLoaded, nextChapter, prevChapter, zoomIn, zoomOut, zoomReset])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { bookRef.current?.destroy() }
  }, [])

  return {
    state,
    spineItems,
    load,
    goToChapter,
    nextChapter,
    prevChapter,
    zoomIn,
    zoomOut,
    zoomReset,
  }
}
