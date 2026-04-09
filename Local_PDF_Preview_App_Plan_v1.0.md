# Local PDF Preview Web App — Development Plan

**Status:** Ready for Development
**Version:** 1.0
**Date:** April 2026
**Relates to:** Functional Specification v1.2 · Technical Architecture Specification v1.0 · Implementation Plan v1.0
**Purpose:** Define the minimal local application that proves the PDF preview stack before the full HITL module is built

---

## 1. Purpose & Scope

### Why This App Exists

The full HITL module is a complex multi-service system. Before committing to that scope, this local app validates the most critical and highest-risk piece of the architecture: **the PDF-to-EPUB conversion and EPUB rendering pipeline**.

Every other feature in the HITL module (annotations, AI interaction, collaboration) depends on the viewer rendering faithfully. If conversion fidelity or epub.js integration has gaps, it is far better to discover that now.

### What This App Is

A locally-runnable, two-process web application:

- A **Python FastAPI server** that accepts a PDF file upload and returns an EPUB file — using the exact same libraries specified in the architecture document (`pdfminer.six`, `ebooklib`)
- A **React + Vite frontend** that renders the EPUB using `epub.js` — the same renderer used in the full module

### What This App Is Not

- It is not the full HITL module
- It does not implement annotations, AI interaction, collaboration, auth, or a database
- It is not production-ready; there is no multi-tenancy, no audit trail, no S3 storage

### Relationship to the Spec

| Spec Component | Local App Coverage |
|---|---|
| §5.1.1 PDF display format | ✅ PDF → EPUB → epub.js viewer |
| §5.1.2 Preview pane capabilities | ✅ Zoom, page navigation, thumbnail strip |
| §5.1.4 Font configuration | ✅ Hardcoded Inter font (same defaults as spec) |
| §3.1 Tech stack (frontend) | ✅ React 19, Vite 6, TypeScript 5, epub.js |
| §3.2 Tech stack (backend) | ✅ Python 3.12, FastAPI, pdfminer.six, ebooklib |
| §5.2 Attention guidance | ❌ Out of scope for local app |
| §5.3 AI interaction | ❌ Out of scope for local app |
| §5.4 Human collaboration | ❌ Out of scope for local app |
| §5.7 Audit trail | ❌ Out of scope for local app |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (localhost:5173)                │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              React + Vite Frontend                  │ │
│  │                                                     │ │
│  │  ┌───────────┐   ┌───────────────────────────────┐ │ │
│  │  │  Upload   │   │   EPUB Viewer (epub.js)        │ │ │
│  │  │  Drop Zone│   │                               │ │ │
│  │  └───────────┘   │  ┌───────────┐ ┌──────────┐  │ │ │
│  │                  │  │ Thumbnail │ │  Main    │  │ │ │
│  │                  │  │ Sidebar   │ │  Pane    │  │ │ │
│  │                  │  └───────────┘ └──────────┘  │ │ │
│  │                  └───────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
               │  POST /convert  (multipart PDF)
               │  ← returns EPUB blob
               ▼
┌──────────────────────────────────────────────────────────┐
│              Python FastAPI Server (localhost:8000)        │
│                                                           │
│   POST /convert                                           │
│   ├── pdfminer.six  → extract text, layout, images       │
│   ├── ebooklib      → package as valid EPUB3             │
│   └── return EPUB as application/epub+zip               │
│                                                           │
│   GET /health  →  { "status": "ok" }                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Technology Choices

All choices are taken directly from the architecture specification to ensure zero rework when the local app is integrated into the full module.

### Backend

| Component | Library | Spec Reference |
|---|---|---|
| Runtime | Python 3.12 | Architecture §3.2 |
| Web framework | FastAPI 0.115 | Architecture §3.2 |
| ASGI server | Uvicorn | Architecture §3.2 |
| PDF text extraction | pdfminer.six | Architecture §3.2 |
| EPUB construction | ebooklib 0.18 | Architecture §3.2 |
| CORS | fastapi.middleware.cors | Required for localhost dev |

### Frontend

| Component | Library | Spec Reference |
|---|---|---|
| Build tool | Vite 6 | Architecture §3.1 |
| Framework | React 19 + TypeScript 5 | Architecture §3.1 |
| EPUB renderer | epub.js 0.3.x | Architecture §3.1, §4.2 |
| HTTP client | ky 1.x | Architecture §3.1 |
| Styling | Tailwind CSS 4 | Architecture §3.1 |
| State | useState / useReducer (no Zustand yet) | Simplified for local app |

---

## 4. Phased Implementation Plan

### Phase 1 — Python Conversion Server

**Goal:** A FastAPI server that converts an uploaded PDF file to a valid EPUB3 and returns it.

**Files to create:**
```
server/
  main.py             # FastAPI app, CORS, /health, /convert
  converter.py        # PDF extraction and EPUB assembly logic
  pyproject.toml      # Poetry config with all dependencies
  requirements.txt    # Pip fallback
```

**`POST /convert` contract:**
- **Request:** `multipart/form-data` with field `file` containing the PDF
- **Response:** `application/epub+zip` binary body (inline EPUB file)
- **Error responses:**
  - `400` — file is not a valid PDF
  - `413` — file exceeds 50 MB limit
  - `500` — conversion failed (with `{ "detail": "..." }` body)

**Conversion logic (converter.py):**

1. **Extract with pdfminer:** Use `PDFPage`, `PDFPageInterpreter`, and `PDFConverter` to extract text per page. Group pages into EPUB chapters (one chapter per 10 pages for long documents; single chapter for ≤ 10 pages).

2. **Preserve structure:** Extract heading candidates by font size comparison. Wrap body text in `<p>` elements; wrap candidates in `<h2>` or `<h3>`.

3. **Build EPUB with ebooklib:**
   - Create `epub.EpubBook` with metadata (title from PDF metadata or filename, language `en`)
   - One `EpubHtml` item per chapter
   - Apply the platform default stylesheet (Inter font, 1.6 line-height, matching `font.body.*` defaults from spec §5.1.4)
   - Add `EpubNcx` and `EpubNav` for chapter navigation
   - Write to an in-memory `BytesIO` buffer and return

**Acceptance criteria:**
- `curl -F "file=@sample.pdf" http://localhost:8000/convert --output out.epub` produces a valid EPUB
- The returned EPUB opens correctly in epub.js
- `/health` returns `{ "status": "ok", "version": "0.1.0" }`
- Files larger than 50 MB are rejected with HTTP 413

---

### Phase 2 — React Frontend Shell

**Goal:** A Vite + React + TypeScript project with routing, layout, and the upload flow.

**Files to create:**
```
client/
  index.html
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  src/
    main.tsx
    App.tsx
    components/
      UploadZone.tsx      # Drag-and-drop + file picker, calls /convert
      Toolbar.tsx         # Navigation controls, zoom, filename
      EpubViewer.tsx      # epub.js integration
      ThumbnailSidebar.tsx # Chapter thumbnails for navigation
    hooks/
      useConvert.ts       # ky POST to /convert, returns blob URL
      useEpub.ts          # epub.js Book lifecycle management
    types/
      index.ts            # ConversionState, ViewerState types
```

**Layout (matching §7 UX Layout Principles):**
```
┌──────────────────────────────────────┐
│              TOOLBAR                  │
│  [Open] [filename]  ‹ 2/14 ›  − 100% +│
├──────────────┬───────────────────────┤
│  THUMBNAIL   │                       │
│  SIDEBAR     │   EPUB VIEWER         │
│  (chapters)  │   (epub.js iframe)    │
│              │                       │
└──────────────┴───────────────────────┘
```

**Key component behaviour:**

- `UploadZone` — shown when no document is loaded; accepts PDF via `<input>` or drag-and-drop anywhere on the page; shows a progress spinner while `/convert` is running; on success hands the EPUB blob URL to `EpubViewer`

- `EpubViewer` — initialises an `epub.Book` from the blob URL; renders into a sandboxed `<div>` using `epub.js`'s `Rendition`; exposes `display(cfi)`, `next()`, `prev()`, `currentLocation()` via the `useEpub` hook

- `ThumbnailSidebar` — iterates the spine items from the loaded `epub.Book`; renders each chapter title with its index; highlights the active chapter; clicking calls `rendition.display(href)`

- `Toolbar` — shows current chapter index / total, prev/next buttons, zoom controls (`rendition.themes.fontSize()`), and the filename; "Open" button reopens the upload flow

**Acceptance criteria:**
- Uploading a PDF triggers the spinner, then renders the EPUB in the viewer
- Chapter navigation works (prev/next and sidebar click)
- Zoom in/out changes text size without reloading
- The active chapter is highlighted in the sidebar
- Dropping a PDF on the window opens it

---

### Phase 3 — Polish & Developer Experience

**Goal:** Make the app reliable and easy to run for the team.

**Tasks:**

1. **Error handling** — display user-friendly error cards for: conversion failure, file-too-large, non-PDF file, epub.js render error; never show raw stack traces

2. **Loading states** — conversion spinner with estimated wait time ("Converting PDF…"); epub.js renderer shows a skeleton until the first chapter loads

3. **Startup script** — a single `start.sh` (or `Makefile`) that installs Python deps, starts uvicorn on port 8000, and starts the Vite dev server on port 5173 in parallel

4. **README** — setup instructions covering Python 3.12, Node 22, Poetry, and pnpm prerequisites; `start.sh` usage; known limitations

5. **Keyboard shortcuts** — matching the spec's `Ctrl+]` / `Ctrl+[` for next/previous; `+`/`-` for zoom; `0` to fit width

6. **Font loading** — preload Inter from Google Fonts or a local woff2 file; match the `font.body.family: "Inter"` default from spec §5.1.4

**Acceptance criteria:**
- Running `./start.sh` from repo root starts both processes cleanly
- Uploading a corrupt file shows a clear error message (not a blank screen)
- A PDF with 100+ pages loads without browser hang (chunked chapter approach)
- All keyboard shortcuts work as documented

---

## 5. File & Folder Structure

```
hitl-pdf-preview/
│
├── server/                    # Python FastAPI conversion service
│   ├── main.py
│   ├── converter.py
│   ├── pyproject.toml
│   └── requirements.txt
│
├── client/                    # React + Vite frontend
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── UploadZone.tsx
│       │   ├── Toolbar.tsx
│       │   ├── EpubViewer.tsx
│       │   └── ThumbnailSidebar.tsx
│       ├── hooks/
│       │   ├── useConvert.ts
│       │   └── useEpub.ts
│       └── types/
│           └── index.ts
│
├── start.sh                   # One-command startup script
├── Makefile                   # Alternative: make dev
└── README.md
```

---

## 6. Known Limitations & Conversion Fidelity

The local app uses a simpler conversion path than the full spec intends. The following are expected limitations and their planned resolution in the full module:

| Limitation | Local App Behaviour | Full Module Resolution |
|---|---|---|
| PDF images | Not extracted; text-only EPUB | pdfminer image extraction + ebooklib figures |
| PDF with scanned pages (no text layer) | Empty EPUB chapters | OCR pre-processing (Tesseract or cloud OCR) |
| Complex multi-column layouts | Text extracted linearly; column order may be lost | PDF layout analysis with higher-fidelity extraction |
| Hyperlinks in PDF | Not preserved | pdfminer annotation extraction |
| PDF form fields | Not rendered | Covered by spec §5.5.4 (AcroForm support) |
| Large PDFs (200+ pages) | May be slow | Streaming conversion, async job queue (BullMQ) |

---

## 7. How This Feeds Into the Full Module

When the full HITL module is built (per the Implementation Plan phases), the local app components slot in directly:

- `converter.py` becomes the core of **Phase 4 (EPUB Conversion Service)** — wrapped in a proper FastAPI microservice with async job processing, S3 output, and conversion manifests
- `EpubViewer.tsx` becomes the foundation of **Phase 12 (EPUB Rendering Engine & Font System)** — the epub.js integration, CFI navigation, and font injection are directly reused
- `ThumbnailSidebar.tsx` feeds into the attention panel thumbnail strip in **Phase 14**
- `Toolbar.tsx` is extended with review state controls in the full toolbar component

No throwaway code.

---

## 8. Immediate Next Steps

| # | Action | Owner |
|---|---|---|
| 1 | Confirm Python 3.12 + Poetry + Node 22 + pnpm are available in the dev environment | Dev |
| 2 | Create the `hitl-pdf-preview/` repo and copy this plan in | Dev |
| 3 | Build Phase 1 (server) first and validate EPUB output with a test PDF | Dev |
| 4 | Build Phase 2 (client) and connect to the running server | Dev |
| 5 | Test with a varied set of PDFs: text-heavy, image-heavy, multi-column, form-based | QA |
| 6 | Document conversion fidelity findings to inform the full Phase 4 implementation | Dev |

---

*Local PDF Preview App Plan v1.0 | April 2026 | Relates to HITL Module specs*
