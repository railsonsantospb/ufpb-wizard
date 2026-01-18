# Copilot instructions for UFPB Diárias Wizard

Purpose: Help AI coding agents contribute safely and effectively to this FastAPI-based wizard that fills and exports Anexo I/II documents.

- **Big picture:** The app is a single FastAPI service serving HTML pages and JSON APIs. Frontend files live in `app/web` and `app/static`. The backend exposes preview and generate flows under `/api/*` and produces DOCX via `app/services/docx_render.py` and PDF via `app/services/pdf_convert.py` (uses LibreOffice `soffice`). Drafts are saved as JSON in the `data/` directory.

- **Key files to read first:**
  - `app/main.py` — routing, page endpoints, and the high-level generate/preview flows.
  - `app/settings.py` — canonical paths (`data_dir`, `templates_dir`) and timing constants used in validation.
  - `app/services/validate_anexo1.py` and `app/services/validate_anexo2.py` — input validation logic and return shape.
  - `app/services/placeholders.py` — builds `placeholders` mapping passed to DOCX renderer.
  - `app/services/docx_render.py` — how `{{key}}` tokens are replaced; runs are joined to avoid broken placeholders.
  - `app/services/pdf_convert.py` — converts DOCX→PDF by calling `soffice`; failures raise exceptions.

- **API shape and conventions:**
  - Preview endpoints (`/api/anexo1/preview`, `/api/anexo2/preview`) return the enriched payload (no file). Generate endpoints (`/api/anexo1/generate`, `/api/anexo2/generate`) validate then write a DOCX and optionally convert to PDF.
  - Validation functions return dicts like `{"ok": bool, "errors": [...], "flags": {...}, "placeholders": {...}}`.
  - Dates and datetimes are ISO strings; `placeholders` formatting uses `date.fromisoformat` / `datetime.fromisoformat`.

- **Template and placeholder rules:**
  - Template tokens use the `{{key}}` form. Mapping keys come from `build_placeholders_anexo1`/`anexo2` (see `app/services/placeholders.py` for examples such as `nome_completo`, `ida_origem`, `data_solicitacao`).
  - `docx_render` collects paragraph runs into a full string before replacing tokens — avoid creating tokens split across runs when editing templates.

- **Paths & runtime notes:**
  - Default runtime paths in `Settings` are absolute (e.g. `data_dir = /app/data`, `templates_dir = /app/app/templates`) — these assume the service runs inside the container image. For local, run from repository root or adjust `Settings` accordingly.
  - Ensure `anexo1_template.docx` and `anexo2_template.docx` exist under the configured templates directory before calling generate endpoints.
  - PDF conversion requires LibreOffice (`soffice`) available in PATH; conversion is performed synchronously and raises on failure.

- **Developer workflows:**
  - Quick local dev server: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` (run from repo root so relative mounts/paths match).
  - Docker: `docker-compose up --build` (there is a `Dockerfile` and `docker-compose.yml` in the repo).
  - To reproduce PDF issues locally, manually run the `soffice` command used in `app/services/pdf_convert.py` against a generated DOCX.

- **Common changes & what to watch for:**
  - When editing templates, keep placeholders intact and avoid splitting `{{...}}` across Word runs.
  - If changing `Settings` paths, update Dockerfile/compose or make settings configurable via env vars — currently `Settings` is a frozen dataclass with fixed Paths.
  - Validation logic depends on ISO date formats; adapters must convert dates before calling the backend.

- **Searchable examples in repo:**
  - Example placeholder keys: see `app/services/placeholders.py` (e.g., `nome_completo`, `ida_data_hora`, `chk_transporte_empresa_aerea`).
  - Template lookup: `app/main.py` references `anexo1_template.docx` and `anexo2_template.docx`.

If any of these runtime assumptions are wrong for your environment (paths, installed `soffice`, container vs local run), tell me which and I will update. Ready to adjust tone or add more examples if you want.
