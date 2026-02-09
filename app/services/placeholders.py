from __future__ import annotations

from datetime import datetime, date
from typing import Any, Dict

def _fmt_date(s: str) -> str:
    d = date.fromisoformat(s)
    return d.strftime("%d/%m/%Y")

def _fmt_dt(s: str) -> str:
    dt = datetime.fromisoformat(s)
    return dt.strftime("%d/%m/%Y %H:%M")

def _fmt_dt_opt(s: str | None) -> str:
    if not s:
        return ""
    try:
        return _fmt_dt(s)
    except Exception:
        return ""

def _normalize_trechos(value: Any) -> list[dict]:
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        return [value]
    return []

def _x(flag: bool) -> str:
    return "X" if flag else ""

def build_placeholders_anexo1(payload: Dict[str, Any], flags: Dict[str, Any]) -> Dict[str, str]:
    tipo = payload["tipo_solicitacao"]
    servidor = payload["servidor"]
    trechos = payload["trechos"]
    missao = payload["missao"]
    deb = payload["debito_recurso"]
    transp = payload["transporte"]
    just = payload.get("justificativas") or {}

    meios = set(transp.get("meios", []))

    # débito do recurso
    deb_tipo = deb["tipo"]
    deb_det = (deb.get("detalhe") or "").strip()

    ph = {
        "data_solicitacao": _fmt_date(payload["data_solicitacao"]),

        "chk_diarias": _x(tipo in ("diarias", "diarias_e_passagens")),
        "chk_passagens": _x(tipo in ("passagens", "diarias_e_passagens")),

        "nome_completo": servidor["nome_completo"],
        "cargo_funcao": servidor["cargo_funcao"],
        "cpf": servidor["cpf"],
        "rg": servidor["rg"],
        "data_nascimento": _fmt_date(servidor["data_nascimento"]),
        "siape": servidor["siape"],
        "nome_mae": servidor["nome_mae"],
        "endereco": servidor["endereco"],
        "telefone": servidor["telefone"],
        "email": servidor["email"],
        "banco": servidor["dados_bancarios"]["banco"],
        "agencia": servidor["dados_bancarios"]["agencia"],
        "conta": servidor["dados_bancarios"]["conta"],

        "motivo_viagem": payload["motivo_viagem"],

        "ida_origem": "\n".join((t.get("origem") or "") for t in _normalize_trechos(trechos.get("ida"))),
        "ida_destino": "\n".join((t.get("destino") or "") for t in _normalize_trechos(trechos.get("ida"))),
        "ida_data_hora": "\n".join(_fmt_dt_opt(t.get("data_hora")) for t in _normalize_trechos(trechos.get("ida"))),

        "retorno_origem": "\n".join((t.get("origem") or "") for t in _normalize_trechos(trechos.get("retorno"))),
        "retorno_destino": "\n".join((t.get("destino") or "") for t in _normalize_trechos(trechos.get("retorno"))),
        "retorno_data_hora": "\n".join(_fmt_dt_opt(t.get("data_hora")) for t in _normalize_trechos(trechos.get("retorno"))),

        "missao_inicio_data_hora": _fmt_dt(missao["inicio_data_hora"]),
        "missao_termino_data_hora": _fmt_dt(missao["termino_data_hora"]),

        "chk_recurso_cchsa": _x(deb_tipo == "cchsa"),
        "chk_recurso_cavn": _x(deb_tipo == "cavn"),
        "chk_recurso_projeto": _x(deb_tipo == "projeto"),
        "chk_recurso_outros": _x(deb_tipo == "outros"),
        "recurso_projeto": deb_det if deb_tipo == "projeto" else "",
        "recurso_outros": deb_det if deb_tipo == "outros" else "",

        "chk_transporte_veiculo_oficial": _x("veiculo_oficial" in meios),
        "chk_transporte_empresa_terrestre": _x("empresa_terrestre" in meios),
        "chk_transporte_empresa_aerea": _x("empresa_aerea" in meios),
        "chk_transporte_veiculo_proprio": _x("veiculo_proprio" in meios),

        "justificativa_fds_feriado_dia_anterior": (just.get("justificativa_fds_feriado_dia_anterior") or "") if flags.get("envolve_fds_feriado_ou_dia_anterior") else "",
        "justificativa_fora_prazo": (just.get("justificativa_fora_prazo") or "") if flags.get("fora_do_prazo") else ""
    }
    # garantir string
    return {k: ("" if v is None else str(v)) for k, v in ph.items()}

def build_placeholders_anexo2(payload: Dict[str, Any], flags: Dict[str, Any]) -> Dict[str, str]:
    proposto = payload["proposto"]
    orgao = proposto["orgao"]
    afast = payload["afastamento"]

    org_tipo = orgao["tipo"]
    det = (orgao.get("detalhe") or "").strip()

    ph = {
        "data_relatorio": _fmt_date(payload["data_relatorio"]),

        "nome": proposto["nome"],
        "cpf": proposto["cpf"],
        "siape": proposto["siape"],

        "chk_orgao_cchsa": _x(org_tipo == "cchsa"),
        "chk_orgao_cavn": _x(org_tipo == "cavn"),
        "chk_orgao_projetos": _x(org_tipo == "projetos"),
        "chk_orgao_outros": _x(org_tipo == "outros"),
        "orgao_projetos": det if org_tipo == "projetos" else "",
        "orgao_outros": det if org_tipo == "outros" else "",

        "ida_origem": "\n".join((t.get("origem") or "") for t in _normalize_trechos(afast.get("ida"))),
        "ida_destino": "\n".join((t.get("destino") or "") for t in _normalize_trechos(afast.get("ida"))),
        "ida_data_hora": "\n".join(_fmt_dt_opt(t.get("data_hora")) for t in _normalize_trechos(afast.get("ida"))),

        "retorno_origem": "\n".join((t.get("origem") or "") for t in _normalize_trechos(afast.get("retorno"))),
        "retorno_destino": "\n".join((t.get("destino") or "") for t in _normalize_trechos(afast.get("retorno"))),
        "retorno_data_hora": "\n".join(_fmt_dt_opt(t.get("data_hora")) for t in _normalize_trechos(afast.get("retorno"))),

        "atividades_desenvolvidas": payload["atividades_desenvolvidas"],

        "justificativa_prestacao_contas_fora_prazo": (payload.get("justificativa_prestacao_contas_fora_prazo") or "") if flags.get("prestacao_contas_fora_prazo") else "",

        "chk_viagem_realizada_sim": _x(payload["viagem_realizada"] == "sim"),
        "chk_viagem_realizada_nao": _x(payload["viagem_realizada"] == "nao")
    }
    return {k: ("" if v is None else str(v)) for k, v in ph.items()}
