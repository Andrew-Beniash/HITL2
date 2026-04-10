# HITL PDF Preview — Local App

A local web app for previewing and reviewing documents, built as the first executable slice of the **HITL Document Review & AI Collaboration Module**.

**Supported formats:**

- **PDF** — Rendered natively via PDF.js with integrated chat panel
- **Excel (.xlsx/.xls)** — Rendered natively via SheetJS
- **Word (.docx)** — Rendered natively via Mammoth
- **Markdown** — Converted to EPUB server-side and rendered via epub.js

This implementation combines native client-side rendering for performance-critical formats (PDF, Excel, Word) with server-side EPUB conversion for Markdown — exactly the hybrid pipeline described in the Technical Architecture Specification.

---

## Prerequisites

| Tool    | Version | Check               |
| ------- | ------- | ------------------- |
| Python  | 3.12+   | `python3 --version` |
| pip     | any     | `pip3 --version`    |
| Node.js | 18+     | `node --version`    |
| npm     | any     | `npm --version`     |

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

## Services & Ports

| Service        | URL                        | Description                                |
| -------------- | -------------------------- | ------------------------------------------ |
| React frontend | http://localhost:5173      | Upload documents, view EPUB/PDF/Excel/Word |
| FastAPI server | http://localhost:8000      | Document conversion service                |
| API docs       | http://localhost:8000/docs | Interactive Swagger UI                     |

| Format       | Rendering            | Technology                        | Use Case                              |
| ------------ | -------------------- | --------------------------------- | ------------------------------------- |
| **PDF**      | Native (client-side) | PDF.js 5.6.205                    | Performance, interactivity            |
| **Excel**    | Native (client-side) | SheetJS (xlsx)                    | Sheet navigation, formulas            |
| **Word**     | Native (client-side) | Mammoth 1.12                      | Formatted text, preserves styles      |
| **Markdown** | EPUB (server-side)   | pdfminer.six → ebooklib → epub.js | Standardized format, chapter grouping |

**Architecture decision:** Native client-side rendering for PDF/Excel/Word provides immediate, responsive interactive viewing. Markdown uses server-side EPUB conversion to benefit from the standardized EPUB pipeline and chapter-based navigation.

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
2. **Drop a document** onto the page or click **Open Document**
3. The app automatically detects the file type:
   - **PDF/Excel/Word** → Rendered natively in the app
   - **Markdown** → Converted to EPUB server-side, then rendered
4. Use the **ChatPanel** on the right sidebar to ask questions about the document
5. Use viewer-specific controls:
   - **PDF**: Navigate pages with toolbar or keyboard
   - **Excel**: Select sheets, freeze panes
   - **Word**: Formatted text rendering
   - **EPUB (Markdown)**: Use the sidebar to jump between chapters

**Keyboard shortcuts (EPUB only):**
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
│   ├── main.py              # FastAPI app — routes, validation, CORS
│   ├── converter.py         # Format converters: pdf_to_epub, markdown_to_epub, excel_to_epub
│   ├── requirements.txt     # Python dependencies
│   └── test-minimal.pdf     # Test file
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── public/
│   │   └── pdf.worker.min.mjs        # PDF.js worker
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                    # Root router — detects file type and renders
│       ├── index.css
│       ├── components/
│       │   ├── EpubViewer.tsx         # EPUB viewer for Markdown files via epub.js
│       │   ├── PdfViewer.tsx          # PDF viewer via PDF.js
│       │   ├── ExcelViewer.tsx        # Excel viewer via SheetJS (xlsx)
│       │   ├── WordViewer.tsx         # Word viewer via Mammoth
│       │   ├── ChatPanel.tsx          # Collapsible AI chat interface
│       │   ├── ViewerLayout.tsx       # Layout wrapper: viewer + ChatPanel
│       │   ├── ThumbnailSidebar.tsx   # Chapter navigation (for EPUB)
│       │   ├── Toolbar.tsx            # Navigation + zoom controls
│       │   └── UploadZone.tsx         # File drop zone
│       ├── hooks/
│       │   ├── useConvert.ts          # Markdown file upload + EPUB conversion
│       │   └── useEpub.ts             # epub.js book lifecycle
│       └── types/
│           └── index.ts               # TypeScript type definitions
├── .gitignore
├── start.sh
└── README.md
```

---

## Architecture Overview

### Data Flow

```
┌─ User uploads document ─┐
│                          ↓
│    ┌─────────────────────────────┐
│    │ App.tsx (file type detect)  │
│    └─────────────────────────────┘
│         ↓          ↓       ↓         ↓
│    PDF/Excel/Word  |  Markdown  |  Unknown
│      (native)      |  (converted)|
│         ↓          |      ↓      |
│    PdfViewer       |  POST /convert → EPUB
│    ExcelViewer     |           ↓
│    WordViewer      |    EpubViewer
│         ↓          ↓
└─→ ViewerLayout (wraps viewer + ChatPanel)
```

### Component Responsibilities

| Component        | Role                                            |
| ---------------- | ----------------------------------------------- |
| **App.tsx**      | Detects file type, routes to appropriate viewer |
| **PdfViewer**    | Client-side PDF rendering via PDF.js            |
| **ExcelViewer**  | Client-side sheet rendering via SheetJS         |
| **WordViewer**   | Client-side document rendering via Mammoth      |
| **EpubViewer**   | EPUB rendering via epub.js (for Markdown only)  |
| **ViewerLayout** | Layout container + collapsible ChatPanel        |
| **ChatPanel**    | UI stub for document Q&A (backend pending)      |
| **UploadZone**   | File drop zone and upload trigger               |
| **useConvert**   | Handles Markdown → EPUB conversion lifecycle    |
| **useEpub**      | Manages epub.js book state and navigation       |

### Server Backend

```
FastAPI (main.py)
├── POST /convert
│   ├── Receives FormData with file
│   ├── Routes to appropriate converter:
│   │   ├── pdf_to_epub() — pdfminer.six → ebooklib
│   │   ├── markdown_to_epub() — Markdown → HTML → ebooklib
│   │   └── excel_to_epub() — SheetJS → HTML → ebooklib
│   └── Returns EPUB bytes
└── GET /health — Service status
```

---

## Development

### Setup from scratch

**Server:**

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Client:**

```bash
cd client
npm install
```

### Running tests & linting

**Client linting:**

```bash
cd client
npm run lint
```

### Build for production

**Client:**

```bash
cd client
npm run build                       # Outputs to dist/
```

---

## API Reference

### POST /api/convert

Converts an uploaded document to EPUB format.

**Supported input formats:**

- `.pdf` — Extracted via pdfminer.six, converted to EPUB
- `.md` — Rendered as Markdown, converted to EPUB
- `.xlsx` / `.xls` — Converted to EPUB via openpyxl/xlrd

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file` (document file)

**Response:**

- Content-Type: `application/epub+zip`
- Body: EPUB file bytes

**Status codes:**

- `200` — Success
- `400` — Invalid document, exceeds size limit, or no content extracted
- `413` — File too large (> 50 MB)
- `415` — Unsupported content type

**Examples:**

```bash
# Convert a PDF
curl -F "file=@document.pdf" http://localhost:8000/api/convert -o output.epub

# Convert Markdown
curl -F "file=@notes.md" http://localhost:8000/api/convert -o output.epub

# Convert Excel
curl -F "file=@data.xlsx" http://localhost:8000/api/convert -o output.epub
```

### GET /health

Health check endpoint.

**Response:**

```json
{ "status": "ok" }
```

---

## Spec Alignment

| Component              | Tech                           | Spec Reference                                            |
| ---------------------- | ------------------------------ | --------------------------------------------------------- |
| **PDF rendering**      | PDF.js 5.6.205                 | Architecture §4.2 — native PDF rendering                  |
| **Excel rendering**    | SheetJS (xlsx 0.18.5)          | Architecture §4.2 — native Excel rendering                |
| **Word rendering**     | Mammoth 1.12                   | Architecture §4.2 — native Word rendering                 |
| **EPUB conversion**    | ebooklib 0.18 + epub.js 0.3.93 | Architecture §5.3 — EPUB pipeline for Markdown            |
| **PDF extraction**     | pdfminer.six 20231228          | Architecture §3.2, §5.3 — text extraction                 |
| **Chat panel**         | ChatPanel.tsx                  | Functional Spec §5.2 — collaboration UI (pending backend) |
| **FastAPI server**     | FastAPI 0.115.5 + Python 3.12  | Architecture §3.2 — conversion service                    |
| **Frontend framework** | React 19 + TypeScript + Vite   | Architecture §4.1 — modern SPA architecture               |

---

## Known Limitations

| Issue                        | Scope        | Notes                                             |
| ---------------------------- | ------------ | ------------------------------------------------- |
| Scanned PDFs (no text layer) | PDF + EPUB   | Will return a 400 error; OCR not included         |
| PDF images                   | PDF + EPUB   | Images not extracted in conversion; text only     |
| Multi-column layouts         | PDF + EPUB   | Text extracted linearly; order may vary           |
| Large files (200+ pages)     | All formats  | Conversion may take 10–20 seconds                 |
| Complex Excel formatting     | Excel viewer | Some advanced features (charts, formulas) limited |
| Complex Word formatting      | Word viewer  | Advanced styles may render differently            |
| Math formulas in Markdown    | Markdown     | LaTeX/MathML support varies; may render as text   |
| Chat panel AI backend        | ChatPanel    | Requires backend integration; currently disabled  |

These limitations are documented in the **Local PDF Preview App Plan** and will be addressed in the full HITL Module (Implementation Plan Phase 4+).

---

## Troubleshooting

### Port 8000/5173 already in use

```bash
# Kill process on port 8000 (macOS/Linux)
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 5173 (macOS/Linux)
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or specify different ports
uvicorn main:app --port 8001
npm run dev -- --port 5174
```

### Format not recognized or fails to render

- **PDF**: Ensure it has a text layer (not scanned image). Try with test-minimal.pdf in the server folder.
- **Excel**: Only .xlsx and .xls formats supported. Ensure file is not corrupted.
- **Word**: Only .docx format supported. Complex styling may not render perfectly.
- **Markdown**: Ensure file has .md extension and contains valid Markdown syntax.

### Chat panel not responding

The ChatPanel is currently a UI stub. To enable AI chat:

1. Implement the `onSend` callback in `useConvert` hook
2. Connect to your backend AI service (e.g., OpenAI, local LLM)
3. Stream responses to update the chat history

### CORS errors

Ensure the React dev server is running on port 5173. If you're using a different port, update the CORS whitelist in `main.py`:

```python
allow_origins=[
    "http://localhost:5173",  # ← Update this
    ...
]
```

### Virtual environment not activating

- macOS/Linux: Use `source .venv/bin/activate`
- Windows: Use `.venv\Scripts\activate`

### Large file conversion timeout

Files with 200+ pages may take 20+ seconds. Check the FastAPI server logs for progress:

```bash
# Terminal with server running — watch for conversion logs
cd server && source .venv/bin/activate && tail -f *.log
```

### `.venv/` tracked in git

If `.venv/` was accidentally committed before `.gitignore` was added:

```bash
git rm -r --cached server/.venv client/node_modules
git commit -m "Remove venv and node_modules from tracking"
```

---

## Contributing

This is v0.1.0 of the HITL PDF Preview — the first executable MVP of the broader HITL Document Review & AI Collaboration Module.

**Current status:**

- ✅ Multi-format document viewing (PDF, Excel, Word, Markdown)
- ✅ EPUB conversion pipeline for Markdown
- ✅ Integrated chat panel UI (backend integration pending)
- 🚧 AI chat backend (infrastructure ready, awaiting service integration)
- 🔄 Annotation system (planned Phase 2)
- 🔄 WebSocket collaboration (planned Phase 3)
- 🔄 Database persistence (planned Phase 4)

**For feature requests, bug reports, or contributions:**

1. Review the specification documents in the root directory
2. Check the [Implementation Plan](../HITL_Module_Implementation_Plan_v1.0.md) for roadmap
3. Open an issue or PR with your proposed changes

---

_HITL Module — Multi-Format Document Preview v0.1.0 | April 2026_
