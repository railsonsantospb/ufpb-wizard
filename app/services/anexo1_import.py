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


def normalize_text(s: str) -> str:
    """Normalize doc text before applying regexes."""
    s = s.replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def find_one(pattern: str, text: str, flags=re.IGNORECASE) -> Optional[str]:
    m = re.search(pattern, text, flags)
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

    nome = find_one(r"Nome completo:\s*(.+)", block)
    cargo = find_one(r"Cargo ou Fun[cç][aã]o que Ocupa:\s*(.+)", block)

    cpf = find_one(r"CPF:\s*([0-9\.\-]{11,14}|\d{11})", block)
    rg = find_one(r"RG:\s*([0-9\.\-]+)", block)

    nasc = find_one(r"Data de Nascimento:\s*([0-3]\d/[0-1]\d/\d{4})", block)
    siape = find_one(r"Siape:\s*(\d+)", block)

    mae = find_one(r"Nome da M[ãa]e:\s*(.+)", block)
    endereco = find_one(r"Endere[cç]o:\s*(.+)", block)

    telefone = find_one(r"Telefone:\s*([\d\(\)\-\s]+)", block)
    email = find_one(r"Email:\s*([^\s]+@[^\s]+)", block)

    banco = find_one(r"Banco:\s*([A-Za-z0-9]+)", block)
    agencia = find_one(r"Ag[êe]ncia:\s*([0-9]+)", block)
    conta = find_one(r"Conta:\s*([0-9]+)", block)

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


def _extract_text_from_docx(path: Path) -> str:
    try:
        doc = Document(path)
    except Exception as exc:
        raise ValueError("Falha ao ler DOCX.") from exc

    parts: List[str] = []
    for p in doc.paragraphs:
        if p.text:
            parts.append(p.text)
    for table in doc.tables:
        for row in table.rows:
            parts.append(" ".join(cell.text for cell in row.cells))

    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("DOCX sem texto legível.")
    return text


def _convert_doc_to_docx(path: Path) -> Path:
    tmpdir = Path(tempfile.mkdtemp())
    out_path = tmpdir / f"{path.stem}.docx"
    cmd = ["soffice", "--headless", "--convert-to", "docx", "--outdir", str(tmpdir), str(path)]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0 or not out_path.exists():
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise ValueError("Falha ao converter DOC para DOCX. Verifique o arquivo enviado.")
    return out_path


def _extract_text(source: Path) -> str:
    suffix = source.suffix.lower()
    if suffix == ".pdf":
        return normalize_text(_extract_text_from_pdf(source))
    if suffix == ".docx":
        return normalize_text(_extract_text_from_docx(source))
    if suffix == ".doc":
        converted = _convert_doc_to_docx(source)
        try:
            return normalize_text(_extract_text_from_docx(converted))
        finally:
            shutil.rmtree(converted.parent, ignore_errors=True)

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
