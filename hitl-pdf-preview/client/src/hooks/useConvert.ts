import { useState, useCallback } from 'react'
import ky from 'ky'
import type { ConversionState } from '../types'

const API_BASE = '/api'

function isEpubFile(file: File) {
  return file.name.toLowerCase().endsWith('.epub') || file.type === 'application/epub+zip'
}

function isMarkdownFile(file: File) {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || file.type === 'text/markdown'
}

/** Uploads a PDF/Markdown file to /api/convert or opens a native EPUB directly. */
export function useConvert() {
  const [state, setState] = useState<ConversionState>({
    status: 'idle',
    epubUrl: null,
    filename: null,
    errorMessage: null,
    sourceType: null,
  })

  const convert = useCallback(async (file: File) => {
    // Revoke any previous blob URL to free memory
    if (state.epubUrl) {
      URL.revokeObjectURL(state.epubUrl)
    }

    if (isEpubFile(file)) {
      const epubUrl = URL.createObjectURL(file)
      setState({
        status: 'success',
        epubUrl,
        filename: file.name,
        errorMessage: null,
        sourceType: 'epub',
      })
      return
    }

    setState({
      status: 'converting',
      epubUrl: null,
      filename: file.name,
      errorMessage: null,
      sourceType: isMarkdownFile(file) ? 'md' : 'pdf',
    })

    try {
      const form = new FormData()
      form.append('file', file)

      const blob = await ky.post(`${API_BASE}/convert`, { body: form }).blob()

      const epubUrl = URL.createObjectURL(blob)
      setState({
        status: 'success',
        epubUrl,
        filename: file.name,
        errorMessage: null,
        sourceType: isMarkdownFile(file) ? 'md' : 'pdf',
      })
    } catch (err: unknown) {
      let message = 'Conversion failed. Please try again.'

      if (err instanceof Error) {
        // ky wraps HTTP errors — try to read the JSON body
        const httpErr = err as Error & { response?: Response }
        if (httpErr.response) {
          try {
            const body = await httpErr.response.json() as { detail?: string }
            if (body.detail) message = body.detail
            else if (httpErr.response.status === 413) message = 'File is too large (max 50 MB).'
            else if (httpErr.response.status === 415) message = 'Only PDF, Excel (.xlsx/.xls), and Markdown files are supported.'
            else if (httpErr.response.status === 400) message = isMarkdownFile(file)
              ? 'Could not read this Markdown file.'
              : 'Could not read this PDF. It may be scanned or corrupted.'
          } catch {
            message = `Server error ${httpErr.response.status}`
          }
        } else {
          message = 'Cannot reach the conversion server. Is it running on port 8000?'
        }
      }

      setState({
        status: 'error',
        epubUrl: null,
        filename: file.name,
        errorMessage: message,
        sourceType: isMarkdownFile(file) ? 'md' : 'pdf',
      })
    }
  }, [state.epubUrl])

  const reset = useCallback(() => {
    if (state.epubUrl) URL.revokeObjectURL(state.epubUrl)
    setState({ status: 'idle', epubUrl: null, filename: null, errorMessage: null, sourceType: null })
  }, [state.epubUrl])

  return { ...state, convert, reset }
}
