from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Any, Dict, Tuple

from app.settings import settings
from app.services.placeholders import build_placeholders_anexo1

def _parse_date(s: str) -> date:
    return date.fromisoformat(s)

def _parse_dt(s: str) -> datetime:
    # ISO 8601 com timezone funciona; sem timezone também.
    return datetime.fromisoformat(s)

def _is_with_passagens(tipo_solicitacao: str) -> bool:
    return tipo_solicitacao in ("passagens", "diarias_e_passagens")

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

def validate_and_enrich_anexo1(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors = []

    # obrigatórios mínimos (wizard garante, mas backend reforça)
    tipo = payload.get("tipo_solicitacao")
    if tipo not in ("diarias", "passagens", "diarias_e_passagens"):
        errors.append({"field": "tipo_solicitacao", "message": "Selecione o tipo de solicitação."})

    data_solic = payload.get("data_solicitacao")
    if not data_solic:
        errors.append({"field": "data_solicitacao", "message": "Informe a data da solicitação."})

    # trechos (lista ou objeto único)
    trechos = payload.get("trechos") or {}
    ida_list = _normalize_trecho_list(trechos.get("ida"))
    ret_list = _normalize_trecho_list(trechos.get("retorno"))
    payload["trechos"] = {"ida": ida_list, "retorno": ret_list}

    if not ida_list:
        errors.append({"field": "trechos.ida", "message": "Informe ao menos um trecho de ida."})
    if not ret_list:
        errors.append({"field": "trechos.retorno", "message": "Informe ao menos um trecho de retorno."})
    for t in ida_list:
        if not t.get("data_hora"):
            errors.append({"field": "trechos.ida", "message": "Informe datas/horas válidas para todos os trechos de ida."})
            break
    for t in ret_list:
        if not t.get("data_hora"):
            errors.append({"field": "trechos.retorno", "message": "Informe datas/horas válidas para todos os trechos de retorno."})
            break

    # datas principais (usa primeiro/último trecho)
    ida = ret = None
    try:
        if ida_list:
            ida = _parse_dt(ida_list[0]["data_hora"])
        if ret_list:
            ret = _parse_dt(ret_list[-1]["data_hora"])
        if ida and ret and ret < ida:
            errors.append({"field": "trechos", "message": "A data/hora de retorno não pode ser anterior à ida."})
    except Exception:
        errors.append({"field": "trechos", "message": "Informe datas/horas válidas para os trechos de ida e retorno."})
        ida = ret = None

    try:
        mi = _parse_dt(payload["missao"]["inicio_data_hora"])
        mt = _parse_dt(payload["missao"]["termino_data_hora"])
        if mt < mi:
            errors.append({"field": "missao", "message": "O término da missão não pode ser anterior ao início."})
        if ida and mi < ida:
            errors.append({"field": "missao", "message": "O início da missão não pode ser anterior à partida."})
        if ret and mt > ret:
            errors.append({"field": "missao", "message": "O término da missão não pode ser posterior ao retorno."})
    except Exception:
        errors.append({"field": "missao", "message": "Informe datas/horas válidas para o período da missão."})
        mi = mt = None

    # flags
    flags = payload.get("flags") or {}
    # fora do prazo conforme formulário: 10 dias sem passagens; 30 dias com passagens
    if ida and data_solic:
        ds = _parse_date(data_solic)
        prazo = settings.prazo_com_passagens_dias if _is_with_passagens(tipo) else settings.prazo_sem_passagens_dias
        limite = ida.date() - timedelta(days=prazo)
        flags["fora_do_prazo"] = ds > limite
    else:
        flags.setdefault("fora_do_prazo", False)

    # fim de semana/feriado/dia anterior: mínimo viável sem base de feriados
    if ida:
        is_weekend = ida.weekday() in (5, 6)  # sábado/domingo
        flags.setdefault("envolve_fds_feriado_ou_dia_anterior", is_weekend)
    else:
        flags.setdefault("envolve_fds_feriado_ou_dia_anterior", False)

    # justificativas condicionais
    just = payload.get("justificativas") or {}
    if flags.get("fora_do_prazo") and not (just.get("justificativa_fora_prazo") or "").strip():
        errors.append({"field": "justificativas.justificativa_fora_prazo", "message": "Solicitação fora do prazo. Informe a justificativa."})

    if flags.get("envolve_fds_feriado_ou_dia_anterior") and not (just.get("justificativa_fds_feriado_dia_anterior") or "").strip():
        errors.append({"field": "justificativas.justificativa_fds_feriado_dia_anterior", "message": "Informe a justificativa para viagem em fim de semana/feriado ou saída no dia anterior."})

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

    placeholders = build_placeholders_anexo1(payload, flags)
    return {"ok": True, "flags": flags, "placeholders": placeholders, "rows": {"ida": ida_rows, "retorno": ret_rows}}
