from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Any, Dict

from app.settings import settings
from app.services.placeholders import build_placeholders_anexo2

def _parse_date(s: str) -> date:
    return date.fromisoformat(s)

def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s)

def validate_and_enrich_anexo2(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors = []

    # datas ida/retorno
    try:
        ida = _parse_dt(payload["afastamento"]["ida"]["data_hora"])
        ret = _parse_dt(payload["afastamento"]["retorno"]["data_hora"])
        if ret < ida:
            errors.append({"field": "afastamento", "message": "A data/hora de retorno não pode ser anterior à ida."})
    except Exception:
        errors.append({"field": "afastamento", "message": "Informe datas/horas válidas para ida e retorno."})
        ida = ret = None

    # fora do prazo: retorno + 5 dias
    flags = payload.get("flags") or {}
    dr = payload.get("data_relatorio")
    if ret and dr:
        data_rel = _parse_date(dr)
        limite = ret.date() + timedelta(days=settings.prazo_relatorio_dias)
        flags["prestacao_contas_fora_prazo"] = data_rel > limite
    else:
        flags.setdefault("prestacao_contas_fora_prazo", False)

    if flags.get("prestacao_contas_fora_prazo"):
        if not (payload.get("justificativa_prestacao_contas_fora_prazo") or "").strip():
            errors.append({"field": "justificativa_prestacao_contas_fora_prazo", "message": "Prestação de contas fora do prazo. Informe a justificativa."})

    if errors:
        return {"ok": False, "errors": errors, "flags": flags}

    placeholders = build_placeholders_anexo2(payload, flags)
    return {"ok": True, "flags": flags, "placeholders": placeholders}
