# HITL PDF Preview — Local App

A local web app for previewing PDF documents, built as the first executable slice of the **HITL Document Review & AI Collaboration Module**.

Converts PDFs to EPUB server-side and renders them using `epub.js` — exactly the pipeline described in the Technical Architecture Specification.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.12+ | `python3 --version` |
| pip | any | `pip3 --version` |
| Node.js | 18+ | `node --version` |
| npm | any | `npm --version` |

---

## Quick Start

```bash
# 1. Clone / navigate to the project
cd hitl-pdf-preview

# 2. Make the start script executable (first time only)
chmod +x start.sh

# 3. Start both services
./start.sh
```

Then open **http://localhost:5173** in your browser.

---

## What's Running

| Service | URL | Description |
|---|---|---|
| React frontend | http://localhost:5173 | Upload PDFs, view EPUB |
| FastAPI server | http://localhost:8000 | PDF → EPUB conversion |
| API docs | http://localhost:8000/docs | Interactive Swagger UI |

---

## Manual Start (without the script)

**Server:**
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Client (separate terminal):**
```bash
cd client
npm install
npm run dev
```

---

## How to Use

1. Open http://localhost:5173
2. **Drop a PDF** onto the page or click **Open PDF**
3. The PDF is sent to the local server, converted to EPUB, and rendered
4. Use the **sidebar** to jump between chapters (grouped by page range)
5. Use the **toolbar** for navigation and zoom

**Keyboard shortcuts:**
| Key | Action |
|---|---|
| `→` or `]` | Next chapter |
| `←` or `[` | Previous chapter |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |

---

## Project Structure

```
hitl-pdf-preview/
├── server/
│   ├── main.py          # FastAPI app — POST /convert, GET /health
│   ├── converter.py     # PDF extraction (pdfminer.six) + EPUB build (ebooklib)
│   └── requirements.txt
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── EpubViewer.tsx      # epub.js integration
│   │   │   ├── ThumbnailSidebar.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── UploadZone.tsx
│   │   ├── hooks/
│   │   │   ├── useConvert.ts       # POST /api/convert
│   │   │   └── useEpub.ts          # epub.js lifecycle
│   │   └── types/index.ts
│   ├── vite.config.ts
│   └── package.json
├── start.sh
└── README.md
```

---

## Spec Alignment

| Component | Spec Reference |
|---|---|
| `converter.py` | Architecture §3.2, §5.3 — pdfminer.six + ebooklib |
| `EpubViewer.tsx` | Architecture §4.2 — epub.js 0.3.x |
| `ThumbnailSidebar.tsx` | Functional Spec §5.1.2 — thumbnail strip |
| Typography (Inter font) | Functional Spec §5.1.4 — font.body.family default |
| FastAPI server | Architecture §3.2 — Python 3.12 + FastAPI 0.115 |

---

## Known Limitations

| Issue | Notes |
|---|---|
| Scanned PDFs (no text layer) | Will return a 400 error; OCR not included |
| PDF images | Not extracted in this version; text only |
| Multi-column layouts | Text extracted linearly; order may vary |
| Large PDFs (200+ pages) | Conversion may take 10–20 seconds |

These limitations are documented in the **Local PDF Preview App Plan** and will be addressed in the full EPUB Conversion Service (Implementation Plan Phase 4).

---

*HITL Module — Local PDF Preview v0.1.0 | April 2026*
