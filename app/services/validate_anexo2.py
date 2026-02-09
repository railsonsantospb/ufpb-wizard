from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Any, Dict

from app.settings import settings
from app.services.placeholders import build_placeholders_anexo2

def _parse_date(s: str) -> date:
    return date.fromisoformat(s)

def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s)

def _normalize_trecho_list(value: Any) -> list[Dict[str, Any]]:
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        return [value]
    return []

def _fmt_dt_opt(value: Any) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(value).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return ""

def validate_and_enrich_anexo2(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors = []

    # datas ida/retorno
    try:
        afast = payload.get("afastamento") or {}
        ida_list = _normalize_trecho_list(afast.get("ida"))
        ret_list = _normalize_trecho_list(afast.get("retorno"))
        payload["afastamento"] = {"ida": ida_list, "retorno": ret_list}

        if not ida_list:
            errors.append({"field": "afastamento.ida", "message": "Informe ao menos um trecho de ida."})
        if not ret_list:
            errors.append({"field": "afastamento.retorno", "message": "Informe ao menos um trecho de retorno."})
        for t in ida_list:
            if not t.get("data_hora"):
                errors.append({"field": "afastamento.ida", "message": "Informe datas/horas válidas para todos os trechos de ida."})
                break
        for t in ret_list:
            if not t.get("data_hora"):
                errors.append({"field": "afastamento.retorno", "message": "Informe datas/horas válidas para todos os trechos de retorno."})
                break

        ida = _parse_dt(ida_list[0]["data_hora"]) if ida_list else None
        ret = _parse_dt(ret_list[-1]["data_hora"]) if ret_list else None
        if ida and ret and ret < ida:
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

    ida_rows = [
        {
            "ida_origem": t.get("origem") or "",
            "ida_destino": t.get("destino") or "",
            "ida_data_hora": _fmt_dt_opt(t.get("data_hora")),
        }
        for t in ida_list
    ]
    ret_rows = [
        {
            "retorno_origem": t.get("origem") or "",
            "retorno_destino": t.get("destino") or "",
            "retorno_data_hora": _fmt_dt_opt(t.get("data_hora")),
        }
        for t in ret_list
    ]

    placeholders = build_placeholders_anexo2(payload, flags)
    return {"ok": True, "flags": flags, "placeholders": placeholders, "rows": {"ida": ida_rows, "retorno": ret_rows}}
