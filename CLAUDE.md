# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HITL PDF Preview** — the first executable slice of a Human-in-the-Loop (HITL) Document Review & AI Collaboration Module. This MVP converts PDFs to EPUB on the server, then renders the EPUB in a browser using epub.js.

## Commands

### Quick Start
```bash
cd hitl-pdf-preview
chmod +x start.sh
./start.sh
# Starts both server (port 8000) and client (port 5173)
```

### Server (Python/FastAPI)
```bash
cd hitl-pdf-preview/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Client (React/TypeScript)
```bash
cd hitl-pdf-preview/client
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to dist/
npm run lint       # Run ESLint
```

### API Docs
Visit `http://localhost:8000/docs` for Swagger UI (FastAPI auto-generated).

## Architecture

**Tech stack:** Python 3.12 + FastAPI + pdfminer.six + ebooklib (server) | React 19 + TypeScript + Vite + epub.js (client)

### Data Flow

```
UploadZone → useConvert hook → POST /api/convert (FormData)
                                       ↓
                              FastAPI (main.py) validates PDF
                                       ↓
                              converter.py extracts text via pdfminer.six
                              groups pages into chapters (15 pages default)
                              assembles EPUB3 via ebooklib
                                       ↓
                              Returns EPUB bytes (application/epub+zip)
                                       ↓
useConvert creates blob URL → EpubViewer → useEpub hook → epub.js renders
```

### Key Files

**Server** (`hitl-pdf-preview/server/`):
- `main.py` — FastAPI app, routes (`/health`, `/convert`), validation (PDF magic bytes, 50 MB limit, CORS)
- `converter.py` — Core conversion: `_extract_pages_content()`, `_classify_block()` (heading heuristics), `_pages_to_html()`, `_group_into_chapters()`, `pdf_to_epub()`

**Client** (`hitl-pdf-preview/client/src/`):
- `App.tsx` — Root state router (upload view vs. viewer)
- `hooks/useConvert.ts` — PDF upload + EPUB conversion lifecycle, blob URL management
- `hooks/useEpub.ts` — epub.js book lifecycle, chapter navigation, zoom
- `components/EpubViewer.tsx` — Composite layout (Toolbar + ThumbnailSidebar + render container)

### Important Conventions

- **API proxy**: Vite routes `/api/*` → `localhost:8000` in dev. Frontend always uses relative `/api/...` paths.
- **Chapter grouping**: `PAGES_PER_CHAPTER = 15` in `converter.py` controls auto-chapter subdivision.
- **Blob URL cleanup**: `useConvert` revokes previous blob URLs; `useEpub` destroys previous book before loading new EPUB.
- **PDF validation**: Magic bytes (`%PDF`) check + filename/content-type check + 50 MB size limit enforced in `main.py`.
- **Scanned PDFs**: Text-only pipeline — raises 400 if no text layer extracted; no OCR support.
- **epub.js config**: Uses `scrolled-doc` flow and `spread: 'none'` for single-column rendering.

### Specification Documents

The root directory contains specification files that define the full HITL Module (beyond this MVP):
- `HITL_Module_Functional_Specification_v1.2.md` — Product requirements
- `HITL_Module_Technical_Architecture_Specification_v1.0.md` — Architecture decisions
- `HITL_Module_Implementation_Plan_v1.0.md` — Phase roadmap (future phases add DOCX/XLSX/Markdown, annotations, AI chat, WebSocket collaboration, PostgreSQL persistence)
