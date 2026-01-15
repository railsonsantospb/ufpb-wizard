from __future__ import annotations

import subprocess
from pathlib import Path

def convert_docx_to_pdf(docx_path: Path) -> Path:
    out_dir = docx_path.parent
    cmd = [
        "soffice",
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        "--convert-to", "pdf",
        "--outdir", str(out_dir),
        str(docx_path),
    ]
    subprocess.run(cmd, check=True)

    pdf_path = out_dir / (docx_path.stem + ".pdf")
    if not pdf_path.exists():
        raise RuntimeError("Falha ao converter DOCX para PDF.")
    return pdf_path
