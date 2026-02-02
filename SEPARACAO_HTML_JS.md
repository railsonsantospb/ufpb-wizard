# Separação HTML/JS - Estrutura do Projeto

## 📁 Arquivos Separados

### HTML
- **`app/web/anexo1.html`** — Estrutura HTML pura
  - Sem JavaScript embutido
  - Carrega o script externo com `<script src="/static/anexo1.js" defer></script>`
  - Mais limpo e fácil de manter

### JavaScript
- **`app/static/anexo1.js`** — Toda a lógica do formulário
  - Validações
  - Eventos (botões, mudanças de campo)
  - Comunicação com API
  - Geração de DOCX/PDF
  - Atualização de UI

## 🚀 Como Funciona

1. **Navegador abre `anexo1.html`**
2. **HTML é parseado e renderizado**
3. **Script `anexo1.js` é carregado** (com `defer`, após HTML estar pronto)
4. **JavaScript adiciona os event listeners** nos elementos do DOM
5. **Formulário fica funcional** normalmente

## ✅ Benefícios

- **Código mais organizado** — HTML e JS separados
- **Cache melhor** — `.js` pode ser cacheado pelo navegador
- **Reutilização** — mesmo JS pode ser incluído em múltiplos HTMLs
- **Edição mais fácil** — não precisa pular gigantescos blocos de script
- **Funciona normalmente** — não há diferença de comportamento

## 🔧 Para Adicionar Novo Formulário (Anexo 2)

1. Crie `app/web/anexo2.html` (estrutura HTML)
2. Crie `app/static/anexo2.js` (lógica específica)
3. Inclua no HTML: `<script src="/static/anexo2.js" defer></script>`

## 📝 Notas Técnicas

- O `defer` garante que o JS execute **apenas após** o HTML estar completamente carregado
- Variáveis globais (como `form`, `steps`, etc) ficam no escopo global do script
- Cada script é independente — não há conflito entre `anexo1.js` e `anexo2.js`

---

**Pronto!** O projeto agora tem HTML e JavaScript bem separados e funciona normalmente. 🎉
