from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pdfplumber
from docx import Document


def _merge_label_value_lines(text: str) -> str:
    """If a line ends with ':' and next line is the value, merge them."""
    lines = [ln.strip() for ln in text.splitlines()]
    merged: List[str] = []
    skip = False
    for i, ln in enumerate(lines):
        if skip:
            skip = False
            continue
        if ln.endswith(":") and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            # next line is likely a value (not another label with colon)
            if nxt and not re.search(r":\s*$", nxt):
                merged.append(f"{ln} {nxt}")
                skip = True
                continue
        merged.append(ln)
    return "\n".join(merged)


def normalize_text(s: str) -> str:
    """Normalize doc text before applying regexes."""
    s = s.replace("\r", "\n")
    s = _merge_label_value_lines(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def find_one(pattern: str, text: str, flags=re.IGNORECASE) -> Optional[str]:
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else None


STOP_LABELS_PATTERN = (
    r"(?:Nome completo|Cargo ou Fun[cç][ãa]o que Ocupa|CPF|RG|Data de Nascimento|"
    r"Siape|Nome da M[ãa]e|Endere[cç]o|Telefone|Email|Banco|Ag[êe]ncia|Conta)\s*:"
)


def find_with_stop(label_regex: str, text: str) -> Optional[str]:
    """
    Capture value after label until the next known label (or end).
    Helps when DOCX coloca vários campos na mesma linha.
    """
    pattern = rf"{label_regex}:\s*(.+?)\s*(?={STOP_LABELS_PATTERN}|$)"
    m = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else None


def find_block(start_pat: str, end_pat: str, text: str) -> Optional[str]:
    m = re.search(start_pat + r"(.*?)" + end_pat, text, flags=re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else None


def parse_debito_recurso(text: str) -> Optional[str]:
    block = find_block(r"D[ÉE]BITO DO RECURSO:\s*", r"$", text) or ""

    if re.search(r"\(\s*[xX]\s*\)\s*CCHSA\b", block):
        return "CCHSA"
    if re.search(r"\(\s*[xX]\s*\)\s*CAVN\b", block):
        return "CAVN"
    if re.search(r"\(\s*[xX]\s*\)\s*PROJETO\b", block):
        return "PROJETO"

    m_outros = re.search(r"\(\s*[xX]\s*\)\s*Outros:\s*(.+)", block, flags=re.IGNORECASE)
    if m_outros:
        val = m_outros.group(1).strip()
        return f"OUTROS: {val}" if val else "OUTROS"

    m_outros2 = re.search(r"Outros:\s*(.+)", block, flags=re.IGNORECASE)
    if m_outros2 and m_outros2.group(1).strip():
        return f"OUTROS: {m_outros2.group(1).strip()}"
    return None


def parse_destino(text: str, tipo: str) -> Dict[str, Optional[str]]:
    if tipo.lower() == "ida":
        block = find_block(r"DESTINO\s*\(Ida\):\s*", r"DESTINO\s*\(Retorno\):", text) or ""
    else:
        block = find_block(r"DESTINO\s*\(Retorno\):\s*", r"DATA/HORA DA MISS[ÃA]O:", text) or ""

    pattern = (
        r"Local\s+de\s+Origem:\s*(?P<origem>.*?)\s*"
        r"(?=Local\s+de\s+Destino:)"
        r"Local\s+de\s+Destino:\s*(?P<destino>.*?)\s*"
        r"(?=Data\s*/?\s*Hora:)"
        r"Data\s*/?\s*Hora:\s*(?P<datahora>[0-3]\d/[0-1]\d/\d{4}\s+\d{2}:\d{2})"
    )

    m = re.search(pattern, block, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        origem = find_one(r"Local\s+de\s+Origem:\s*(.+)", block, flags=re.IGNORECASE | re.DOTALL)
        destino = find_one(r"Local\s+de\s+Destino:\s*(.+)", block, flags=re.IGNORECASE | re.DOTALL)
        dh = find_one(r"Data\s*/?\s*Hora:\s*([0-3]\d/[0-1]\d/\d{4}\s+\d{2}:\d{2})", block, flags=re.IGNORECASE | re.DOTALL)
        return {"local_origem": origem, "local_destino": destino, "data_hora": dh}

    return {
        "local_origem": m.group("origem").strip(),
        "local_destino": m.group("destino").strip(),
        "data_hora": m.group("datahora").strip(),
    }


def parse_missao(text: str) -> Dict[str, Optional[str]]:
    block = find_block(r"DATA/HORA DA MISS[ÃA]O:\s*", r"D[ÉE]BITO DO RECURSO:", text) or ""
    inicio = find_one(r"Data/Hora In[ií]cio:\s*([0-3]\d/[0-1]\d/\d{4}\s+\d{2}:\d{2})", block, flags=re.IGNORECASE | re.DOTALL)
    termino = find_one(r"Data/Hora T[eé]rmino:\s*([0-3]\d/[0-1]\d/\d{4}\s+\d{2}:\d{2})", block, flags=re.IGNORECASE | re.DOTALL)
    return {"inicio": inicio, "termino": termino}


def parse_identificacao(text: str) -> Dict[str, Any]:
    block = find_block(r"IDENTIFICAÇ[ÃA]O\s*", r"DESCRIÇ[ÃA]O DO MOTIVO DA VIAGEM:", text) or ""

    nome = find_with_stop(r"Nome completo", block)
    cargo = find_with_stop(r"Cargo ou Fun[cç][aã]o que Ocupa", block)

    cpf = find_with_stop(r"CPF", block) or find_one(r"CPF:\s*([0-9\.\-]{11,14}|\d{11})", block)
    rg = find_with_stop(r"RG", block) or find_one(r"RG:\s*([0-9\.\-]+)", block)

    nasc = find_with_stop(r"Data de Nascimento", block) or find_one(r"Data de Nascimento:\s*([0-3]\d/[0-1]\d/\d{4})", block)
    siape = find_with_stop(r"Siape", block) or find_one(r"Siape:\s*(\d+)", block)

    mae = find_with_stop(r"Nome da M[ãa]e", block)
    endereco = find_with_stop(r"Endere[cç]o", block)

    telefone = find_with_stop(r"Telefone", block) or find_one(r"Telefone:\s*([\d\(\)\-\s]+)", block)
    email = find_with_stop(r"Email", block) or find_one(r"Email:\s*([^\s]+@[^\s]+)", block)

    banco = find_with_stop(r"Banco", block) or find_one(r"Banco:\s*([A-Za-z0-9]+)", block)
    agencia = find_with_stop(r"Ag[êe]ncia", block) or find_one(r"Ag[êe]ncia:\s*([0-9]+)", block)
    conta = find_with_stop(r"Conta", block) or find_one(r"Conta:\s*([0-9]+)", block)

    return {
        "nome_completo": nome,
        "cargo_funcao": cargo,
        "cpf": cpf,
        "rg": rg,
        "data_nascimento": nasc,
        "siape": siape,
        "nome_mae": mae,
        "endereco": endereco,
        "telefone": telefone,
        "email": email,
        "dados_bancarios": {"banco": banco, "agencia": agencia, "conta": conta},
    }


def parse_motivo_viagem(text: str) -> Optional[str]:
    block = find_block(r"DESCRIÇ[ÃA]O DO MOTIVO DA VIAGEM:\s*", r"DESTINO\s*\(Ida\):", text)
    return block.strip() if block else None


def clean(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            v2 = clean(v)
            if v2 in (None, "", {}, []):
                continue
            out[k] = v2
        return out
    if isinstance(obj, list):
        return [clean(v) for v in obj if v not in (None, "")]
    return obj


def _extract_text_from_pdf(path: Path) -> str:
    try:
        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages).strip()
        if not text:
            raise ValueError("PDF sem texto. Envie um PDF que não seja imagem/scan.")
        return text
    except Exception as exc:
        raise ValueError("Falha ao ler PDF. Certifique-se de que é um PDF com texto.") from exc


def _convert_to_pdf(path: Path) -> Path:
    tmpdir = Path(tempfile.mkdtemp())
    out_path = tmpdir / f"{path.stem}.pdf"
    cmd = ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(tmpdir), str(path)]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0 or not out_path.exists():
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise ValueError("Falha ao converter arquivo para PDF. Verifique se o DOC/DOCX está legível.")
    return out_path


def _extract_text(source: Path) -> str:
    suffix = source.suffix.lower()
    if suffix == ".pdf":
        return normalize_text(_extract_text_from_pdf(source))
    if suffix in (".docx", ".doc"):
        pdf_path = _convert_to_pdf(source)
        try:
            return normalize_text(_extract_text_from_pdf(pdf_path))
        finally:
            shutil.rmtree(pdf_path.parent, ignore_errors=True)

    raise ValueError("Formato não suportado. Envie PDF, DOC ou DOCX.")


def parse_doc_to_json(source: Path | str) -> Dict[str, Any]:
    text = _extract_text(Path(source))
    data = {
        "identificacao": parse_identificacao(text),
        "motivo_viagem": parse_motivo_viagem(text),
        "destino_ida": parse_destino(text, "Ida"),
        "destino_retorno": parse_destino(text, "Retorno"),
        "missao": parse_missao(text),
        "debito_recurso": parse_debito_recurso(text),
    }
    return clean(data)


def _only_digits(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"\D+", "", value)
    return digits or None


def _parse_br_datetime(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            dt = datetime.strptime(value.strip(), fmt)
            return dt.strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            continue
    return None


def _map_orgao(debito: Optional[str]) -> Dict[str, Optional[str]]:
    if not debito:
        return {}
    deb = debito.upper()
    if deb.startswith("CCHSA"):
        return {"tipo": "cchsa"}
    if deb.startswith("CAVN"):
        return {"tipo": "cavn"}
    if deb.startswith("PROJETO"):
        return {"tipo": "projetos"}
    if deb.startswith("OUTROS"):
        detalhe = debito.split(":", 1)[1].strip() if ":" in debito else None
        return {"tipo": "outros", "detalhe": detalhe or None}
    return {}


def build_anexo2_prefill(parsed: Dict[str, Any]) -> Dict[str, Any]:
    ident = parsed.get("identificacao") or {}
    ida = parsed.get("destino_ida") or {}
    ret = parsed.get("destino_retorno") or {}
    missao = parsed.get("missao") or {}

    ida_dt = _parse_br_datetime(ida.get("data_hora")) or _parse_br_datetime(missao.get("inicio"))
    ret_dt = _parse_br_datetime(ret.get("data_hora")) or _parse_br_datetime(missao.get("termino"))

    orgao = _map_orgao(parsed.get("debito_recurso"))
    atividades = parsed.get("motivo_viagem")
    if isinstance(atividades, str):
        atividades = re.sub(r"\s*#+\s*$", "", atividades).strip()

    prefill = {
        "proposto": {
            "nome": ident.get("nome_completo"),
            "cpf": _only_digits(ident.get("cpf")),
            "siape": _only_digits(ident.get("siape")),
            "orgao": orgao,
        },
        "afastamento": {
            "ida": {"origem": ida.get("local_origem"), "destino": ida.get("local_destino"), "data_hora": ida_dt},
            "retorno": {"origem": ret.get("local_origem"), "destino": ret.get("local_destino"), "data_hora": ret_dt},
        },
        "atividades_desenvolvidas": atividades,
        "viagem_realizada": "sim",
    }

    return clean(prefill)


def _build_warnings(prefill: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    prop = prefill.get("proposto") or {}
    afast = prefill.get("afastamento") or {}

    if not prop.get("nome"):
        warnings.append("Nome do proposto não identificado no Anexo I.")
    if not prop.get("cpf"):
        warnings.append("CPF não identificado ou ilegível no Anexo I.")
    if not prop.get("siape"):
        warnings.append("SIAPE não encontrado no Anexo I.")
    orgao = prop.get("orgao") or {}
    if not orgao:
        warnings.append("Órgão (débito do recurso) não localizado; selecione manualmente.")
    elif orgao.get("tipo") in ("projetos", "outros") and not orgao.get("detalhe"):
        warnings.append("Detalhe do órgão para Projetos/Outros não foi identificado.")

    ida = afast.get("ida") or {}
    ret = afast.get("retorno") or {}
    if not ida.get("origem") or not ida.get("destino"):
        warnings.append("Trecho de ida incompleto; revise origem/destino.")
    if not ret.get("origem") or not ret.get("destino"):
        warnings.append("Trecho de retorno incompleto; revise origem/destino.")
    if not ida.get("data_hora") or not ret.get("data_hora"):
        warnings.append("Datas/horários não foram lidos; informe manualmente.")

    if not prefill.get("atividades_desenvolvidas"):
        warnings.append("Motivo/atividades não encontrados; escreva o relatório.")

    return warnings


@dataclass
class Anexo1PrefillResult:
    prefill: Dict[str, Any]
    warnings: List[str]


def extract_prefill_from_anexo1(source: Path | str) -> Anexo1PrefillResult:
    parsed = parse_doc_to_json(source)
    if not parsed:
        raise ValueError("Não foi possível interpretar o documento.")

    prefill = build_anexo2_prefill(parsed)
    warnings = _build_warnings(prefill)
    return Anexo1PrefillResult(prefill=prefill, warnings=warnings)


def _parse_br_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        dt = datetime.strptime(value.strip(), "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _map_debito_recurso_anexo1(debito: Optional[str]) -> Dict[str, Optional[str]]:
    if not debito:
        return {}
    deb = debito.upper()
    if deb.startswith("CCHSA"):
        return {"tipo": "cchsa"}
    if deb.startswith("CAVN"):
        return {"tipo": "cavn"}
    if deb.startswith("PROJETO"):
        return {"tipo": "projeto"}
    if deb.startswith("OUTROS"):
        detalhe = debito.split(":", 1)[1].strip() if ":" in debito else None
        return {"tipo": "outros", "detalhe": detalhe or None}
    return {}


def build_anexo1_prefill(parsed: Dict[str, Any]) -> Dict[str, Any]:
    ident = parsed.get("identificacao") or {}
    ida = parsed.get("destino_ida") or {}
    ret = parsed.get("destino_retorno") or {}
    missao = parsed.get("missao") or {}

    ida_dt = _parse_br_datetime(ida.get("data_hora")) or _parse_br_datetime(missao.get("inicio"))
    ret_dt = _parse_br_datetime(ret.get("data_hora")) or _parse_br_datetime(missao.get("termino"))
    mi_dt = _parse_br_datetime(missao.get("inicio"))
    mf_dt = _parse_br_datetime(missao.get("termino"))

    prefill = {
        "tipo_solicitacao": None,
        "data_solicitacao": None,
        "servidor": {
            "nome_completo": ident.get("nome_completo"),
            "cargo_funcao": ident.get("cargo_funcao"),
            "cpf": _only_digits(ident.get("cpf")),
            "rg": ident.get("rg"),
            "data_nascimento": _parse_br_date(ident.get("data_nascimento")),
            "siape": _only_digits(ident.get("siape")),
            "nome_mae": ident.get("nome_mae"),
            "endereco": ident.get("endereco"),
            "telefone": _only_digits(ident.get("telefone")),
            "email": ident.get("email"),
            "dados_bancarios": {
                "banco": ident.get("dados_bancarios", {}).get("banco"),
                "agencia": ident.get("dados_bancarios", {}).get("agencia"),
                "conta": ident.get("dados_bancarios", {}).get("conta"),
            },
        },
        "trechos": {
            "ida": [{"origem": ida.get("local_origem"), "destino": ida.get("local_destino"), "data_hora": ida_dt}],
            "retorno": [{"origem": ret.get("local_origem"), "destino": ret.get("local_destino"), "data_hora": ret_dt}],
        },
        "missao": {"inicio_data_hora": mi_dt, "termino_data_hora": mf_dt},
        "debito_recurso": _map_debito_recurso_anexo1(parsed.get("debito_recurso")),
        "transporte": {"meios": [], "termo_veiculo_proprio_ciente": False},
        "motivo_viagem": parsed.get("motivo_viagem"),
    }

    return clean(prefill)


def build_anexo1_warnings(prefill: Dict[str, Any], *, skip_trechos: bool = False) -> List[str]:
    warnings: List[str] = []
    servidor = prefill.get("servidor") or {}
    trechos = prefill.get("trechos") or {}
    deb = prefill.get("debito_recurso") or {}

    if not servidor.get("nome_completo"):
        warnings.append("Nome completo não identificado.")
    if not servidor.get("cpf"):
        warnings.append("CPF não identificado ou ilegível.")
    if not servidor.get("siape"):
        warnings.append("SIAPE não identificado.")
    if not servidor.get("data_nascimento"):
        warnings.append("Data de nascimento não encontrada.")

    if not skip_trechos:
        ida_list = trechos.get("ida") or []
        ret_list = trechos.get("retorno") or []
        ida = ida_list[0] if isinstance(ida_list, list) and ida_list else {}
        ret = ret_list[0] if isinstance(ret_list, list) and ret_list else {}
        if not ida.get("origem") or not ida.get("destino"):
            warnings.append("Trecho de ida incompleto; revise origem/destino.")
        if not ret.get("origem") or not ret.get("destino"):
            warnings.append("Trecho de retorno incompleto; revise origem/destino.")
        if not ida.get("data_hora") or not ret.get("data_hora"):
            warnings.append("Datas/horários não foram lidos; informe manualmente.")

    if not deb.get("tipo"):
        warnings.append("Débito do recurso não identificado; selecione manualmente.")

    if not prefill.get("motivo_viagem"):
        warnings.append("Motivo da viagem não encontrado.")

    return warnings


@dataclass
class Anexo1SelfPrefillResult:
    prefill: Dict[str, Any]
    warnings: List[str]


def extract_prefill_for_anexo1(source: Path | str) -> Anexo1SelfPrefillResult:
    parsed = parse_doc_to_json(source)
    if not parsed:
        raise ValueError("Não foi possível interpretar o documento.")

    prefill = build_anexo1_prefill(parsed)
    prefill["trechos"] = {"ida": [], "retorno": []}
    warnings = build_anexo1_warnings(prefill, skip_trechos=True)
    return Anexo1SelfPrefillResult(prefill=prefill, warnings=warnings)
