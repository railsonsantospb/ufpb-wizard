# UFPB Diarias Wizard

Ferramenta online que guia o preenchimento dos formulários de diárias da UFPB (Anexo I e Anexo II). Ela mostra os passos, avisa sobre prazos e campos obrigatórios e, no fim, gera o arquivo pronto em DOCX ou PDF.

## O que ele faz
- Passo a passo para preencher Anexo I (requisição) e Anexo II (relatório).
- Confere datas, prazos e inconsistências antes de gerar o documento.
- Exporta DOCX e também PDF a partir do mesmo conteúdo.
- Usa modelos em `app/templates` com campos marcados para receber as informações.
- Salva rascunhos em `data/` para você continuar depois.
- Interface simples feita com HTML, CSS e JavaScript (arquivos em `app/web` e `app/static`).

## Principais tecnologias (em linguagem simples)
- Python 3.12 (`python:3.12-slim`) — a linguagem em que o sistema foi escrito.
- FastAPI (versão varia conforme o build) — organiza as rotas e entrega as páginas.
- Uvicorn (versão varia conforme o build) — coloca o aplicativo FastAPI no ar.
- Pydantic e Jsonschema (versões variáveis) — conferem se os dados estão completos e no formato correto.
- Python-docx (versão variável) — preenche os modelos DOCX com as informações digitadas.
- Python-multipart (versão variável) — permite enviar formulários com vários tipos de campo.
- Requests (versão variável) — cliente HTTP usado quando o sistema precisa chamar outro serviço.
- LibreOffice Writer (versão do pacote Debian da imagem) — transforma o DOCX em PDF.
- HTML5, CSS3 e JavaScript (ES6+) — montam as telas, cores e interações do wizard no navegador, sem frameworks.
- Docker e Docker Compose (versão do seu ambiente) — empacotam tudo para rodar igual em qualquer máquina.

## Sobre as versoes
As bibliotecas Python são instaladas sem versões “travadas” no `Dockerfile`. Isso quer dizer que a versão exata depende da data em que você fizer o build. Se quiser resultados sempre iguais, fixe as versões no comando `pip install`.
