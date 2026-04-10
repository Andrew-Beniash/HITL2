"""
main.py — HITL document preview: FastAPI conversion + chat server.

Endpoints:
  GET  /health    → service health check
  POST /convert   → accept PDF/Markdown/Excel, return EPUB3
  POST /chat      → document-aware chat via OpenAI

Aligns with:
  - Technical Architecture §3.2 (FastAPI 0.115, Python 3.12)
  - Functional Spec §5.1.1 (PDF → EPUB pipeline)
  - Local PDF Preview App Plan §4 Phase 1
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from converter import excel_to_epub, markdown_to_epub, pdf_to_epub

# Load .env from the same directory as this file
load_dotenv(Path(__file__).parent / ".env")

# ── Config ────────────────────────────────────────────────────────────────────

VERSION = "0.1.0"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL     = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "1024"))
OPENAI_SYSTEM_PROMPT = os.getenv("OPENAI_SYSTEM_PROMPT", "").strip()

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful document assistant. "
    "The user has opened a document in a preview application and may ask you "
    "questions about its content, request summaries, extract specific data, or "
    "ask for explanations. Answer concisely and accurately. "
    "If the document filename is provided, use it as context. "
    "If you don't know or can't infer something from the document, say so clearly."
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hitl-server")


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-..."):
        logger.info("OpenAI chat enabled — model: %s", OPENAI_MODEL)
    else:
        logger.warning("OPENAI_API_KEY not set — /chat will return 503")
    logger.info("HITL server starting — v%s", VERSION)
    yield
    logger.info("HITL server shutting down")


app = FastAPI(
    title="HITL PDF Preview — Conversion & Chat Service",
    version=VERSION,
    description=(
        "Accepts documents (PDF, Excel, Markdown) and returns EPUB3 previews. "
        "Also provides an OpenAI-backed document chat endpoint."
    ),
    lifespan=lifespan,
)

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

@app.get("/health", summary="Health check")
async def health():
    return {
        "status": "ok",
        "version": VERSION,
        "service": "hitl-pdf-preview",
        "chat": bool(OPENAI_API_KEY and not OPENAI_API_KEY.startswith("sk-...")),
    }


XLSX_MAGIC = b"PK\x03\x04"
XLS_MAGIC  = b"\xd0\xcf\x11\xe0"


@app.post(
    "/convert",
    summary="Convert document to EPUB3",
    responses={
        200: {"content": {"application/epub+zip": {}}},
        400: {"description": "Invalid or unreadable document"},
        413: {"description": "File exceeds 50 MB limit"},
        415: {"description": "Unsupported file type"},
        500: {"description": "Conversion failed"},
    },
)
async def convert(
    file: UploadFile = File(..., description="PDF, Excel (.xlsx/.xls), or Markdown file"),
):
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

    source_bytes = await file.read()
    if len(source_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size {len(source_bytes) / 1024 / 1024:.1f} MB exceeds the 50 MB limit.",
        )

    if is_pdf and (len(source_bytes) < 5 or source_bytes[:4] != b"%PDF"):
        raise HTTPException(status_code=400, detail="The uploaded file does not appear to be a valid PDF.")
    if is_xlsx and source_bytes[:4] != XLSX_MAGIC:
        raise HTTPException(status_code=400, detail="The uploaded file does not appear to be a valid .xlsx workbook.")
    if is_xls and source_bytes[:4] != XLS_MAGIC:
        raise HTTPException(status_code=400, detail="The uploaded file does not appear to be a valid .xls workbook.")

    logger.info("Converting '%s' (%d KB)", filename, len(source_bytes) // 1024)

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
        raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}")

    stem = filename.rsplit(".", 1)[0]
    epub_filename = f"{stem}.epub"
    logger.info("Converted '%s' → '%s' (%d KB)", filename, epub_filename, len(epub_bytes) // 1024)

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
        headers={"Content-Disposition": disposition, "X-Epub-Size": str(len(epub_bytes))},
    )


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    filename: str | None = None
    document_text: str | None = None


@app.post("/chat", summary="Document-aware chat via OpenAI")
async def chat(req: ChatRequest):
    """
    Send a message with conversation history to OpenAI and stream the reply
    back as Server-Sent Events (text/event-stream).

    Each SSE event is a JSON object:
      { "delta": "<text chunk>" }   — partial token
      { "done": true }              — stream finished
      { "error": "<message>" }      — error (also ends stream)
    """
    if not OPENAI_API_KEY or OPENAI_API_KEY.startswith("sk-..."):
        raise HTTPException(
            status_code=503,
            detail="Chat is not configured. Add OPENAI_API_KEY to server/.env.",
        )

    import json
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    system_content = OPENAI_SYSTEM_PROMPT or DEFAULT_SYSTEM_PROMPT
    if req.filename:
        system_content += f"\n\nThe document currently open is: {req.filename}"
    if req.document_text:
        system_content += (
            "\n\nHere is the full text content of the document. "
            "Use it to answer the user's questions accurately:\n\n"
            "--- DOCUMENT START ---\n"
            f"{req.document_text}\n"
            "--- DOCUMENT END ---"
        )

    messages = [{"role": "system", "content": system_content}]
    for msg in req.history[:-1]:   # history already includes current message at end
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.text})
    messages.append({"role": "user", "content": req.message})

    async def event_stream():
        try:
            stream = await client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                max_tokens=OPENAI_MAX_TOKENS,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            logger.exception("OpenAI chat error")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
