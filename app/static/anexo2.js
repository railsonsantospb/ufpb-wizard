function applyPayloadToFormByNameAnexo2(payload){
  if(!payload || typeof payload !== "object") return;
  if(payload.afastamento) setAfastSegmentsFromPayload(payload.afastamento);

  const setField = (name, value) => {
    if(name === "data_relatorio" && dataRelMirror){
      const iso = parseDateBRToISO(value) || "";
      dataRelMirror.sync(iso, true);
      return;
    }

    const el = document.querySelector(`[name="${name}"]`);
    if(!el) return;

    if(el.type === "datetime-local" && typeof value === "string"){
      el.value = value.slice(0,16);
      return;
    }
    if(el.type === "checkbox"){
      el.checked = !!value;
      return;
    }
    el.value = (value ?? "");
  };

  const walk = (obj, prefix="") => {
    Object.entries(obj).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if(v === null || v === undefined) return;

      if(Array.isArray(v)){
        setField(path, v.join(","));
        return;
      }
      if(typeof v === "object"){
        walk(v, path);
        return;
      }
      setField(path, v);
    });
  };

  walk(payload);
}


function clearFieldHighlightsAnexo2(){
  document.querySelectorAll("[data-issue-highlight='1']").forEach(el => {
    el.style.outline = "";
    el.style.boxShadow = "";
    el.removeAttribute("data-issue-highlight");
  });
}

function highlightFieldByNameAnexo2(name){
  const el = document.querySelector(`[name="${name}"]`);
  if(!el) return;
  el.setAttribute("data-issue-highlight", "1");
  el.style.outline = "2px solid rgba(251, 191, 36, 0.85)";
  el.style.boxShadow = "0 0 0 3px rgba(251, 191, 36, 0.18)";
}

function showIssuesAnexo2(issues){
  const box = document.getElementById("anexo2Issues");
  const txt = document.getElementById("anexo2IssuesText");
  clearFieldHighlightsAnexo2();

  if(!issues.length){
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  txt.innerHTML = issues.map(i => `• ${i.message}`).join("<br>");

  // destacar campos
  issues.forEach(i => (i.fields || []).forEach(f => highlightFieldByNameAnexo2(f)));

  // scroll até o painel
  box.scrollIntoView({behavior:"smooth", block:"start"});
}

// Regras principais (ajuste se seu ANEXO II tiver mais campos/regras)
function validatePayloadAnexo2(payload){
  const issues = [];

  const idaList = normalizeAfastList(payload?.afastamento?.ida);
  const retList = normalizeAfastList(payload?.afastamento?.retorno);
  const ida = idaList[0]?.data_hora ? new Date(idaList[0].data_hora) : null;
  const ret = retList.length ? new Date(retList[retList.length - 1].data_hora) : null;

  if(ida && ret && ret < ida){
    issues.push({
      message: "Retorno não pode ser anterior à ida.",
      fields: ["afastamento.ida.data_hora", "afastamento.retorno.data_hora"]
    });
  }

  // fora do prazo: relatório > retorno + 5 dias
  const relDate = payload?.data_relatorio ? new Date(payload.data_relatorio + "T00:00:00") : null;
  if(relDate && ret){
    const retDay = new Date(ret.toISOString().slice(0,10) + "T00:00:00");
    const limite = new Date(retDay.getTime() + 5*24*60*60*1000);
    const late = relDate > limite;

    if(late){
      const just = (payload.justificativa_prestacao_contas_fora_prazo || "").trim();
      if(just.length < 10){
        issues.push({
          message: "Relatório fora do prazo (mais de 5 dias após o retorno). Informe a justificativa.",
          fields: ["data_relatorio", "justificativa_prestacao_contas_fora_prazo", "afastamento.retorno.data_hora"]
        });
      }
    }
  }

  // viagem não realizada -> atividades precisa explicar
  if(payload?.viagem_realizada === "nao"){
    const atv = (payload.atividades_desenvolvidas || "").trim();
    if(atv.length < 10){
      issues.push({
        message: "Viagem marcada como NÃO realizada, mas falta descrição/motivo em 'atividades_desenvolvidas'.",
        fields: ["viagem_realizada", "atividades_desenvolvidas"]
      });
    }
  }

  // atividades: mínimo para evitar relatório vazio
  if((payload?.atividades_desenvolvidas || "").trim().length < 10){
    issues.push({
      message: "Atividades desenvolvidas muito curto. Descreva de forma objetiva.",
      fields: ["atividades_desenvolvidas"]
    });
  }

  // dados pessoais básicos (proposto)
  const cpf = payload?.proposto?.cpf || "";
  if(cpf && !isCPF(cpf)){
    issues.push({ message:"CPF inválido.", fields:["proposto.cpf"] });
  }
  const orgTipo = payload?.proposto?.orgao?.tipo;
  const orgDet = (payload?.proposto?.orgao?.detalhe || "").trim();
  if(orgTipo === "projetos" || orgTipo === "outros"){
    if(orgDet.length < 2){
      issues.push({ message:"Informe o detalhe do órgão para Projetos/Outros.", fields:["proposto.orgao.detalhe"] });
    }
  }

  return issues;
}



const form = document.getElementById("wizardForm");
const steps = Array.from(document.querySelectorAll(".step"));
const total = steps.length;
document.getElementById("stepTotal").textContent = total;

let current = 1;

const elTitle = document.getElementById("stepTitle");
const elMeta = document.getElementById("stepMeta");
const elCount = document.getElementById("stepCount");
const elBar = document.getElementById("progressBar");
let elErrors = document.getElementById("errors");
const statusBadge = document.getElementById("statusBadge");
const elGenProgress = document.getElementById("generateProgress");
const dataRelMirror = bindBrDateField("#dataRelDisplay", '[name="data_relatorio"]', () => refreshAutoFlags());
const flagPrazoEl = document.getElementById("flagPrazo");
syncLocalInputs("afastamento.ida.origem");
syncLocalInputs("afastamento.ida.destino");
syncLocalInputs("afastamento.retorno.origem");
syncLocalInputs("afastamento.retorno.destino");
const FIELD_LABELS = {
  dataRelDisplay: "Data do relatório",
  "proposto.nome": "Nome completo",
  "proposto.cpf": "CPF",
  "proposto.siape": "SIAPE",
  "proposto.orgao.tipo": "Órgão",
  "proposto.orgao.detalhe": "Detalhe do órgão",
  "afastamento.ida.origem_cidade": "Cidade de origem (ida)",
  "afastamento.ida.origem_uf": "UF de origem (ida)",
  "afastamento.ida.destino_cidade": "Cidade de destino (ida)",
  "afastamento.ida.destino_uf": "UF de destino (ida)",
  "afastamento.ida.data_hora": "Data/hora da ida",
  "afastamento.retorno.origem_cidade": "Cidade de origem (retorno)",
  "afastamento.retorno.origem_uf": "UF de origem (retorno)",
  "afastamento.retorno.destino_cidade": "Cidade de destino (retorno)",
  "afastamento.retorno.destino_uf": "UF de destino (retorno)",
  "afastamento.retorno.data_hora": "Data/hora do retorno",
  atividades_desenvolvidas: "Atividades desenvolvidas",
  justPrazo: "Justificativa (fora do prazo)",
  viagem_realizada: "Viagem realizada?"
};
const PATTERN_TIPS = {
  "proposto.cpf": "Use 11 dígitos numéricos (somente números).",
  "proposto.siape": "Use apenas números (4 a 15 dígitos)."
};
const getFieldLabel = (el) => {
  const key = el.name || el.id || "";
  if (el.dataset && el.dataset.label) return el.dataset.label;
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const lbl = el.closest("label");
  if (lbl && (lbl.innerText || lbl.textContent)) {
    return (lbl.innerText || lbl.textContent).trim();
  }
  return key || "Campo obrigatório";
};

const idaSegmentsEl = document.getElementById("idaSegments2");
const retornoSegmentsEl = document.getElementById("retornoSegments2");
const addIdaSegmentBtn = document.getElementById("addIdaSegment2");
const addRetornoSegmentBtn = document.getElementById("addRetornoSegment2");

function normalizeAfastList(value){
  if(Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if(value && typeof value === "object") return [value];
  return [];
}

function getAfastContainer(type){
  return type === "ida" ? idaSegmentsEl : retornoSegmentsEl;
}

function updateAfastIndices(type){
  const container = getAfastContainer(type);
  if(!container) return;
  const cards = Array.from(container.querySelectorAll("[data-trecho-card]"));
  const hideRemove = cards.length <= 1;
  cards.forEach((card, idx) => {
    const i = idx + 1;
    const title = card.querySelector("[data-trecho-title]");
    if(title) title.textContent = `Trecho ${i}`;
    card.querySelectorAll("input[data-field]").forEach(input => {
      const field = input.dataset.field || "";
      const labelBase = (
        field === "data_hora" ? "Data e hora"
        : field === "origem_cidade" ? "Cidade de origem"
        : field === "origem_uf" ? "UF de origem"
        : field === "destino_cidade" ? "Cidade de destino"
        : field === "destino_uf" ? "UF de destino"
        : field === "origem" ? "Origem"
        : "Destino"
      );
      const typeLabel = type === "ida" ? "ida" : "retorno";
      input.dataset.label = `${labelBase} (${typeLabel} • trecho ${i})`;
    });
    const removeBtn = card.querySelector("[data-remove-trecho]");
    if(removeBtn) removeBtn.style.display = hideRemove ? "none" : "inline-flex";
  });
}

function addAfastSegment(type, values = {}){
  const container = getAfastContainer(type);
  if(!container) return;
  const origemSplit = splitLocal(values.origem);
  const destinoSplit = splitLocal(values.destino);

  const card = document.createElement("div");
  card.setAttribute("data-trecho-card", "1");
  card.style.padding = "10px 12px";
  card.style.border = "1px solid rgba(255,255,255,0.08)";
  card.style.borderRadius = "10px";
  card.style.marginBottom = "10px";

  const header = document.createElement("div");
  header.className = "row";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.marginBottom = "6px";

  const title = document.createElement("div");
  title.setAttribute("data-trecho-title", "1");
  title.style.fontWeight = "600";
  title.textContent = "Trecho";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-ghost btn-compact";
  removeBtn.textContent = "Remover";
  removeBtn.setAttribute("data-remove-trecho", "1");
  removeBtn.addEventListener("click", () => {
    card.remove();
    updateAfastIndices(type);
  });

  header.appendChild(title);
  header.appendChild(removeBtn);
  card.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "grid2";

  const addField = (label, field, placeholder, inputType = "text", spanFull = false, attrs = {}) => {
    const wrap = document.createElement("div");
    if(spanFull) wrap.style.gridColumn = "1/-1";
    const lab = document.createElement("label");
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = inputType;
    input.required = true;
    input.placeholder = placeholder || "";
    input.dataset.trechoType = type;
    input.dataset.field = field;
    const val = values[field];
    if(inputType === "datetime-local" && typeof val === "string"){
      input.value = val.slice(0, 16);
    }else if(val !== undefined && val !== null){
      input.value = val;
    }
    if(attrs && typeof attrs === "object"){
      Object.entries(attrs).forEach(([k, v]) => {
        if(v === null || v === undefined) return;
        if(k === "className") input.className = v;
        else if(k === "dataset") Object.entries(v).forEach(([dk, dv]) => input.dataset[dk] = dv);
        else input.setAttribute(k, v);
      });
    }
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
  };

  addField("Cidade (origem)", "origem_cidade", "Ex.: João Pessoa");
  addField("UF (origem)", "origem_uf", "Ex.: PB", "text", false, { pattern: "[A-Za-z]{2}", maxlength: "2" });
  addField("Cidade (destino)", "destino_cidade", "Ex.: Recife");
  addField("UF (destino)", "destino_uf", "Ex.: PE", "text", false, { pattern: "[A-Za-z]{2}", maxlength: "2" });
  addField("Data e hora", "data_hora", "dd/mm/aaaa hh:mm", "datetime-local", true);

  const setIfEmpty = (field, value) => {
    const el = grid.querySelector(`input[data-field="${field}"]`);
    if(el && !el.value) el.value = value || "";
  };
  setIfEmpty("origem_cidade", origemSplit.cidade);
  setIfEmpty("origem_uf", origemSplit.uf);
  setIfEmpty("destino_cidade", destinoSplit.cidade);
  setIfEmpty("destino_uf", destinoSplit.uf);

  card.appendChild(grid);
  container.appendChild(card);
  updateAfastIndices(type);
}

function setAfastSegmentsFromPayload(afast){
  const ida = normalizeAfastList(afast?.ida);
  const ret = normalizeAfastList(afast?.retorno);
  if(idaSegmentsEl){
    idaSegmentsEl.innerHTML = "";
    (ida.length ? ida : [{}]).forEach(v => addAfastSegment("ida", v));
  }
  if(retornoSegmentsEl){
    retornoSegmentsEl.innerHTML = "";
    (ret.length ? ret : [{}]).forEach(v => addAfastSegment("retorno", v));
  }
}

function readAfastSegments(type){
  const container = getAfastContainer(type);
  if(!container) return [];
  const cards = Array.from(container.querySelectorAll("[data-trecho-card]"));
  return cards.map(card => {
    const values = { origem: "", destino: "", data_hora: "" };
    let origemCidade = "";
    let origemUf = "";
    let destinoCidade = "";
    let destinoUf = "";
    card.querySelectorAll("input[data-field]").forEach(input => {
      const field = input.dataset.field;
      const val = (input.value || "").trim();
      if(field === "origem_cidade") origemCidade = val;
      else if(field === "origem_uf") origemUf = val.toUpperCase();
      else if(field === "destino_cidade") destinoCidade = val;
      else if(field === "destino_uf") destinoUf = val.toUpperCase();
      else values[field] = val;
    });
    values.origem = origemCidade ? (origemUf ? `${origemCidade}/${origemUf}` : origemCidade) : "";
    values.destino = destinoCidade ? (destinoUf ? `${destinoCidade}/${destinoUf}` : destinoCidade) : "";
    return values;
  });
}

function getAfastBoundaryDates(){
  const idaList = readAfastSegments("ida");
  const retList = readAfastSegments("retorno");
  const firstIda = idaList.find(t => t.data_hora)?.data_hora || "";
  const lastRet = [...retList].reverse().find(t => t.data_hora)?.data_hora || "";
  return {
    ida: firstIda ? new Date(firstIda) : null,
    ret: lastRet ? new Date(lastRet) : null
  };
}

if(addIdaSegmentBtn) addIdaSegmentBtn.addEventListener("click", () => addAfastSegment("ida"));
if(addRetornoSegmentBtn) addRetornoSegmentBtn.addEventListener("click", () => addAfastSegment("retorno"));
if(idaSegmentsEl && !idaSegmentsEl.children.length) addAfastSegment("ida");
if(retornoSegmentsEl && !retornoSegmentsEl.children.length) addAfastSegment("retorno");

let lastErrorToast = { msg: "", ts: 0 };
let fieldPopupEl = null;
let fieldPopupClear = null;
function hideFieldPopup(){
  if(fieldPopupEl) fieldPopupEl.remove();
  if(fieldPopupClear){
    window.removeEventListener("scroll", fieldPopupClear);
    window.removeEventListener("resize", fieldPopupClear);
  }
  fieldPopupEl = null;
  fieldPopupClear = null;
}
function showFieldPopup(target, msg){
  if(!target) return;
  hideFieldPopup();
  const popup = document.createElement("div");
  popup.className = "field-popup danger";
  popup.textContent = msg || "Campo obrigatório";
  document.body.appendChild(popup);
  const rect = target.getBoundingClientRect();
  const pRect = popup.getBoundingClientRect();
  let top = rect.top + window.scrollY + 4;
  if(top + pRect.height > rect.bottom + window.scrollY) top = rect.bottom + window.scrollY + 4;
  let left = rect.left + window.scrollX + 8;
  const maxLeft = rect.right + window.scrollX - pRect.width - 6;
  if(left > maxLeft) left = maxLeft;
  if(left < window.scrollX + 6) left = window.scrollX + 6;
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  fieldPopupEl = popup;
  const clear = () => hideFieldPopup();
  fieldPopupClear = clear;
  ["input","change","blur"].forEach(evt => target.addEventListener(evt, clear, { once:true }));
  window.addEventListener("scroll", clear, { once:true });
  window.addEventListener("resize", clear, { once:true });
}
function ensureErrorsEl(){
  if(elErrors && elErrors.parentNode) return elErrors;
  const host = document.querySelector(".container") || document.body;
  const div = document.createElement("div");
  div.id = "errors";
  div.className = "errors";
  div.style.display = "none";
  host.insertBefore(div, host.firstChild || null);
  elErrors = div;
  return elErrors;
}
function showErrors(msgs){
  ensureErrorsEl();
  const navErrors = document.getElementById("errorsNav");
  if(!msgs || !msgs.length){
    elErrors.style.display = "none";
    elErrors.textContent = "";
    if(navErrors){ navErrors.style.display = "none"; navErrors.textContent = ""; }
    hideFieldPopup();
    return;
  }
 
  if(navErrors){
    navErrors.style.display = "block";
    navErrors.textContent = msgs.map(m => `• ${m}`).join("\n");
  }
  if (window.ufpbToast && msgs[0]) {
    const now = Date.now();
    if (msgs[0] !== lastErrorToast.msg || now - lastErrorToast.ts > 600) {
      window.ufpbToast(msgs[0], "danger");
      lastErrorToast = { msg: msgs[0], ts: now };
    }
  }
}

function setStatus(text, kind){
  statusBadge.textContent = text;
  statusBadge.className = "badge " + (kind || "");
}
function setGenProgress(show, msg){
  if(!elGenProgress) return;
  elGenProgress.style.display = show ? "inline-flex" : "none";
  const t = elGenProgress.querySelector("[data-progress-text]");
  if(t) t.textContent = msg || "Gerando documento...";
}

function gotoStep(n){
  current = Math.max(1, Math.min(total, n));
  steps.forEach(s => s.style.display = (Number(s.dataset.step) === current) ? "block" : "none");

  const active = steps[current-1];
  elTitle.textContent = `Passo ${current} • ${active.dataset.title || ""}`;
  elMeta.textContent = active.dataset.subtitle || "";
  elCount.textContent = current;

  elBar.style.width = `${Math.round((current-1)/(total-1)*100)}%`;

  document.getElementById("btnBack").disabled = current === 1;
  const btnNext = document.getElementById("btnNext");
  if(btnNext){
    btnNext.textContent = "Avançar";
    btnNext.style.display = (current === total) ? "none" : "inline-flex";
  }

  showErrors(null);

  if(current === 5){
    refreshAutoFlags();
  }
  if(current === 6){
    const sel = form.querySelector('[name="viagem_realizada"]');
    if(sel && alertNaoRealizada){
      alertNaoRealizada.style.display = sel.value === "nao" ? "block" : "none";
    }
  }
  if(current === 7){
    refreshAutoFlags();
    renderReview();
  }
}

function getSection(stepNumber){
  return steps.find(s => Number(s.dataset.step) === stepNumber);
}

function validateStep(stepNumber){
  const section = getSection(stepNumber);
  const inputs = Array.from(section.querySelectorAll("input, select, textarea"));
  let ok = true;
  const msgs = [];
  const missing = [];
  const invalid = [];
  let focusEl = null;
  let firstMissingEl = null;

  function dtValue(name){
    const el = form.querySelector(`[name="${name}"]`);
    if(!el || !el.value) return null;
    return new Date(el.value);
  }

  for(const el of inputs){
    if(el.disabled) continue;
    const wrap = el.closest("[style*='display:none']");
    if(wrap) continue;

    const label = getFieldLabel(el);
    const val = (el.value || "").trim();

    if(el.hasAttribute("required") && !val){
      ok = false;
      missing.push(label);
      if(!focusEl) focusEl = el;
      if(!firstMissingEl) firstMissingEl = el;
      continue;
    }
    if(el.tagName === "INPUT" && el.getAttribute("pattern")){
      const re = new RegExp("^" + el.getAttribute("pattern") + "$");
      if(val && !re.test(val)){
        ok = false;
        const tip = PATTERN_TIPS[el.name || el.id] || "Formato inválido.";
        invalid.push(`${label} — ${tip}`);
        if(!focusEl) focusEl = el;
        continue;
      }
    }
    if(el.name === "proposto.cpf" && val){
      if(!isCPF(val)){
        ok = false;
        invalid.push(`${label} — CPF inválido (dígitos não conferem).`);
        if(!focusEl) focusEl = el;
        continue;
      }
    }
    if(el.id === "dataRelDisplay"){
      if(val && !parseDateBRToISO(val)){
        ok = false;
        invalid.push(`${label} — use o formato dd/mm/aaaa.`);
        if(!focusEl) focusEl = el;
        continue;
      }
    }
    if(el.tagName === "TEXTAREA" && el.getAttribute("minlength")){
      const min = Number(el.getAttribute("minlength"));
      if(val && val.length < min){
        ok = false;
        invalid.push(`${label} — mínimo de ${min} caracteres.`);
        if(!focusEl) focusEl = el;
        continue;
      }
    }
  }

  if(missing.length){
    msgs.push(`Preencha os campos obrigatórios: ${missing.join(", ")}.`);
  }
  if(invalid.length){
    msgs.push(`Revise os campos: ${invalid.join(" | ")}.`);
  }
  if(!ok && focusEl && typeof focusEl.focus === "function"){
    focusEl.focus();
  }
  if(!ok && firstMissingEl){
    showFieldPopup(firstMissingEl, "Campo obrigatório");
  } else if(!ok){
    hideFieldPopup();
  }

  if(ok && stepNumber === 3){
    const { ida, ret } = getAfastBoundaryDates();
    if(ida && ret && ret < ida){
      ok = false;
      msgs.push("A data/hora de retorno não pode ser anterior à ida.");
    }
  }

  if(ok && stepNumber === 5){
    const flag = document.getElementById("flagPrazo").checked;
    const txt = (document.getElementById("justPrazo").value || "").trim();
    if(flag && txt.length < 10){
      ok = false;
      msgs.push("Prestação de contas fora do prazo. Informe a justificativa.");
    }
  }
  if(stepNumber === 6){
    const sel = form.querySelector('[name="viagem_realizada"]');
    if(sel && alertNaoRealizada){
      alertNaoRealizada.style.display = sel.value === "nao" ? "block" : "none";
    }
  }

  showErrors(ok ? null : msgs);
  return ok;
}

/* Conditional org detail */
const orgTipoEl = document.getElementById("org_tipo");
const orgWrap = document.getElementById("orgDetalheWrap");
const alertNaoRealizada = document.getElementById("alertNaoRealizada");
const viagemSel = document.querySelector('[name="viagem_realizada"]');
if(viagemSel){
  viagemSel.addEventListener("change", () => {
    if(alertNaoRealizada){
      alertNaoRealizada.style.display = viagemSel.value === "nao" ? "block" : "none";
    }
  });
}
orgTipoEl.addEventListener("change", () => {
  const v = orgTipoEl.value;
  const show = (v === "projetos" || v === "outros");
  orgWrap.style.display = show ? "block" : "none";
  if(!show) document.getElementById("org_det").value = "";
});

function applyPrefillAnexo2(prefill){
  if(!prefill || typeof prefill !== "object") return;
  applyPayloadToFormByNameAnexo2(prefill);
  normalizeLocalFromInputs("afastamento.ida.origem");
  normalizeLocalFromInputs("afastamento.ida.destino");
  normalizeLocalFromInputs("afastamento.retorno.origem");
  normalizeLocalFromInputs("afastamento.retorno.destino");
  if(orgTipoEl) orgTipoEl.dispatchEvent(new Event("change"));
  refreshAutoFlags();
  renderReview();
}

/* Payload build */
function normalizeDT(s){
  if(!s) return s;
  return (s.length === 16) ? (s + ":00") : s;
}
function setDeep(obj, path, value){
  const parts = path.split(".");
  let cur = obj;
  for(let i=0;i<parts.length-1;i++){
    if(typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length-1]] = value;
}
function formToJSON(){
  const fd = new FormData(form);
  const obj = {};
  for(const [k,v] of fd.entries()){
    if(k.startsWith("afastamento.")) continue;
    if(k.startsWith("flags.")){
      setDeep(obj, k, true);
      continue;
    }
    setDeep(obj, k, v);
  }
  const idaSegs = readAfastSegments("ida").map(t => ({
    origem: t.origem,
    destino: t.destino,
    data_hora: normalizeDT(t.data_hora)
  }));
  const retSegs = readAfastSegments("retorno").map(t => ({
    origem: t.origem,
    destino: t.destino,
    data_hora: normalizeDT(t.data_hora)
  }));
  obj.afastamento = { ida: idaSegs, retorno: retSegs };
  obj.flags = obj.flags || {};
  obj.flags.prestacao_contas_fora_prazo = flagPrazoEl ? !!flagPrazoEl.checked : !!obj.flags.prestacao_contas_fora_prazo;
  return obj;
}

/* Auto flags for prazo */
function setPrazoUI(isFora){
  const flag = document.getElementById("flagPrazo");
  const wrap = document.getElementById("wrapJustPrazo");
  const badge = document.getElementById("badgePrazo");

  flag.checked = !!isFora;
  wrap.style.display = isFora ? "block" : "none";

  badge.textContent = isFora ? "Fora do prazo: SIM" : "Fora do prazo: NÃO";
  badge.className = "badge " + (isFora ? "danger" : "success");
}

function refreshAutoFlags(){
  const drEl  = form.querySelector('[name="data_relatorio"]');

  const ret = getAfastBoundaryDates().ret;
  const dr  = drEl.value ? new Date(drEl.value + "T00:00:00") : null;

  if(ret && dr){
    const limite = new Date(ret);
    limite.setHours(0,0,0,0);
    limite.setDate(limite.getDate() + 5);
    const isFora = dr > limite;
    setPrazoUI(isFora);
  }else{
    setPrazoUI(false);
    const badge = document.getElementById("badgePrazo");
    badge.textContent = "Prazo: —";
    badge.className = "badge";
  }
}

/* Review */
function renderReview(){
  refreshAutoFlags();
  const p = formToJSON();
  const fmtDate = (v) => formatDateBR(v) || "—";
  const fmtDT = (v) => formatDateTimeBR(v) || "—";
  const lines = [];
  function line(label, value){ lines.push(`${label}: ${value || "—"}`); }
  const fmtSegs = (list) => {
    const items = normalizeAfastList(list);
    if(!items.length) return ["—"];
    return items.map((t, i) => `${i + 1}) ${t?.origem || "—"} → ${t?.destino || "—"} | ${fmtDT(t?.data_hora)}`);
  };

  line("Data do relatório", fmtDate(p.data_relatorio));
  lines.push("\n[Proposto]");
  line("Nome", p.proposto?.nome);
  line("CPF", p.proposto?.cpf);
  line("SIAPE", p.proposto?.siape);
  line("Órgão", p.proposto?.orgao?.tipo);
  line("Detalhe", p.proposto?.orgao?.detalhe);

  lines.push("\n[Afastamento]");
  fmtSegs(p.afastamento?.ida).forEach((txt, idx) => line(idx === 0 ? "Ida" : "Ida (cont.)", txt));
  fmtSegs(p.afastamento?.retorno).forEach((txt, idx) => line(idx === 0 ? "Retorno" : "Retorno (cont.)", txt));

  lines.push("\n[Atividades]");
  line("Descrição", p.atividades_desenvolvidas);

  lines.push("\n[Prazo]");
  line("Fora do prazo (flag)", String(!!p.flags?.prestacao_contas_fora_prazo));
  line("Justificativa", p.justificativa_prestacao_contas_fora_prazo);

  lines.push("\n[Confirmação]");
  line("Viagem realizada", p.viagem_realizada);

  const resumo = [
    "Resumo amigável:",
    "",
    `• Proposto: ${p.proposto?.nome || "—"} | CPF: ${p.proposto?.cpf || "—"} | SIAPE: ${p.proposto?.siape || "—"}`,
    `• Órgão: ${p.proposto?.orgao?.tipo || "—"} ${p.proposto?.orgao?.detalhe ? "(" + p.proposto.orgao.detalhe + ")" : ""}`,
    "",
    `Relatório: ${fmtDate(p.data_relatorio)}`,
    "",
    "Afastamento:",
    "• Ida:",
    ...fmtSegs(p.afastamento?.ida).map(l => `  ${l}`),
    "• Retorno:",
    ...fmtSegs(p.afastamento?.retorno).map(l => `  ${l}`),
    "",
    "Atividades:",
    `• ${p.atividades_desenvolvidas || "—"}`,
    "",
    "Prazo/justificativa:",
    `• Fora do prazo: ${p.flags?.prestacao_contas_fora_prazo ? "SIM" : "NÃO"}`,
    `• Justificativa: ${p.justificativa_prestacao_contas_fora_prazo || "—"}`,
    "",
    `Viagem realizada: ${p.viagem_realizada || "—"}`
  ].join("\n");

  document.getElementById("reviewText").textContent = resumo;

  const badge = document.getElementById("reviewBadge");
  if(p.flags?.prestacao_contas_fora_prazo){
    badge.textContent = "Atenção: fora do prazo";
    badge.className = "badge danger";
  } else {
    badge.textContent = "Pronto para gerar";
    badge.className = "badge success";
  }
}

/* Generate */
async function generate(format){
  showErrors(null);
  setStatus("Validando...", "");
  setGenProgress(true, "Validando e gerando documento...");

  try{
    const payload = formToJSON();

    const previewRes = await fetch("/api/anexo2/preview", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const previewJson = await previewRes.json().catch(()=>null);

    if(!previewRes.ok || !previewJson){
      setStatus("Erro", "danger");
      showErrors(["Falha ao validar os dados."]);
      return;
    }

    if(previewJson.ok === false){
      setStatus("Correção necessária", "warn");
      const msgs = (previewJson.errors || []).map(e => e.message);
      showErrors(msgs.length ? msgs : ["Revise os campos."]);
      const first = (previewJson.errors && previewJson.errors[0] && previewJson.errors[0].field) ? previewJson.errors[0].field : "";
      if(first.startsWith("afastamento")) gotoStep(3);
      else if(first.startsWith("justificativa")) gotoStep(5);
      else gotoStep(2);
      return;
    }

    setStatus("Gerando...", "");
    setGenProgress(true, "Gerando arquivo para download...");
    const genRes = await fetch(`/api/anexo2/generate?format=${format}`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    if(!genRes.ok){
      const err = await genRes.json().catch(()=>null);
      setStatus("Erro", "danger");
      const detail = err?.detail || err;
      const msgs = (detail?.errors || []).map(e => e.message);
      showErrors(msgs.length ? msgs : ["Falha ao gerar o documento."]);
      return;
    }

    const blob = await genRes.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (format === "pdf") ? "anexo2_preenchido.pdf" : "anexo2_preenchido.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus("Gerado com sucesso", "success");
  }catch(e){
    setStatus("Erro", "danger");
    showErrors(["Falha ao gerar o documento."]);
  }finally{
    setGenProgress(false);
  }
}

/* Importação a partir do Anexo I (Docling) */
const importInput = document.getElementById("inputAnexo1");
const importBtn = document.getElementById("btnImportAnexo1");
const importBadge = document.getElementById("importBadge");
const importHelper = document.getElementById("importHelper");
const importWarnings = document.getElementById("importWarnings");
const importProgress = document.getElementById("importProgress");

function setImportBadge(text, kind){
  if(!importBadge) return;
  importBadge.textContent = text;
  importBadge.className = "badge" + (kind ? " " + kind : "");
}

function setImportProgress(show, msg){
  if(!importProgress) return;
  importProgress.style.display = show ? "inline-flex" : "none";
  const t = importProgress.querySelector("[data-progress-text]");
  if(t && msg) t.textContent = msg;
}

function renderImportWarnings(list){
  if(!importWarnings) return;
  if(!list || !list.length){
    importWarnings.style.display = "none";
    importWarnings.textContent = "";
    return;
  }
  importWarnings.style.display = "block";
  importWarnings.textContent = list.map(w => `• ${w}`).join(" ");
}

async function handleImportAnexo1(){
  if(!importInput || !importInput.files || !importInput.files.length){
    setImportBadge("Selecione o arquivo", "warn");
    if(importHelper) importHelper.textContent = "Escolha o PDF/DOC/DOCX do Anexo I preenchido para importar.";
    return;
  }

  setImportBadge("Lendo arquivo...", "");
  setImportProgress(true, "Interpretando Anexo I...");
  renderImportWarnings(null);

  try{
    const fd = new FormData();
    fd.append("file", importInput.files[0]);

    const res = await fetch("/api/anexo2/prefill-from-anexo1", { method:"POST", body: fd });
    const json = await res.json().catch(() => null);

    if(!res.ok || !json || !json.prefill){
      setImportBadge("Falhou", "danger");
      const detail = (json && json.detail) ? json.detail : "Não foi possível ler o arquivo.";
      if(importHelper) importHelper.textContent = typeof detail === "string" ? detail : "Não foi possível ler o arquivo.";
      return;
    }

    applyPrefillAnexo2(json.prefill);
    setImportBadge("Pré-preenchido", "success");
    if(importHelper){
      const baseMsg = json.filename ? `Dados importados de ${json.filename}.` : "Dados importados do Anexo I.";
      importHelper.textContent = `${baseMsg} Revise os campos antes de gerar o relatório.`;
    }
    renderImportWarnings(json.warnings || []);

    // mostra inconsistências já calculadas
    const issues = validatePayloadAnexo2(formToJSON());
    showIssuesAnexo2(issues);
  }catch(e){
    setImportBadge("Erro", "danger");
    if(importHelper) importHelper.textContent = "Falha ao enviar o arquivo. Tente novamente.";
  }finally{
    setImportProgress(false);
  }
}

if(importBtn) importBtn.addEventListener("click", handleImportAnexo1);
if(importInput) importInput.addEventListener("change", () => {
  setImportBadge("Pronto para importar", "");
  renderImportWarnings(null);
  // dispara leitura automaticamente ao selecionar
  handleImportAnexo1();
});


/* =========================
/* =========================
   Assistente Conversacional COMPLETO (ANEXO II) — com dados pessoais
   ========================= */

// --------- utilidades (iguais ao Anexo I) ---------
function onlyDigits(s){ return (s || "").replace(/\D+/g, ""); }
function isEmail(s){
  const email = (s || "").trim();
  const basic = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return basic.test(email);
}
function isPhoneDigits(s){ return /^[0-9]{10,11}$/.test(s || ""); }
function isSiape(s){ return /^[0-9]{4,15}$/.test(s || ""); }
function isMinMax(s, min, max){ const t=(s||"").trim(); return t.length>=min && t.length<=max; }
function isNumLen(s, min, max){ return new RegExp(`^[0-9]{${min},${max}}$`).test(s || ""); }
function formatDateBR(value){
  if(!value) return "";
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : str;
}
function formatDateTimeBR(value){
  if(!value) return "";
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s])?(\d{2}):(\d{2})/);
  if(m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  return formatDateBR(str);
}
function parseDateBRToISO(value){
  if(!value) return "";
  const str = String(value).trim();
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br){
    const d = Number(br[1]);
    const m = Number(br[2]);
    if(d >= 1 && d <= 31 && m >= 1 && m <= 12) return `${br[3]}-${br[2]}-${br[1]}`;
    return "";
  }
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}
function splitLocal(value){
  let s = (value || "").trim();
  s = s.replace(/^local\s+de\s+(origem|destino)\s*:\s*/i, "").trim();
  const cut = s.match(/^(.*?)\s+local\s+de\s+destino\s*:/i);
  if(cut) s = cut[1].trim();
  let m = s.match(/^(.*)\/\s*([A-Za-z]{2})\s*$/);
  if(m) return { cidade: m[1].trim().replace(/[,\s]+$/,""), uf: m[2].toUpperCase() };
  m = s.match(/([A-Za-zÀ-ÿ0-9 .´’'-]+?)\s*\/\s*([A-Za-z]{2})/);
  if(m) return { cidade: m[1].trim().replace(/[,\s]+$/,""), uf: m[2].toUpperCase() };
  m = s.match(/^(.*?)[-]\s*([A-Za-z]{2})\s*$/);
  if(m) return { cidade: m[1].trim().replace(/[,\s]+$/,""), uf: m[2].toUpperCase() };
  return { cidade: s, uf: "" };
}
function composeLocal(cidade, uf){
  const c = (cidade || "").trim();
  const u = (uf || "").trim().toUpperCase();
  if(!c && !u) return "";
  return u ? `${c}/${u}` : c;
}
function setLocalFields(prefix, combined, force = false){
  const { cidade, uf } = splitLocal(combined);
  const cEl = document.querySelector(`[name="${prefix}_cidade"]`);
  const uEl = document.querySelector(`[name="${prefix}_uf"]`);
  if(cEl && (force || !cEl.value)) cEl.value = cidade;
  if(uEl && (force || !uEl.value)) uEl.value = uf;
  const hidden = document.querySelector(`[name="${prefix}"]`);
  if(hidden) hidden.value = composeLocal(cidade, uf);
}
function normalizeLocalFromInputs(prefix){
  const cEl = document.querySelector(`[name="${prefix}_cidade"]`);
  const uEl = document.querySelector(`[name="${prefix}_uf"]`);
  if(!cEl || !uEl) return;
  if(!uEl.value && cEl.value && cEl.value.includes("/")){
    const { cidade, uf } = splitLocal(cEl.value);
    cEl.value = cidade;
    uEl.value = uf;
  }
  const hidden = document.querySelector(`[name="${prefix}"]`);
  if(hidden) hidden.value = composeLocal(cEl.value, uEl.value);
}
function syncLocalInputs(prefix){
  const cEl = document.querySelector(`[name="${prefix}_cidade"]`);
  const uEl = document.querySelector(`[name="${prefix}_uf"]`);
  const hidden = document.querySelector(`[name="${prefix}"]`);
  const sync = () => {
    if(hidden) hidden.value = composeLocal(cEl?.value, uEl?.value);
  };
  if(cEl) cEl.addEventListener("input", sync);
  if(uEl) uEl.addEventListener("input", sync);
  sync();
}
function maskDateInput(el){
  if(!el) return;
  el.addEventListener("input", (ev) => {
    let v = (ev.target.value || "").replace(/\D+/g, "").slice(0, 8);
    if(v.length >= 5) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    else if(v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    ev.target.value = v;
  });
}
function bindBrDateField(displaySelector, hiddenSelector, onChange){
  const display = document.querySelector(displaySelector);
  const hidden = document.querySelector(hiddenSelector);
  if(!display || !hidden) return null;

  maskDateInput(display);

  const sync = (iso, force=false) => {
    if(force || !hidden.value) hidden.value = iso || "";
    if(force || !display.value) display.value = iso ? formatDateBR(iso) : "";
  };

  const propagate = () => {
    const iso = parseDateBRToISO(display.value);
    hidden.value = iso;
    if(typeof onChange === "function") onChange(iso);
  };

  display.addEventListener("input", propagate);
  display.addEventListener("blur", () => {
    if(hidden.value) display.value = formatDateBR(hidden.value);
  });

  return { sync };
}

// CPF (DV)
function isCPF(cpf){
  cpf = onlyDigits(cpf);
  if(!/^[0-9]{11}$/.test(cpf)) return false;
  if(/^(\d)\1{10}$/.test(cpf)) return false;
  const blacklist = [
    "12345678909","01234567890","11111111111","22222222222","33333333333",
    "44444444444","55555555555","66666666666","77777777777","88888888888","99999999999"
  ];
  if(blacklist.includes(cpf)) return false;

  let sum = 0;
  for(let i=0;i<9;i++) sum += parseInt(cpf[i]) * (10-i);
  let d1 = (sum*10)%11; if(d1===10) d1=0;
  if(d1 !== parseInt(cpf[9])) return false;

  sum = 0;
  for(let i=0;i<10;i++) sum += parseInt(cpf[i]) * (11-i);
  let d2 = (sum*10)%11; if(d2===10) d2=0;
  return d2 === parseInt(cpf[10]);
}

// --------- preenchimento robusto por name="path" ---------
function applyPayloadToFormByNameAnexo2(payload){
  if(!payload || typeof payload !== "object") return;

  const setField = (name, value) => {
    if(name === "afastamento.ida.origem") { setLocalFields("afastamento.ida.origem", value, true); return; }
    if(name === "afastamento.ida.destino") { setLocalFields("afastamento.ida.destino", value, true); return; }
    if(name === "afastamento.retorno.origem") { setLocalFields("afastamento.retorno.origem", value, true); return; }
    if(name === "afastamento.retorno.destino") { setLocalFields("afastamento.retorno.destino", value, true); return; }
    if(name === "afastamento.ida.origem_cidade" && typeof value === "string" && value.includes("/")) { setLocalFields("afastamento.ida.origem", value, true); return; }
    if(name === "afastamento.ida.destino_cidade" && typeof value === "string" && value.includes("/")) { setLocalFields("afastamento.ida.destino", value, true); return; }
    if(name === "afastamento.retorno.origem_cidade" && typeof value === "string" && value.includes("/")) { setLocalFields("afastamento.retorno.origem", value, true); return; }
    if(name === "afastamento.retorno.destino_cidade" && typeof value === "string" && value.includes("/")) { setLocalFields("afastamento.retorno.destino", value, true); return; }
    const el = document.querySelector(`[name="${name}"]`);
    if(!el) return;

    if(el.type === "datetime-local" && typeof value === "string"){
      el.value = value.slice(0,16);
      return;
    }
    if(el.type === "checkbox"){
      el.checked = !!value;
      return;
    }
    el.value = (value ?? "");
  };

  const walk = (obj, prefix="") => {
    Object.entries(obj).forEach(([k,v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if(v === null || v === undefined) return;
      if(path === "afastamento" || path.startsWith("afastamento.")) return;

      if(Array.isArray(v)){
        setField(path, v.join(","));
        return;
      }
      if(typeof v === "object"){
        walk(v, path);
        return;
      }
      setField(path, v);
    });
  };

  walk(payload);
}

// --------- painel de inconsistências ---------
function clearFieldHighlightsAnexo2(){
  document.querySelectorAll("[data-issue-highlight='1']").forEach(el => {
    el.style.outline = "";
    el.style.boxShadow = "";
    el.removeAttribute("data-issue-highlight");
  });
}
function highlightFieldByNameAnexo2(name){
  const el = document.querySelector(`[name="${name}"]`);
  if(!el) return;
  el.setAttribute("data-issue-highlight", "1");
  el.style.outline = "2px solid rgba(251, 191, 36, 0.85)";
  el.style.boxShadow = "0 0 0 3px rgba(251, 191, 36, 0.18)";
}
function showIssuesAnexo2(issues){
  const box = document.getElementById("anexo2Issues");
  const txt = document.getElementById("anexo2IssuesText");
  if(!box || !txt) return;

  clearFieldHighlightsAnexo2();

  if(!issues.length){
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  txt.innerHTML = issues.map(i => `• ${i.message}`).join("<br>");
  issues.forEach(i => (i.fields||[]).forEach(f => highlightFieldByNameAnexo2(f)));
  box.scrollIntoView({behavior:"smooth", block:"start"});
}

// --------- elementos do modal do chat (ids) ---------
const c2 = {
  modal: document.getElementById("chatFullModal2"),
  tl: document.getElementById("chatFullTimeline2"),
  quick: document.getElementById("chatFullQuick2"),
  meta: document.getElementById("chatFullMeta2"),
  textRow: document.getElementById("chatFullTextRow2"),
  text: document.getElementById("chatFullText2"),
  send: document.getElementById("chatFullSend2"),
  dateRow: document.getElementById("chatFullDateRow2"),
  date: document.getElementById("chatFullDate2"),
  dateOk: document.getElementById("chatFullDateOk2"),
  dtRow: document.getElementById("chatFullDTrow2"),
  dt: document.getElementById("chatFullDT2"),
  dtOk: document.getElementById("chatFullDTok2"),
  close: document.getElementById("chatFullClose2"),
  open: document.getElementById("btnChatFull2")
};

maskDateInput(c2.date);

function c2scroll(){ c2.tl.scrollTop = c2.tl.scrollHeight; }
function c2bubble(role, text){
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.margin = "10px 0";
  wrap.style.justifyContent = role === "bot" ? "flex-start" : "flex-end";

  const b = document.createElement("div");
  b.style.maxWidth = "78%";
  b.style.padding = "10px 12px";
  b.style.borderRadius = "12px";
  b.style.whiteSpace = "pre-wrap";
  b.style.lineHeight = "1.35";
  b.style.border = "1px solid rgba(255,255,255,0.10)";
  b.style.background = role === "bot" ? "rgba(255,255,255,0.06)" : "rgba(56,189,248,0.12)";
  b.style.borderColor = role === "bot" ? "rgba(255,255,255,0.10)" : "rgba(56,189,248,0.25)";
  b.textContent = text;

  wrap.appendChild(b);
  c2.tl.appendChild(wrap);
  c2scroll();
}
function c2mode(mode){
  c2.quick.style.display = mode === "quick" ? "flex" : "none";
  c2.textRow.style.display = mode === "text" ? "flex" : "none";
  c2.dateRow.style.display = mode === "date" ? "flex" : "none";
  c2.dtRow.style.display = mode === "datetime" ? "flex" : "none";
  if(mode === "text"){
    const ph = {
      "proposto.nome": "Digite o nome completo",
      "proposto.cpf": "Digite o CPF",
      "proposto.siape": "Digite o SIAPE",
      "proposto.orgao.detalhe": "Digite o detalhe do órgão",
      "afastamento.ida.origem": "Digite a origem da ida",
      "afastamento.ida.destino": "Digite o destino da ida",
      "afastamento.retorno.origem_text": "Digite a origem do retorno",
      "afastamento.retorno.destino_text": "Digite o destino do retorno",
      "atividades_livre": "Descreva as atividades realizadas",
      "nao_realizada_motivo": "Informe o motivo da não realização",
      "just_prazo": "Digite a justificativa fora do prazo"
    }[chat2full.state] || "Digite aqui...";
    if(c2.text) c2.text.placeholder = ph;
  } else if(c2.text){
    c2.text.placeholder = "Digite aqui...";
  }
  if(mode === "date" && c2.date) c2.date.value = "";
  if(mode === "datetime" && c2.dt) c2.dt.value = "";
}
function c2quick(buttons){
  c2.quick.innerHTML = "";
  buttons.forEach(x => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = x.primary ? "btn btn-primary" : "btn";
    btn.textContent = x.label;
    btn.addEventListener("click", x.onClick);
    c2.quick.appendChild(btn);
  });
}

// --------- estado do chat ---------
const chat2full = {
  state: "start",
  data: {
    data_relatorio: null,

    proposto: {
      nome: null,
      cpf: null,
      siape: null,
      orgao: { tipo: null, detalhe: null }
    },

    afastamento: {
      ida: { origem: null, destino: null, data_hora: null },
      retorno: { origem: null, destino: null, data_hora: null }
    },

    viagem_realizada: null,
    atividades_desenvolvidas: null,
    justificativa_prestacao_contas_fora_prazo: null,

    _ativ_modelo: null
  }
};

// Preenche data do relatório com a data do servidor (ou data local) e bloqueia edição
async function setDataRelatorioFromServer(){
  const formEl = document.querySelector('[name="data_relatorio"]');
  const displayEl = document.getElementById("dataRelDisplay");
  const hadExistingValue = !!(formEl?.value || displayEl?.value);

  const applyValue = (val, force=false) => {
    const iso = parseDateBRToISO(val);
    if(!iso) return;

    if(dataRelMirror) dataRelMirror.sync(iso, force);
    if(formEl){
      if(force || !formEl.value) formEl.value = iso;
      formEl.readOnly = true;
      formEl.setAttribute("aria-readonly", "true");
      formEl.classList.add("readonly");
    }
    if(displayEl){
      if(force || !displayEl.value) displayEl.value = formatDateBR(iso);
      displayEl.readOnly = true;
      displayEl.setAttribute("aria-readonly", "true");
      displayEl.classList.add("readonly");
    }
    if(force || !chat2full.data.data_relatorio){
      chat2full.data.data_relatorio = (formEl?.value || iso);
    }
  };

  // valor rápido (local) enquanto busca do backend
  if(!hadExistingValue){
    const today = new Date().toISOString().slice(0,10);
    applyValue(today, true);
  }else{
    applyValue(formEl.value, true);
  }

  try{
    const res = await fetch("/api/server-date");
    if(!res.ok) throw new Error("server date unavailable");
    const json = await res.json();
    const serverDate = json?.date;
    if(serverDate){
      applyValue(serverDate, !hadExistingValue);
      return;
    }
    throw new Error("invalid payload");
  }catch(e){
    if(!hadExistingValue){
      const today = new Date().toISOString().slice(0,10);
      applyValue(today, true);
    }
  }
}

// fora do prazo (5 dias) calculado por dados do chat
function isLate5Days(){
  const d = chat2full.data;
  if(!d.data_relatorio || !d.afastamento.retorno.data_hora) return false;
  const rel = new Date(d.data_relatorio + "T00:00:00");
  const retDate = d.afastamento.retorno.data_hora.split("T")[0];
  const retDay = new Date(retDate + "T00:00:00");
  const limite = new Date(retDay.getTime() + 5*24*60*60*1000);
  return rel > limite;
}

// inicializa data do relatório ao carregar a página
setDataRelatorioFromServer();

function buildActivitiesTemplate(tipo){
  const d = chat2full.data;
  const destino = d.afastamento.ida.destino || "destino";
  const ida = d.afastamento.ida.data_hora ? d.afastamento.ida.data_hora.split("T")[0] : "—";
  const ret = d.afastamento.retorno.data_hora ? d.afastamento.retorno.data_hora.split("T")[0] : "—";

  switch(tipo){
    case "evento":
      return [
        `Participação em evento técnico/científico em ${destino}, no período de ${ida} a ${ret}.`,
        `Atividades realizadas: credenciamento, participação em atividades programadas e encaminhamentos decorrentes.`,
        `Resultados: atualização técnica e repasse das informações à unidade quando aplicável.`
      ].join("\n");
    case "capacitacao":
      return [
        `Participação em capacitação/treinamento em ${destino}, no período de ${ida} a ${ret}.`,
        `Atividades realizadas: aulas/módulos e atividades práticas.`,
        `Resultados: aprimoramento de competências e aplicação no trabalho.`
      ].join("\n");
    case "reuniao":
      return [
        `Participação em reunião técnica/institucional em ${destino}, no período de ${ida} a ${ret}.`,
        `Atividades realizadas: alinhamento, discussão de demandas e definição de encaminhamentos.`,
        `Resultados: deliberações e plano de ação para providências posteriores.`
      ].join("\n");
    case "visita":
      return [
        `Realização de visita técnica em ${destino}, no período de ${ida} a ${ret}.`,
        `Atividades realizadas: vistoria/inspeção, coleta de informações e reuniões com responsáveis.`,
        `Resultados: consolidação de informações e recomendações para etapas seguintes.`
      ].join("\n");
    default:
      return "";
  }
}

function buildPayloadAnexo2FromChat(){
  const d = chat2full.data;

  const payload = {
    data_relatorio: d.data_relatorio,
    proposto: d.proposto,
    afastamento: {
      ida: [{
        origem: d.afastamento.ida.origem,
        destino: d.afastamento.ida.destino,
        data_hora: d.afastamento.ida.data_hora ? (d.afastamento.ida.data_hora + ":00") : null
      }],
      retorno: [{
        origem: d.afastamento.retorno.origem,
        destino: d.afastamento.retorno.destino,
        data_hora: d.afastamento.retorno.data_hora ? (d.afastamento.retorno.data_hora + ":00") : null
      }]
    },
    viagem_realizada: d.viagem_realizada,
    atividades_desenvolvidas: d.atividades_desenvolvidas,
    flags: { prestacao_contas_fora_prazo: isLate5Days() }
  };

  if(isLate5Days()){
    payload.justificativa_prestacao_contas_fora_prazo = d.justificativa_prestacao_contas_fora_prazo || "";
  }

  return payload;
}

function finalizeChatAnexo2ToManual(){
  const payload = buildPayloadAnexo2FromChat();

  // aplica no form manual
  if(typeof applyPrefillAnexo2 === "function") applyPrefillAnexo2(payload);
  applyPayloadToFormByNameAnexo2(payload);
  if(orgTipoEl) orgTipoEl.dispatchEvent(new Event("change"));
  refreshAutoFlags();
  if(typeof renderReview === "function") renderReview();

  // fecha chat
  c2.modal.style.display = "none";

  // vai para início do formulário manual
  if(typeof gotoStep === "function") gotoStep(0);

  // valida e mostra inconsistências
  const issues = validatePayloadAnexo2(payload);
  showIssuesAnexo2(issues);
}

// --------- fluxo de perguntas (mesma lógica do Anexo I) ---------
function ask2(){
  const s = chat2full.state;
  const d = chat2full.data;

  const askQuick = (msg, buttons) => { c2bubble("bot", msg); c2mode("quick"); c2quick(buttons); };
  const askText  = (msg) => { c2bubble("bot", msg); c2mode("text"); };
  const askDate  = (msg) => { c2bubble("bot", msg); c2mode("date"); };
  const askDT    = (msg) => { c2bubble("bot", msg); c2mode("datetime"); };

  if(s === "start"){
    const preset = d.data_relatorio || (document.querySelector('[name="data_relatorio"]')?.value);
    if(preset){
      chat2full.data.data_relatorio = preset;
      const presetDisplay = formatDateBR(preset) || preset;
      c2bubble("bot", `Usar data atual: ${presetDisplay}.`);
      chat2full.state = "proposto.nome";
      ask2();
      return;
    }
    askDate("Olá. Vou preencher o Relatório de Viagem (ANEXO II) com você. Qual a data de emissão do relatório?");
    chat2full.state = "data_relatorio";
    return;
  }

  // dados do proposto (campos do ANEXO II)
  if(s === "proposto.nome") return askText("Seu nome completo (sem abreviações).");
  if(s === "proposto.cpf") return askText("CPF do proposto (somente números).");
  if(s === "proposto.siape") return askText("SIAPE do proposto (somente números).");
  if(s === "proposto.orgao.tipo"){
    return askQuick("Órgão de exercício do proposto:", [
      {label:"CCHSA", primary:true, onClick:()=>reply2("proposto.orgao.tipo","cchsa")},
      {label:"CAVN", onClick:()=>reply2("proposto.orgao.tipo","cavn")},
      {label:"Projetos", onClick:()=>reply2("proposto.orgao.tipo","projetos")},
      {label:"Outros", onClick:()=>reply2("proposto.orgao.tipo","outros")},
    ]);
  }
  if(s === "proposto.orgao.detalhe") return askText("Informe o nome do projeto/unidade (obrigatório para Projetos/Outros).");

  // afastamento
  if(s === "afastamento.ida.origem") return askText("Origem da ida (cidade/UF).");
  if(s === "afastamento.ida.destino") return askText("Destino da ida (cidade/UF).");
  if(s === "afastamento.ida.data_hora") return askDT("Data e hora da ida.");

  if(s === "afastamento.retorno.origem"){
    return askQuick("Origem do retorno (normalmente o destino da ida). Confirmar?", [
      {label:`Usar “${d.afastamento.ida.destino || "destino da ida"}”`, primary:true, onClick:()=>{
        if(d.afastamento.ida.destino) reply2("afastamento.retorno.origem", d.afastamento.ida.destino);
        else { chat2full.state="afastamento.retorno.origem_text"; ask2(); }
      }},
      {label:"Informar manualmente", onClick:()=>{ chat2full.state="afastamento.retorno.origem_text"; ask2(); }},
    ]);
  }
  if(s === "afastamento.retorno.origem_text") return askText("Digite a origem do retorno (cidade/UF).");

  if(s === "afastamento.retorno.destino"){
    return askQuick("Destino do retorno (normalmente a origem da ida). Confirmar?", [
      {label:`Usar “${d.afastamento.ida.origem || "origem da ida"}”`, primary:true, onClick:()=>{
        if(d.afastamento.ida.origem) reply2("afastamento.retorno.destino", d.afastamento.ida.origem);
        else { chat2full.state="afastamento.retorno.destino_text"; ask2(); }
      }},
      {label:"Informar manualmente", onClick:()=>{ chat2full.state="afastamento.retorno.destino_text"; ask2(); }},
    ]);
  }
  if(s === "afastamento.retorno.destino_text") return askText("Digite o destino do retorno (cidade/UF).");

  if(s === "afastamento.retorno.data_hora") return askDT("Data e hora do retorno.");

  // viagem realizada
  if(s === "viagem_realizada"){
    return askQuick("A viagem foi realizada?", [
      {label:"SIM", primary:true, onClick:()=>reply2("viagem_realizada","sim")},
      {label:"NÃO", onClick:()=>reply2("viagem_realizada","nao")},
    ]);
  }

  // atividades
  if(s === "atividades_mode"){
    return askQuick("Quer que eu monte um texto objetivo a partir de um modelo?", [
      {label:"Sim (modelo)", primary:true, onClick:()=>{ chat2full.state="atividades_modelo"; ask2(); }},
      {label:"Não, vou escrever", onClick:()=>{ chat2full.state="atividades_livre"; ask2(); }},
    ]);
  }

  if(s === "atividades_modelo"){
    return askQuick("Qual o tipo principal de atividade?", [
      {label:"Evento (congresso/seminário)", primary:true, onClick:()=>reply2("ativ_modelo","evento")},
      {label:"Capacitação/Curso", onClick:()=>reply2("ativ_modelo","capacitacao")},
      {label:"Reunião técnica", onClick:()=>reply2("ativ_modelo","reuniao")},
      {label:"Visita técnica", onClick:()=>reply2("ativ_modelo","visita")},
      {label:"Sem modelo", onClick:()=>{ chat2full.state="atividades_livre"; ask2(); }},
    ]);
  }

  if(s === "atividades_livre") return askText("Descreva as atividades desenvolvidas (objetivo e direto).");

  if(s === "nao_realizada_motivo") return askText("Viagem não realizada. Informe, de forma objetiva, o motivo.");

  if(s === "just_prazo"){
    return askText("Relatório fora do prazo (mais de 5 dias após retorno). Informe uma justificativa objetiva.");
  }

  if(s === "summary"){
    const payload = buildPayloadAnexo2FromChat();
    const cpf = payload?.proposto?.cpf || "";
    const cpfMask = cpf && cpf.length===11 ? (cpf.slice(0,3)+"***"+cpf.slice(-2)) : "—";
    const fmtDate = (v) => formatDateBR(v) || "—";
    const fmtDT = (v) => formatDateTimeBR(v) || "—";
    const resumo =
`Resumo:
• Proposto: ${payload?.proposto?.nome || "—"} | CPF: ${cpfMask} | SIAPE: ${payload?.proposto?.siape || "—"}
• Órgão: ${payload?.proposto?.orgao?.tipo || "—"} ${payload?.proposto?.orgao?.detalhe ? "(" + payload.proposto.orgao.detalhe + ")" : ""}
• Data do relatório: ${fmtDate(payload.data_relatorio)}
• Ida: ${payload?.afastamento?.ida?.origem || "—"} → ${payload?.afastamento?.ida?.destino || "—"} | ${fmtDT(payload?.afastamento?.ida?.data_hora)}
• Retorno: ${payload?.afastamento?.retorno?.origem || "—"} → ${payload?.afastamento?.retorno?.destino || "—"} | ${fmtDT(payload?.afastamento?.retorno?.data_hora)}
• Viagem realizada: ${payload.viagem_realizada || "—"}

Ao aplicar, eu preencho o formulário manual e te levo para o início para revisão.`;

    return askQuick(resumo, [
      {label:"Aplicar e revisar", primary:true, onClick:()=>finalizeChatAnexo2ToManual()},
    ]);
  }
}

function reply2(field, value){
  c2bubble("user", String(value));
  const d = chat2full.data;
  const fail = (msg) => { c2bubble("bot", msg); ask2(); };

  // data relatório
  if(chat2full.state === "data_relatorio"){
    d.data_relatorio = value;
    chat2full.state = "proposto.nome";
    ask2(); return;
  }

  // dados do proposto
  if(chat2full.state === "proposto.nome"){
    if(!isMinMax(value, 3, 120)) return fail("Nome inválido. Informe o nome completo (mín. 3 caracteres).");
    d.proposto.nome = value.trim();
    chat2full.state = "proposto.cpf"; ask2(); return;
  }
  if(chat2full.state === "proposto.cpf"){
    const cpf = onlyDigits(value);
    if(!/^[0-9]{11}$/.test(cpf)) return fail("CPF deve ter 11 dígitos (somente números).");
    if(!isCPF(cpf)) return fail("CPF inválido (dígitos verificadores não conferem).");
    d.proposto.cpf = cpf;
    chat2full.state = "proposto.siape"; ask2(); return;
  }
  if(chat2full.state === "proposto.siape"){
    const siape = onlyDigits(value);
    if(!isSiape(siape)) return fail("SIAPE inválido (somente números, 4 a 15 dígitos).");
    d.proposto.siape = siape;
    chat2full.state = "proposto.orgao.tipo"; ask2(); return;
  }
  if(field === "proposto.orgao.tipo"){
    d.proposto.orgao.tipo = value;
    if(value === "projetos" || value === "outros"){
      chat2full.state = "proposto.orgao.detalhe"; ask2(); return;
    }
    d.proposto.orgao.detalhe = null;
    chat2full.state = "afastamento.ida.origem"; ask2(); return;
  }
  if(chat2full.state === "proposto.orgao.detalhe"){
    if(!isMinMax(value, 2, 120)) return fail("Detalhe obrigatório para Projetos/Outros.");
    d.proposto.orgao.detalhe = value.trim();
    chat2full.state = "afastamento.ida.origem"; ask2(); return;
  }

  // afastamento texto
  if(chat2full.state === "afastamento.ida.origem"){
    if(!isMinMax(value, 2, 80)) return fail("Origem inválida.");
    d.afastamento.ida.origem = value.trim();
    chat2full.state = "afastamento.ida.destino"; ask2(); return;
  }
  if(chat2full.state === "afastamento.ida.destino"){
    if(!isMinMax(value, 2, 80)) return fail("Destino inválido.");
    d.afastamento.ida.destino = value.trim();
    chat2full.state = "afastamento.ida.data_hora"; ask2(); return;
  }

  if(field === "afastamento.retorno.origem"){
    d.afastamento.retorno.origem = value.trim();
    chat2full.state = "afastamento.retorno.destino"; ask2(); return;
  }
  if(chat2full.state === "afastamento.retorno.origem_text"){
    if(!isMinMax(value, 2, 80)) return fail("Origem inválida.");
    d.afastamento.retorno.origem = value.trim();
    chat2full.state = "afastamento.retorno.destino"; ask2(); return;
  }
  if(field === "afastamento.retorno.destino"){
    d.afastamento.retorno.destino = value.trim();
    chat2full.state = "afastamento.retorno.data_hora"; ask2(); return;
  }
  if(chat2full.state === "afastamento.retorno.destino_text"){
    if(!isMinMax(value, 2, 80)) return fail("Destino inválido.");
    d.afastamento.retorno.destino = value.trim();
    chat2full.state = "afastamento.retorno.data_hora"; ask2(); return;
  }

  // viagem realizada / modelo
  if(field === "viagem_realizada"){
    d.viagem_realizada = value;
    if(value === "nao"){
      chat2full.state = "nao_realizada_motivo";
      ask2(); return;
    }
    chat2full.state = "atividades_mode"; ask2(); return;
  }

  if(field === "ativ_modelo"){
    d.atividades_desenvolvidas = buildActivitiesTemplate(value);
    if(isLate5Days()){
      chat2full.state = "just_prazo"; ask2(); return;
    }
    chat2full.state = "summary"; ask2(); return;
  }

  if(chat2full.state === "atividades_livre"){
    if(!isMinMax(value, 10, 4000)) return fail("Texto curto. Informe pelo menos 10 caracteres.");
    d.atividades_desenvolvidas = value.trim();
    if(isLate5Days()){
      chat2full.state = "just_prazo"; ask2(); return;
    }
    chat2full.state = "summary"; ask2(); return;
  }

  if(chat2full.state === "nao_realizada_motivo"){
    if(!isMinMax(value, 10, 2000)) return fail("Texto curto. Informe pelo menos 10 caracteres.");
    d.atividades_desenvolvidas = `Viagem não realizada.\nMotivo: ${value.trim()}.`;
    if(isLate5Days()){
      chat2full.state = "just_prazo"; ask2(); return;
    }
    chat2full.state = "summary"; ask2(); return;
  }

  if(chat2full.state === "just_prazo"){
    if(!isMinMax(value, 10, 2000)) return fail("Justificativa curta. Informe pelo menos 10 caracteres.");
    d.justificativa_prestacao_contas_fora_prazo = value.trim();
    chat2full.state = "summary"; ask2(); return;
  }

  ask2();
}

// --------- handlers de date/datetime/text ---------
if(c2.dateOk) c2.dateOk.addEventListener("click", () => {
  const v = c2.date.value;
  const iso = parseDateBRToISO(v);
  if(!iso){
    c2bubble("bot", "Formato esperado: dd/mm/aaaa.");
    return;
  }
  const display = formatDateBR(iso) || iso;
  c2.date.value = display;
  c2bubble("user", display);

  if(chat2full.state === "data_relatorio"){
    reply2("data_relatorio", iso);
    return;
  }
});

if(c2.dtOk) c2.dtOk.addEventListener("click", () => {
  const v = c2.dt.value;
  if(!v) return;
  c2bubble("user", v);

  const d = chat2full.data;

  if(chat2full.state === "afastamento.ida.data_hora"){
    d.afastamento.ida.data_hora = v;
    chat2full.state = "afastamento.retorno.origem";
    ask2();
    return;
  }

  if(chat2full.state === "afastamento.retorno.data_hora"){
    d.afastamento.retorno.data_hora = v;

    // valida retorno >= ida
    const ida = d.afastamento.ida.data_hora ? new Date(d.afastamento.ida.data_hora) : null;
    const ret = d.afastamento.retorno.data_hora ? new Date(d.afastamento.retorno.data_hora) : null;
    if(ida && ret && ret < ida){
      c2bubble("bot", "O retorno não pode ser anterior à ida. Informe novamente a data/hora do retorno.");
      chat2full.state = "afastamento.retorno.data_hora";
      ask2();
      return;
    }

    chat2full.state = "viagem_realizada";
    ask2();
    return;
  }
});

if(c2.send) c2.send.addEventListener("click", () => {
  const v = (c2.text.value || "").trim();
  if(!v) return;

  const s = chat2full.state;

  if(
    s === "proposto.nome" ||
    s === "proposto.cpf" ||
    s === "proposto.siape" ||
    s === "proposto.orgao.detalhe" ||
    s === "afastamento.ida.origem" ||
    s === "afastamento.ida.destino" ||
    s === "afastamento.retorno.origem_text" ||
    s === "afastamento.retorno.destino_text" ||
    s === "atividades_livre" ||
    s === "nao_realizada_motivo" ||
    s === "just_prazo"
  ){
    reply2(s, v);
  }

  c2.text.value = "";
});
// Enviar mensagem com Enter no campo de texto
if(c2.text) c2.text.addEventListener("keydown", (ev) => {
  if(ev.key === "Enter"){
    ev.preventDefault();
    if(c2.send) c2.send.click();
  }
});

// --------- abrir/fechar chat ---------
if(c2.open) c2.open.addEventListener("click", () => {
  c2.tl.innerHTML = "";
  chat2full.state = "start";
  chat2full.data = {
    data_relatorio: null,
    proposto: { nome:null, cpf:null, siape:null, orgao:{tipo:null, detalhe:null} },
    afastamento: { ida:{origem:null,destino:null,data_hora:null}, retorno:{origem:null,destino:null,data_hora:null} },
    viagem_realizada:null,
    atividades_desenvolvidas:null,
    justificativa_prestacao_contas_fora_prazo:null,
    _ativ_modelo:null
  };
  const currentDate = document.querySelector('[name="data_relatorio"]')?.value;
  if(currentDate) chat2full.data.data_relatorio = currentDate;
  c2.modal.style.display = "block";
  ask2();
});

if(c2.close) c2.close.addEventListener("click", () => {
  c2.modal.style.display = "none";
});

function resetWizardToStart(){
  form.reset();
  showErrors(null);
  setStatus("Rascunho", "");
  const reviewText = document.getElementById("reviewText");
  if(reviewText) reviewText.textContent = "";
  const reviewBadge = document.getElementById("reviewBadge");
  if(reviewBadge){ reviewBadge.textContent = "—"; reviewBadge.className = "badge"; }
  const badgePrazo = document.getElementById("badgePrazo");
  if(badgePrazo){ badgePrazo.textContent = "Prazo: —"; badgePrazo.className = "badge"; }
  orgWrap.style.display = "none";
  const just = document.getElementById("wrapJustPrazo");
  if(just) just.style.display = "none";
  setGenProgress(false);
  setDataRelatorioFromServer();
  refreshAutoFlags();
  gotoStep(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Buttons */
document.getElementById("btnBack").addEventListener("click", () => gotoStep(current - 1));
document.getElementById("btnNext").addEventListener("click", () => {
  if(!validateStep(current)) return;
  if(current >= total) return;
  gotoStep(current + 1);
});
document.getElementById("btnDocx").addEventListener("click", async () => {
  for(let i=1;i<=total;i++){
    if(!validateStep(i)){ gotoStep(i); return; }
  }
  await generate("docx");
});
document.getElementById("btnPdf").addEventListener("click", async () => {
  for(let i=1;i<=total;i++){
    if(!validateStep(i)){ gotoStep(i); return; }
  }
  await generate("pdf");
});

/* init */
steps.forEach(s => s.style.display = "none");
gotoStep(1);
setStatus("Rascunho", "");
