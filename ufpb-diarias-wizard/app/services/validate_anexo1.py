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

def validate_and_enrich_anexo1(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors = []

    # obrigatórios mínimos (wizard garante, mas backend reforça)
    tipo = payload.get("tipo_solicitacao")
    if tipo not in ("diarias", "passagens", "diarias_e_passagens"):
        errors.append({"field": "tipo_solicitacao", "message": "Selecione o tipo de solicitação."})

    data_solic = payload.get("data_solicitacao")
    if not data_solic:
        errors.append({"field": "data_solicitacao", "message": "Informe a data da solicitação."})

    # datas principais
    try:
        ida = _parse_dt(payload["trechos"]["ida"]["data_hora"])
        ret = _parse_dt(payload["trechos"]["retorno"]["data_hora"])
        if ret < ida:
            errors.append({"field": "trechos", "message": "A data/hora de retorno não pode ser anterior à ida."})
    except Exception:
        errors.append({"field": "trechos", "message": "Informe datas/horas válidas para ida e retorno."})
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

    placeholders = build_placeholders_anexo1(payload, flags)
    return {"ok": True, "flags": flags, "placeholders": placeholders}
