from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.services.ollama_client import generate_text, OllamaError
from app.services.assistant_prompts import (
    prompt_anexo1_draft_from_text,
    prompt_anexo2_draft_from_text,
    prompt_review,
)
from app.services.assistant_sanitize import sanitize_payload

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

def _parse_json_strict(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"message": "Modelo não retornou JSON válido.", "raw": raw[:4000]},
        )

@router.post("/anexo1/draft_from_text")
def anexo1_draft_from_text(payload: dict):
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Informe um texto para o assistente.")

    try:
        raw = generate_text(prompt_anexo1_draft_from_text(text), temperature=0.2, timeout_s=90)
    except OllamaError as e:
        raise HTTPException(502, str(e))

    return _parse_json_strict(raw)

@router.post("/anexo2/draft_from_text")
def anexo2_draft_from_text(payload: dict):
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "Informe um texto para o assistente.")

    try:
        raw = generate_text(prompt_anexo2_draft_from_text(text), temperature=0.2, timeout_s=90)
    except OllamaError as e:
        raise HTTPException(502, str(e))

    return _parse_json_strict(raw)

@router.post("/review")
def review(payload: dict):
    kind = (payload.get("kind") or "documento").strip()
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, "Envie {kind, data}.")

    sanitized = sanitize_payload(data)
    sanitized_json = json.dumps(sanitized, ensure_ascii=False)

    try:
        raw = generate_text(prompt_review(kind, sanitized_json), temperature=0.2, timeout_s=90)
    except OllamaError as e:
        raise HTTPException(502, str(e))

    return _parse_json_strict(raw)
