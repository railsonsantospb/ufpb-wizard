from __future__ import annotations

from pathlib import Path
from typing import Dict

from docx import Document

def _replace_in_paragraph(paragraph, mapping: Dict[str, str]) -> None:
    # Junta runs para evitar placeholder quebrado em runs diferentes
    full = "".join(run.text for run in paragraph.runs)
    if not full:
        return

    changed = False
    for key, val in mapping.items():
        token = "{{" + key + "}}"
        if token in full:
            full = full.replace(token, val)
            changed = True

    if changed:
        # limpa runs e coloca tudo no primeiro run
        for run in paragraph.runs:
            run.text = ""
        if paragraph.runs:
            paragraph.runs[0].text = full
        else:
            paragraph.add_run(full)

def render_docx_from_template(template_path: Path, output_path: Path, mapping: Dict[str, str]) -> None:
    doc = Document(str(template_path))

    # parágrafos
    for p in doc.paragraphs:
        _replace_in_paragraph(p, mapping)

    # tabelas
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    _replace_in_paragraph(p, mapping)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
