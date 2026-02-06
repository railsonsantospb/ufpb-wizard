FROM python:3.12-slim

# LibreOffice para converter DOCX->PDF e opcionalmente DOC->DOCX
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-common \
    fonts-dejavu-core \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./app /app/app
COPY ./README.md /app/README.md

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    pydantic \
    jsonschema \
    python-docx \
    pdfplumber \
    requests

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]


