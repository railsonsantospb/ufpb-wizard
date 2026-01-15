from __future__ import annotations

import os
import requests
from typing import Any, Dict

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

class OllamaError(RuntimeError):
    pass

def generate_text(prompt: str, temperature: float = 0.2, timeout_s: int = 60) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"
    try:
        r = requests.post(
            url,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "top_p": 0.9,
                    "repeat_penalty": 1.1,
                    "num_ctx": 4096
                }
            },
            timeout=timeout_s,
        )
        r.raise_for_status()
        data = r.json()
        return (data.get("response") or "").strip()
    except Exception as e:
        raise OllamaError(f"Falha ao chamar Ollama em {url}: {e}")
