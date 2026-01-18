from __future__ import annotations

import json
import uuid
from datetime import date
from pathlib import Path
from typing import Literal, Optional
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.settings import settings
from app.services.anexo1_import import extract_prefill_from_anexo1
from app.services.validate_anexo1 import validate_and_enrich_anexo1
from app.services.validate_anexo2 import validate_and_enrich_anexo2
from app.services.docx_render import render_docx_from_template
from app.services.pdf_convert import convert_docx_to_pdf


app = FastAPI(title="UFPB Diárias Wizard")


app.mount("/static", StaticFiles(directory="app/static"), name="static")

WEB_DIR = Path("app/web")

def _load_html(name: str) -> str:
    return (WEB_DIR / name).read_text(encoding="utf-8")

def _ensure_data_dir() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)

def _save_draft(draft_id: str, payload: dict) -> None:
    _ensure_data_dir()
    fp = settings.data_dir / f"{draft_id}.json"
    fp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

def _load_draft(draft_id: str) -> dict:
    fp = settings.data_dir / f"{draft_id}.json"
    if not fp.exists():
        raise HTTPException(404, "Rascunho não encontrado.")
    return json.loads(fp.read_text(encoding="utf-8"))

@app.get("/", response_class=HTMLResponse)
def home():
    return _load_html("index.html")

@app.get("/anexo1", response_class=HTMLResponse)
def anexo1_page():
    return _load_html("anexo1.html")

@app.get("/anexo2", response_class=HTMLResponse)
def anexo2_page():
    return _load_html("anexo2.html")

@app.post("/api/drafts")
def create_draft(kind: Literal["anexo1", "anexo2"]):
    draft_id = str(uuid.uuid4())
    _save_draft(draft_id, {"kind": kind, "created_at": str(date.today()), "data": {}})
    return {"draft_id": draft_id}

@app.get("/api/server-date")
def server_date():
    # data atual do servidor (YYYY-MM-DD) para preencher campos padrão no front
    return {"date": str(date.today())}

@app.get("/api/drafts/{draft_id}")
def get_draft(draft_id: str):
    return _load_draft(draft_id)

@app.patch("/api/drafts/{draft_id}")
def patch_draft(draft_id: str, data: dict):
    draft = _load_draft(draft_id)
    draft["data"] = {**draft.get("data", {}), **data}
    _save_draft(draft_id, draft)
    return {"ok": True}

@app.post("/api/anexo1/preview")
def preview_anexo1(payload: dict):
    enriched = validate_and_enrich_anexo1(payload)
    return enriched

@app.post("/api/anexo2/preview")
def preview_anexo2(payload: dict):
    enriched = validate_and_enrich_anexo2(payload)
    return enriched


@app.post("/api/anexo2/prefill-from-anexo1")
async def prefill_anexo2_from_anexo1(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "Envie o arquivo do Anexo I preenchido em PDF, DOC ou DOCX.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(400, "Formato não suportado. Use PDF, DOC ou DOCX do Anexo I.")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Arquivo vazio. Verifique se o Anexo I foi exportado corretamente.")

    tmp_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = extract_prefill_from_anexo1(tmp_path)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        raise HTTPException(400, "Não foi possível extrair dados do Anexo I. Confirme se o arquivo está legível.")
    finally:
        if tmp_path:
            tmp_path.unlink(missing_ok=True)

    return {"ok": True, "prefill": result.prefill, "warnings": result.warnings, "filename": file.filename}

@app.post("/api/anexo1/generate")
def generate_anexo1(payload: dict, format: Literal["docx", "pdf"] = Query("docx")):
    _ensure_data_dir()

    enriched = validate_and_enrich_anexo1(payload)
    if not enriched.get("ok"):
        # 422 Unprocessable Entity (erro de validação)
        raise HTTPException(status_code=422, detail=enriched)

    template = settings.templates_dir / "anexo1_template.docx"
    if not template.exists():
        raise HTTPException(500, "Template anexo1_template.docx não encontrado em app/templates.")

    out_docx = settings.data_dir / f"anexo1_{uuid.uuid4()}.docx"
    render_docx_from_template(template, out_docx, enriched["placeholders"])

    if format == "docx":
        return FileResponse(out_docx, filename="anexo1_preenchido.docx")

    out_pdf = convert_docx_to_pdf(out_docx)
    return FileResponse(out_pdf, filename="anexo1_preenchido.pdf")


@app.post("/api/anexo2/generate")
def generate_anexo2(payload: dict, format: Literal["docx", "pdf"] = Query("docx")):
    _ensure_data_dir()

    enriched = validate_and_enrich_anexo2(payload)
    if not enriched.get("ok"):
        raise HTTPException(status_code=422, detail=enriched)

    template = settings.templates_dir / "anexo2_template.docx"
    if not template.exists():
        raise HTTPException(500, "Template anexo2_template.docx não encontrado em app/templates.")

    out_docx = settings.data_dir / f"anexo2_{uuid.uuid4()}.docx"
    render_docx_from_template(template, out_docx, enriched["placeholders"])

    if format == "docx":
        return FileResponse(out_docx, filename="anexo2_preenchido.docx")

    out_pdf = convert_docx_to_pdf(out_docx)
    return FileResponse(out_pdf, filename="anexo2_preenchido.pdf")

@app.get("/review", response_class=HTMLResponse)
def review_page():
    return _load_html("review.html")
