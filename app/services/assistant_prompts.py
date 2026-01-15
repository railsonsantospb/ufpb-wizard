from __future__ import annotations

COMMON_RULES = """
REGRAS OBRIGATÓRIAS:
1) Retorne APENAS JSON válido. Nada de explicações fora do JSON.
2) Interprete datas numéricas no padrão brasileiro: DD/MM e DD/MM/AAAA (NUNCA MM/DD).
3) Se o ano não for informado, assuma o ano corrente.
4) Se a hora não for informada:
   - "de manhã" => 09:00:00
   - "à tarde"  => 14:00:00
   - "à noite"  => 20:00:00
   - se não houver pista => 09:00:00
5) Datas/horas em ISO: YYYY-MM-DDTHH:MM:SS.
6) NÃO invente: se houver dúvida/ambiguidade, registre em "questions" e/ou "consistency.warnings".
7) NÃO inclua dados sensíveis: CPF, RG, SIAPE, banco, agência, conta, endereço, telefone, email, nome da mãe.
8) Seja objetivo e institucional nos textos.
""".strip()


def prompt_anexo1_draft_from_text(user_text: str) -> str:
    return f"""
Você é um assistente para preencher o ANEXO I (Requisição de Diárias/Passagens).

{COMMON_RULES}

Extraia, quando possível:
- motivo_viagem (curto, objetivo, institucional; 1 a 3 frases)
- trechos.ida: origem, destino, data_hora
- trechos.retorno: origem, destino, data_hora
- missao: inicio_data_hora, termino_data_hora
- flags.envolve_fds_feriado_ou_dia_anterior (true se mencionar saída no dia anterior, fim de semana, feriado)

Formato de saída EXATO:
{{
  "prefill": {{
    "motivo_viagem": "...",
    "trechos": {{
      "ida": {{"origem":"...", "destino":"...", "data_hora":"YYYY-MM-DDTHH:MM:SS"}},
      "retorno": {{"origem":"...", "destino":"...", "data_hora":"YYYY-MM-DDTHH:MM:SS"}}
    }},
    "missao": {{
      "inicio_data_hora":"YYYY-MM-DDTHH:MM:SS",
      "termino_data_hora":"YYYY-MM-DDTHH:MM:SS"
    }},
    "flags": {{
      "envolve_fds_feriado_ou_dia_anterior": true
    }}
  }},
  "questions": ["..."]
}}

Texto do usuário:
\"\"\"{user_text}\"\"\"
""".strip()


def prompt_anexo2_draft_from_text(user_text: str) -> str:
    return f"""
Você é um assistente para preencher o ANEXO II (Relatório de Viagem).

{COMMON_RULES}

Extraia, quando possível:
- afastamento.ida: origem, destino, data_hora
- afastamento.retorno: origem, destino, data_hora
- atividades_desenvolvidas (objetivo; 3 a 8 linhas, sem floreio)
- viagem_realizada ("sim" ou "nao" se o usuário disser claramente)

Formato de saída EXATO:
{{
  "prefill": {{
    "afastamento": {{
      "ida": {{"origem":"...", "destino":"...", "data_hora":"YYYY-MM-DDTHH:MM:SS"}},
      "retorno": {{"origem":"...", "destino":"...", "data_hora":"YYYY-MM-DDTHH:MM:SS"}}
    }},
    "atividades_desenvolvidas": "...",
    "viagem_realizada": "sim"
  }},
  "questions": ["..."]
}}

Texto do usuário:
\"\"\"{user_text}\"\"\"
""".strip()


def prompt_review(kind: str, sanitized_payload_json: str) -> str:
    return f"""
Você é um auditor de consistência e clareza para {kind}.

{COMMON_RULES}

Tarefa:
- Aponte inconsistências ou fragilidades de preenchimento em "warnings".
- Sugira textos institucionais curtos em "suggestions" quando fizer sentido.

Formato de saída EXATO:
{{
  "warnings": ["..."],
  "suggestions": {{
    "motivo_viagem": "...",
    "justificativa_fora_prazo": "...",
    "justificativa_fds_feriado_dia_anterior": "...",
    "atividades_desenvolvidas": "..."
  }}
}}

Regras:
- Seja objetivo. Se não houver sugestão para um campo, omita a chave dentro de "suggestions".
- Não invente fatos.

JSON:
{sanitized_payload_json}
""".strip()
