"""
main.py — HITL document preview: FastAPI conversion server.

Endpoints:
  GET  /health    → service health check
  POST /convert   → accept PDF/Markdown, return EPUB3

Aligns with:
  - Technical Architecture §3.2 (FastAPI 0.115, Python 3.12)
  - Functional Spec §5.1.1 (PDF → EPUB pipeline)
  - Local PDF Preview App Plan §4 Phase 1
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from converter import excel_to_epub, markdown_to_epub, pdf_to_epub

# ── Config ────────────────────────────────────────────────────────────────────

VERSION = "0.1.0"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB  (Functional Spec §6 performance)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hitl-server")


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("HITL PDF Preview server starting — v%s", VERSION)
    yield
    logger.info("HITL PDF Preview server shutting down")


app = FastAPI(
    title="HITL PDF Preview — Conversion Service",
    version=VERSION,
    description=(
        "Accepts PDF and Markdown files and returns EPUB3 documents for preview in the "
        "HITL Document Review module. Aligns with Technical Architecture §3.2."
    ),
    lifespan=lifespan,
)

# Allow the Vite dev server (localhost:5173) and any localhost origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Exception handlers ────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    summary="Health check",
    response_description="Service version and status",
)
async def health():
    """Returns 200 OK when the service is running."""
    return {"status": "ok", "version": VERSION, "service": "hitl-pdf-preview"}


XLSX_MAGIC = b"PK\x03\x04"          # ZIP / Office Open XML
XLS_MAGIC  = b"\xd0\xcf\x11\xe0"  # OLE2 Compound Document


@app.post(
    "/convert",
    summary="Convert document to EPUB3",
    response_description="EPUB3 binary (application/epub+zip)",
    responses={
        200: {"content": {"application/epub+zip": {}}},
        400: {"description": "Invalid or unreadable document"},
        413: {"description": "File exceeds 50 MB limit"},
        415: {"description": "Unsupported file type"},
        500: {"description": "Conversion failed"},
    },
)
async def convert(
    file: UploadFile = File(..., description="PDF, Excel (.xlsx/.xls), or Markdown file to convert"),
):
    """
    Accept a PDF, Excel, or Markdown file and return a valid EPUB3 document.

    The EPUB is rendered using the platform default typography
    (Inter font, 1.6 line-height) as specified in Functional Spec §5.1.4.
    """
    # 1. Determine file type from extension
    filename = file.filename or "document"
    lower_name = filename.lower()
    is_pdf      = lower_name.endswith(".pdf")
    is_xlsx     = lower_name.endswith(".xlsx")
    is_xls      = lower_name.endswith(".xls")
    is_excel    = is_xlsx or is_xls
    is_markdown = lower_name.endswith(".md") or lower_name.endswith(".markdown")

    if not (is_pdf or is_excel or is_markdown):
        raise HTTPException(
            status_code=415,
            detail="Only PDF, Excel (.xlsx, .xls), and Markdown files are accepted.",
        )

    # 2. Read and check size
    source_bytes = await file.read()
    if len(source_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File size {len(source_bytes) / 1024 / 1024:.1f} MB exceeds the "
                f"50 MB limit."
            ),
        )

    # 3. Magic-byte validation for binary formats
    if is_pdf and (len(source_bytes) < 5 or source_bytes[:4] != b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be a valid PDF.",
        )
    if is_xlsx and source_bytes[:4] != XLSX_MAGIC:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be a valid .xlsx workbook.",
        )
    if is_xls and source_bytes[:4] != XLS_MAGIC:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not appear to be a valid .xls workbook.",
        )

    logger.info("Converting '%s' (%d KB)", filename, len(source_bytes) // 1024)

    # 4. Convert
    try:
        if is_pdf:
            epub_bytes = pdf_to_epub(source_bytes, filename=filename)
        elif is_excel:
            epub_bytes = excel_to_epub(source_bytes, filename=filename)
        else:
            epub_bytes = markdown_to_epub(source_bytes, filename=filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Conversion failed for '%s'", filename)
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {exc}",
        )

    stem = filename.rsplit(".", 1)[0]
    epub_filename = f"{stem}.epub"
    logger.info("Converted '%s' → '%s' (%d KB)", filename, epub_filename, len(epub_bytes) // 1024)

    # Content-Disposition requires ASCII/latin-1; use RFC 5987 for non-ASCII names.
    try:
        epub_filename.encode("latin-1")
        disposition = f'attachment; filename="{epub_filename}"'
    except UnicodeEncodeError:
        from urllib.parse import quote
        safe_ascii = epub_filename.encode("ascii", errors="replace").decode("ascii")
        encoded = quote(epub_filename, encoding="utf-8")
        disposition = f'attachment; filename="{safe_ascii}"; filename*=UTF-8\'\'{encoded}'

    return Response(
        content=epub_bytes,
        media_type="application/epub+zip",
        headers={
            "Content-Disposition": disposition,
            "X-Epub-Size": str(len(epub_bytes)),
        },
    )
