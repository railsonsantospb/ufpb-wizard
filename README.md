# 🎯 UFPB FORMS ON

Uma ferramenta online inteligente e fácil de usar que guia o preenchimento dos formulários de diárias da UFPB. O sistema verifica automaticamente todas as informações, avisa sobre prazos e requisitos obrigatórios e gera documentos prontos em **DOCX** ou **PDF** com um único clique.

> **Resumo simples:** Este sistema funciona como um "assistente virtual" que evita erros ao preencher formulários de diárias e gera os documentos automaticamente.

---

## 📋 O que o sistema faz

### Funcionalidades principais
- ✅ **Passo a passo guiado** para preencher dois tipos de formulários:
  - **Anexo I:** Requisição de viagem (com informações do servidor, rotas, datas e custos)
  - **Anexo II:** Relatório da viagem (confirmando o que foi realizado e despesas)
  
- 🔍 **Validação automática:**
  - Confere se as datas estão corretas (retorno não pode ser antes da ida)
  - Verifica se você completou todos os campos obrigatórios
  - Alerta sobre prazos (ex: solicitação fora do prazo requer justificativa)
  - Detecta fins de semana e feriados automaticamente

- 📄 **Exportação flexível:**
  - Gera documentos em **DOCX** (Word) — pronto para editar se necessário
  - Gera em **PDF** — pronto para imprimir e assinar
  - Usa o mesmo conteúdo para ambos os formatos

- 💾 **Salvamento automático:**
  - Salva seus rascunhos a cada mudança
  - Você pode voltar depois e continuar de onde parou
  - Cada rascunho recebe um código único (ID)

- 🎨 **Interface simples e limpa:**
  - Sem complicações técnicas — feito com HTML, CSS e JavaScript
  - Funciona em qualquer navegador moderno
  - Responsivo (funciona em celular, tablet e computador)

---

## 🚀 Como começar

### Pré-requisitos
Você precisará ter instalado:
- **Docker** — para empacotar e rodar a aplicação
- **Docker Compose** — para gerenciar múltiplos serviços

Se não tiver Docker, veja as instruções em https://docs.docker.com/get-docker/

### Instalação rápida (com Docker)

1. **Clone ou baixe o repositório:**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd ufpb-wizard
   ```

2. **Inicie o sistema:**
   ```bash
   docker-compose up --build
   ```

3. **Abra no navegador:**
   ```
   http://localhost:8000
   ```

Pronto! O sistema está rodando. Você verá a página inicial com os dois formulários disponíveis.

### Instalação local (sem Docker)

Se preferir rodar localmente sem Docker:

1. **Instale o Python 3.12+:**
   - Verifique: `python --version`

2. **Instale as dependências:**
   ```bash
   pip install fastapi uvicorn python-docx python-multipart requests jsonschema pydantic
   ```

3. **Instale o LibreOffice (necessário para converter para PDF):**
   - **Windows:** Baixe em https://www.libreoffice.org
   - **macOS:** `brew install libreoffice`
   - **Linux (Ubuntu/Debian):** `sudo apt-get install libreoffice`

4. **Inicie o servidor:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Abra no navegador:** `http://localhost:8000`

---

## 📂 Estrutura do projeto

```
ufpb-wizard/
├── app/                          # Código principal da aplicação
│   ├── main.py                   # Rotas e endpoints da API
│   ├── settings.py               # Configurações (caminhos, prazos, etc)
│   │
│   ├── schemas/                  # Regras de validação em JSON
│   │   ├── anexo1.schema.json    # Estrutura esperada do Anexo I
│   │   └── anexo2.schema.json    # Estrutura esperada do Anexo II
│   │
│   ├── services/                 # Funções que fazem o trabalho pesado
│   │   ├── validate_anexo1.py    # Valida dados do Anexo I
│   │   ├── validate_anexo2.py    # Valida dados do Anexo II
│   │   ├── placeholders.py       # Prepara dados para preencher templates
│   │   ├── docx_render.py        # Preenche os arquivos DOCX com dados
│   │   └── pdf_convert.py        # Converte DOCX para PDF
│   │
│   ├── templates/                # Modelos de documentos
│   │   ├── anexo1_template.docx  # Modelo do Anexo I (Word)
│   │   └── anexo2_template.docx  # Modelo do Anexo II (Word)
│   │
│   ├── web/                      # Páginas HTML (o que você vê no navegador)
│   │   ├── index.html            # Página inicial com menu
│   │   ├── anexo1.html           # Formulário do Anexo I
│   │   ├── anexo2.html           # Formulário do Anexo II
│   │   └── review.html           # Página de revisão antes de gerar
│   │
│   └── static/                   # Arquivos CSS e imagens
│       └── styles.css            # Estilos (cores, fontes, layout)
│
├── data/                         # Pasta onde os rascunhos são salvos
│   └── (arquivos .json com rascunhos)
│
├── Dockerfile                    # Instruções para criar a imagem Docker
├── docker-compose.yml            # Configuração para rodar com Docker
└── README.md                     # Este arquivo
```

### O que cada parte faz

| Pasta/Arquivo | Função |
|---|---|
| `app/main.py` | Define todas as páginas e APIs (endpoints) que o sistema oferece |
| `app/settings.py` | Guarda configurações como: caminhos das pastas, prazos de entrega, etc |
| `app/services/` | Arquivo com as "regras" de negócio — validação, cálculo de prazos, preenchimento de documentos |
| `app/templates/` | Modelos em Word que servem como base para os documentos finais |
| `app/web/` | Páginas HTML que aparecem no navegador |
| `app/static/` | Códigos CSS que deixam a interface bonita |
| `data/` | Banco de dados simples: rascunhos salvos como arquivos .json |

---

## 🔧 Como usar o sistema

### Fluxo básico (Passo a passo)

1. **Acesse a página inicial:** `http://localhost:8000`

2. **Escolha o tipo de formulário:**
   - Clique em "Anexo I" se é uma requisição de viagem
   - Clique em "Anexo II" se é um relatório de viagem

3. **Preencha os campos:**
   - O sistema mostra apenas os campos necessários (se você selecionar "Diárias", não precisa preencher passagens)
   - Todos os campos obrigatórios são marcados com um `*` vermelho
   - O sistema salva automaticamente conforme você digita

4. **Revise as informações:**
   - Clique em "Visualizar" para ver como ficará o documento
   - O sistema mostra avisos em vermelho se algo estiver errado

5. **Gere o documento:**
   - Escolha entre **DOCX** ou **PDF**
   - Clique em "Gerar"
   - Seu navegador baixa o arquivo automaticamente

### Entendendo os prazos

O sistema valida automaticamente se sua solicitação está dentro do prazo correto:

| Situação | Prazo | O que significa |
|---|---|---|
| Solicitação de **Diárias** | 10 dias antes da viagem | Você deve solicitar até 10 dias antes de partir |
| Solicitação com **Passagens** | 30 dias antes da viagem | Você deve solicitar até 30 dias antes de partir |
| **Relatório** (Anexo II) | 5 dias após retornar | Você deve enviar o relatório até 5 dias depois que volta |

Se passar do prazo, o sistema vai avisar e pedir uma justificativa.

---

## 🛠️ Principais tecnologias

| Tecnologia | Para quê | Detalhes |
|---|---|---|
| **Python 3.12** | Linguagem principal do sistema | Moderno, fácil de manter e entender |
| **FastAPI** | Framework web para criar a API | Rápido, com validação automática de dados |
| **Uvicorn** | Servidor que coloca a aplicação no ar | Leve e de alta performance |
| **Pydantic** | Valida dados que chegam do navegador | Garante que os dados estão no formato correto |
| **Python-DOCX** | Preenche arquivos Word programaticamente | Lê o template e substitui os campos marcados |
| **LibreOffice** | Converte DOCX para PDF | Roda sem interface gráfica (headless) |
| **HTML5 + CSS3 + JavaScript (ES6+)** | Interface no navegador | Sem dependências de frameworks (vanilla JS) — mais leve |
| **Docker + Docker Compose** | Empacota tudo e roda em qualquer máquina | Garante que funciona igual no seu PC, servidor, etc |

---

## 🧠 Fundamentos de IA e automação usados

- **Validação baseada em regras (raciocínio simbólico):** o backend (`app/services/validate_anexo1.py` e `app/services/validate_anexo2.py`) cruza datas, tipo de solicitação e flags para bloquear inconsistências (retorno < ida, missão fora do intervalo, pedido fora do prazo) e exigir justificativas quando necessário. O frontend (`app/static/anexo1.js` e `app/static/anexo2.js`) replica as mesmas regras para feedback imediato.
- **Representação de conhecimento com JSON Schema:** os esquemas em `app/schemas/anexo1.schema.json` e `app/schemas/anexo2.schema.json` descrevem os campos, formatos e condicionais (ex.: detalhar órgão em “Projetos/Outros”), servindo de contrato único para captura e validação dos dados.
- **Inferência temporal e detecção de prazos:** as constantes de negócio em `app/settings.py` (10, 30 e 5 dias) alimentam cálculos de prazo e marcadores automáticos de fim de semana/feriado, funcionando como um pequeno motor de restrições para “fora do prazo” e “envolve_fds_feriado_ou_dia_anterior”.
- **Extração de informação de documentos (Document AI sem ML):** o importador `app/services/anexo1_import.py` usa `pdfplumber` + expressões regulares/normalização para ler Anexo I em PDF/DOC/DOCX, localizar rótulos e valores e pré-preencher o formulário. Avisos são emitidos quando algum campo não foi lido com confiança.
- **Assistente conversacional determinístico:** os chats embutidos nos formulários são máquinas de estado no próprio navegador (`app/static/anexo1.js` e `app/static/anexo2.js`) que conduzem o usuário passo a passo, reutilizando validações de CPF/SIAPE/datas e sugerindo próximos campos — sem depender de serviços externos ou LLMs.
- **Geração orientada a templates:** o preenchimento é feito por mapeamento direto de placeholders `{{campo}}` (`app/services/docx_render.py`), separando lógica de negócio do layout e permitindo evoluções controladas nos modelos Word e na conversão para PDF (`app/services/pdf_convert.py`).

> Nota: não há modelos de machine learning ou LLM em execução; a “inteligência” vem de regras explícitas, inferência de datas e extração heurística de texto.

---

## 📝 Como os documentos são gerados

### Fluxo de preenchimento

```
1. Você preenche o formulário no navegador
   ↓
2. Clica em "Gerar"
   ↓
3. O servidor recebe os dados
   ↓
4. Valida tudo (datas, campos obrigatórios, prazos)
   ↓
5. Se tudo OK, busca o template (anexo1_template.docx ou anexo2_template.docx)
   ↓
6. Substitui os campos marcados (ex: {{nome_completo}} → "João Silva")
   ↓
7. Salva como novo arquivo DOCX na pasta data/
   ↓
8. Se você pediu PDF, converte usando LibreOffice
   ↓
9. Seu navegador baixa o arquivo
```

### Formato dos campos no template

Os templates usam a notação `{{campo}}` para marcar os lugares que devem ser preenchidos:

```
Exemplo no Word:
"O servidor {{nome_completo}} solicita diárias para viagem de {{ida_origem}} até {{ida_destino}}"

Resultado final:
"O servidor João Silva solicita diárias para viagem de São Paulo até Brasília"
```

---

## 📦 Versões das bibliotecas

As bibliotecas Python são instaladas **sem versões fixas** no `Dockerfile`. Isso significa:

| Vantagem | Desvantagem |
|---|---|
| Sempre tem as últimas correções de segurança | Pode haver pequenas diferenças entre builds em datas diferentes |

Se você precisa de **resultados 100% consistentes** (ex: em produção), adicione números de versão ao Dockerfile:

```dockerfile
RUN pip install \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    python-docx==0.8.11
```

---

## 🐳 Usando Docker

### Ver os containers rodando
```bash
docker-compose ps
```

### Ver logs da aplicação
```bash
docker-compose logs -f app
```

### Parar a aplicação
```bash
docker-compose down
```

### Reconstruir a imagem (depois de mudanças)
```bash
docker-compose up --build
```

---

## 🐛 Resolvendo problemas comuns

### "Erro ao converter para PDF"
- **Causa:** LibreOffice não está instalado
- **Solução:** 
  - Se usa Docker: está incluído automaticamente
  - Se roda local: instale LibreOffice conforme o seu sistema operacional

### "Arquivo template não encontrado"
- **Causa:** Os arquivos `anexo1_template.docx` e `anexo2_template.docx` não estão em `app/templates/`
- **Solução:** Certifique-se que os arquivos estão na pasta correta

### "Erro de validação: formato de data inválido"
- **Causa:** Você inseriu uma data em formato errado (ex: 13/01/2026 em vez de 2026-01-13)
- **Solução:** Use o formato ISO: YYYY-MM-DD (ex: 2026-01-13)

### "O rascunho não foi encontrado"
- **Causa:** A pasta `data/` foi deletada ou o arquivo JSON foi perdido
- **Solução:** Inicie um novo formulário — um novo ID será gerado

---

## 📞 Contribuindo para o projeto

Se quer ajudar a melhorar o sistema:

1. Abra uma **issue** para reportar bugs ou sugerir melhorias
2. Faça um **fork** do repositório
3. Crie uma **branch** para sua mudança: `git checkout -b minha-melhoria`
4. Commit suas mudanças: `git commit -m "Descreva o que mudou"`
5. Push para a branch: `git push origin minha-melhoria`
6. Abra um **Pull Request**

---

## 📜 Licença

[Adicione a licença do seu projeto aqui]

---

## ❓ Dúvidas ou sugestões?

Se tiver dúvidas sobre como usar ou melhorar o sistema, abra uma **issue** no repositório ou entre em contato.
