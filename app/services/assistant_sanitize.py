from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

SENSITIVE_KEYS = {
    "cpf", "rg", "siape",
    "dados_bancarios", "banco", "agencia", "conta",
    "nome_mae", "endereco", "telefone", "email",
}

def _remove_keys(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in SENSITIVE_KEYS:
                continue
            out[k] = _remove_keys(v)
        return out
    if isinstance(obj, list):
        return [_remove_keys(x) for x in obj]
    return obj

def sanitize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    # copia e remove chaves sensíveis
    return _remove_keys(deepcopy(payload))
