(function () {
  "use strict";

  const cfg = window.TARGUS_POWERUP_CONFIG;
  const $ = (selector) => document.querySelector(selector);
  const t = window.TrelloPowerUp.iframe({ appKey: cfg.appKey, appName: cfg.appName });
  let currentApi = null;
  let boardCache = {};
  let currentMembers = [];
  let busy = false;

  const norm = (s) => String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLocaleUpperCase("pt-BR");

  function show(el, visible) { el.classList.toggle("hidden", !visible); }
  function result(el, message, kind) {
    el.textContent = message;
    el.className = "result-box" + (kind ? " " + kind : "");
    show(el, true);
  }
  function setBusy(button, value, text) {
    button.disabled = value;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.textContent = value ? text : button.dataset.originalText;
  }
  function isPlaceholder(value) {
    return !value || value.includes("COLE_AQUI") || value.includes("PREENCHER");
  }
  function checkConfig() {
    const problems = [];
    if (isPlaceholder(cfg.appKey)) problems.push("1. Falta inserir a chave do Power-Up em config.js (appKey). ");
    for (const key of ["instagram", "prospeccao"]) {
      if (isPlaceholder(cfg.boards[key].id)) problems.push(`Falta inserir o ID do quadro ${cfg.boards[key].name} em config.js.`);
    }
    if (problems.length) {
      const box = $("#setupNotice");
      box.textContent = "CONFIGURAÇÃO PENDENTE: " + problems.join(" ");
      show(box, true);
      $("#connectButton").disabled = true;
      return false;
    }
    show($("#setupNotice"), false);
    $("#connectButton").disabled = false;
    return true;
  }

  function getApi() {
    if (!currentApi) currentApi = t.getRestApi();
    return currentApi;
  }

  async function apiRequest(method, path, params = {}) {
    const api = await getApi();
    if (!(await api.isAuthorized())) {
      throw new Error("Você precisa conectar o Trello primeiro.");
    }
    const token = await api.getToken();
    if (!token) throw new Error("Token de autorização não encontrado. Clique em Conectar ao Trello.");
    const url = new URL("https://api.trello.com/1" + path);
    url.searchParams.set("key", cfg.appKey);
    url.searchParams.set("token", token);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await fetch(url.toString(), {
      method,
      headers: { "Accept": "application/json" }
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!response.ok) {
      const details = data.message || data.error || `HTTP ${response.status}`;
      throw new Error(`Erro do Trello (${response.status}): ${details}`);
    }
    return data;
  }

  async function getBoardData(area, forceReload = false) {
    if (!forceReload && boardCache[area]) return boardCache[area];
    const board = cfg.boards[area];
    const [allLists, labels, members] = await Promise.all([
      apiRequest("GET", `/boards/${encodeURIComponent(board.id)}/lists`, { fields: "id,name,closed" }),
      apiRequest("GET", `/boards/${encodeURIComponent(board.id)}/labels`, { fields: "id,name,color" }),
      apiRequest("GET", `/boards/${encodeURIComponent(board.id)}/members`, { fields: "id,fullName,username" })
    ]);
    const allowed = board.allowedLists.map(norm);
    const lists = allLists.filter(list => !list.closed && allowed.includes(norm(list.name)));
    const sortedMembers = members.slice().sort((a, b) => (a.fullName || a.username || "").localeCompare(b.fullName || b.username || "", "pt-BR"));
    const data = { board, lists, allLists, labels, members: sortedMembers };
    boardCache[area] = data;
    return data;
  }

  function showListWarnings(area, data) {
    const expected = cfg.boards[area].allowedLists;
    const found = new Set(data.lists.map(item => norm(item.name)));
    const missing = expected.filter(name => !found.has(norm(name)));
    if (missing.length) {
      const box = $("#setupNotice");
      box.textContent = `ATENÇÃO: no quadro “${data.board.name}”, não encontrei estas listas com o nome esperado: ${missing.join(", ")}. Confira se existem e se a grafia é igual à configurada em config.js.`;
      show(box, true);
    } else {
      show($("#setupNotice"), false);
    }
  }

  function fillSelect(select, items, getValue, getLabel, selectedValue) {
    select.innerHTML = "";
    for (const item of items) {
      const option = document.createElement("option");
      option.value = getValue(item);
      option.textContent = getLabel(item);
      if (selectedValue && option.value === selectedValue) option.selected = true;
      select.appendChild(option);
    }
  }

  function getTypeOptions(area) {
    return cfg.boards[area].allowedLists.slice();
  }

  async function refreshContentForm(area) {
    const data = await getBoardData(area);
    showListWarnings(area, data);
    fillSelect($("#contentType"), getTypeOptions(area), x => x, x => x);
    fillSelect($("#contentList"), data.lists, x => x.id, x => x.name,
      (data.lists.find(x => norm(x.name) === norm($("#contentType").value)) || {}).id);
    const memberOptions = [{ id: "", fullName: "Sem responsável" }, ...data.members];
    fillSelect($("#contentMember"), memberOptions, x => x.id, x => x.fullName || x.username || x.id, "");
    updateContentCount();
  }

  async function refreshWhatsappForm(area) {
    const data = await getBoardData(area);
    showListWarnings(area, data);
    fillSelect($("#waList"), data.lists, x => x.id, x => x.name,
      (data.lists.find(x => norm(x.name) === norm("PROSPECÇÃO ATIVA")) || data.lists[0] || {}).id);
    currentMembers = data.members;
    const membersSelect = $("#waMembers");
    membersSelect.innerHTML = "";
    for (const member of data.members) {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = member.fullName || member.username || member.id;
      option.selected = true;
      membersSelect.appendChild(option);
    }
    fillSelect($("#waFirstMember"), data.members, x => x.id, x => x.fullName || x.username || x.id,
      data.members[0] ? data.members[0].id : "");
    updateWhatsappPreview();
  }

  function setupDateRows() {
    const container = $("#contentRows");
    container.innerHTML = "";
    for (let index = 1; index <= cfg.contentCardsPerBatch; index++) {
      const row = document.createElement("div");
      row.className = "date-row";
      row.innerHTML = `
        <label>Data planejada de publicação ${index}
          <input type="date" class="publish-date" data-index="${index}" aria-label="Data planejada de publicação ${index}">
        </label>
        <label>Tema / título do card ${index} (opcional)
          <input type="text" class="publish-title" data-index="${index}" maxlength="120" placeholder="Ex.: 3 erros que custam caro ao empresário">
        </label>`;
      container.appendChild(row);
    }
    container.querySelectorAll("input").forEach(input => input.addEventListener("input", updateContentCount));
  }

  function updateContentCount() {
    const dates = Array.from(document.querySelectorAll(".publish-date")).map(x => x.value).filter(Boolean);
    $("#contentCount").textContent = `${dates.length} card(s) selecionado(s)`;
  }

  function cleanPhone(raw) {
    return String(raw).replace(/\D/g, "");
  }

  function parsePhones() {
    const raw = $("#waNumbers").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const seen = new Set();
    const valid = [];
    const invalid = [];
    const duplicate = [];
    for (const line of raw) {
      const phone = cleanPhone(line);
      if (phone.length < 10 || phone.length > 13) {
        invalid.push(line);
      } else if (seen.has(phone)) {
        duplicate.push(phone);
      } else {
        seen.add(phone);
        valid.push(phone);
      }
    }
    return { valid, invalid, duplicate };
  }

  function nextWeekday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  }
  function dateInputValue(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function parseDateLocal(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }
  function addCalendarDays(value, amount) {
    const d = parseDateLocal(value);
    d.setDate(d.getDate() + amount);
    return d;
  }
  function addWeekdaysFrom(value, offset) {
    const d = nextWeekday(parseDateLocal(value));
    let count = 0;
    while (count < offset) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    }
    return d;
  }
  function atLocalHour(date, hour) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
    return d.toISOString();
  }
  function formatDate(value) {
    const d = typeof value === "string" ? parseDateLocal(value) : value;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  async function ensureLabel(area, type) {
    const board = cfg.boards[area];
    const spec = cfg.labelsByType[type];
    if (!spec || !spec.name) throw new Error(`Não há etiqueta configurada para o tipo “${type}”.`);
    const data = await getBoardData(area);
    let label = data.labels.find(item => norm(item.name) === norm(spec.name));
    if (!label) {
      label = await apiRequest("POST", `/boards/${encodeURIComponent(board.id)}/labels`, {
        name: spec.name,
        color: spec.color || "blue"
      });
      data.labels.push(label);
    }
    return label;
  }

  async function createCard(area, listId, name, description, dueDate) {
    const params = { idList: listId, name, desc: description };
    if (dueDate) params.due = dueDate;
    return apiRequest("POST", "/cards", params);
  }

  async function addLabelAfterCreation(cardId, labelId) {
    // Aplicar separadamente após criar o card para produzir um evento de etiqueta adicionada.
    return apiRequest("POST", `/cards/${encodeURIComponent(cardId)}/idLabels`, { value: labelId });
  }

  async function addMember(cardId, memberId) {
    if (!memberId) return;
    return apiRequest("POST", `/cards/${encodeURIComponent(cardId)}/idMembers`, { value: memberId });
  }

  async function createChecklist(cardId, name, items) {
    const checklist = await apiRequest("POST", `/cards/${encodeURIComponent(cardId)}/checklists`, { name });
    for (const item of items) {
      await apiRequest("POST", `/checklists/${encodeURIComponent(checklist.id)}/checkItems`, {
        name: item,
        pos: "bottom"
      });
    }
  }

  async function listCards(listId) {
    return apiRequest("GET", `/lists/${encodeURIComponent(listId)}/cards`, { fields: "id,name,closed" });
  }

  async function generateContent() {
    if (busy) return;
    const button = $("#generateContentButton");
    const resultBox = $("#contentResult");
    const area = $("#contentArea").value;
    const type = $("#contentType").value;
    const listId = $("#contentList").value;
    const memberId = $("#contentMember").value;
    const dateInputs = Array.from(document.querySelectorAll(".publish-date"));
    const titleInputs = Array.from(document.querySelectorAll(".publish-title"));
    const entries = dateInputs.map((input, index) => ({ date: input.value, title: titleInputs[index].value.trim() })).filter(x => x.date);

    if (!entries.length) return result(resultBox, "Selecione pelo menos uma data de publicação.", "error");
    if (!listId) return result(resultBox, "Não encontrei uma lista de destino. Confira a configuração dos quadros e listas.", "error");
    const duplicates = entries.map(x => x.date).filter((date, index, all) => all.indexOf(date) !== index);
    if (duplicates.length) return result(resultBox, "Há datas repetidas. Use uma data diferente para cada card.", "error");
    const areaBoard = cfg.boards[area];
    const targetList = (await getBoardData(area)).lists.find(x => x.id === listId);
    if (!targetList) return result(resultBox, "A lista escolhida não está entre as listas autorizadas para essa área.", "error");

    busy = true;
    setBusy(button, true, "Gerando cards...");
    show(resultBox, false);
    let created = 0;
    const skipped = [];
    const failures = [];
    try {
      const label = await ensureLabel(area, type);
      const existingCards = await listCards(listId);
      for (const entry of entries) {
        const publishDate = parseDateLocal(entry.date);
        const defaultName = `${type} — ${formatDate(entry.date)}`;
        const name = entry.title ? `${type} — ${entry.title} — ${formatDate(entry.date)}` : defaultName;
        if (existingCards.some(card => norm(card.name) === norm(name) && !card.closed)) {
          skipped.push(`${name} (já existe na lista)`);
          continue;
        }
        try {
          const dueDay = addCalendarDays(entry.date, -cfg.publishLeadDays);
          const dueIso = atLocalHour(dueDay, cfg.contentDeadlineHour);
          const desc = [
            `Área: ${areaBoard.name}`,
            `Tipo de card: ${type}`,
            `Data planejada de publicação: ${formatDate(publishDate)}`,
            `Prazo de preparação: ${formatDate(dueDay)} às ${String(cfg.contentDeadlineHour).padStart(2, "0")}:00`,
            "",
            "Observação: a checklist correspondente deve ser adicionada pela automação do Trello após a etiqueta ser aplicada."
          ].join("\n");
          const card = await createCard(area, listId, name, desc, dueIso);
          await addLabelAfterCreation(card.id, label.id);
          await addMember(card.id, memberId);
          created++;
        } catch (error) {
          failures.push(`${name}: ${error.message}`);
        }
      }
      const lines = [`Cards criados: ${created}.`];
      if (skipped.length) lines.push(`Ignorados por duplicidade: ${skipped.length}\n- ${skipped.join("\n- ")}`);
      if (failures.length) lines.push(`Falhas: ${failures.length}\n- ${failures.join("\n- ")}`);
      lines.push("\nConfira no Trello se a automação adicionou a checklist ao detectar a etiqueta.");
      result(resultBox, lines.join("\n"), failures.length ? "error" : "success");
    } catch (error) {
      result(resultBox, `Não foi possível gerar os cards: ${error.message}`, "error");
    } finally {
      busy = false;
      setBusy(button, false, "");
    }
  }

  function updateWhatsappPreview() {
    const { valid, invalid, duplicate } = parsePhones();
    const cards = Math.ceil(valid.length / cfg.contactsPerWhatsappCard);
    const messages = [`${valid.length} números válidos · ${cards} card(s) previstos`];
    if (invalid.length) messages.push(`${invalid.length} linha(s) inválida(s)`);
    if (duplicate.length) messages.push(`${duplicate.length} duplicado(s) removido(s)`);
    $("#waPreview").textContent = messages.join(" · ");
  }

  function selectedWhatsappMembers() {
    const selectedIds = new Set(Array.from($("#waMembers").selectedOptions).map(x => x.value));
    return currentMembers.filter(x => selectedIds.has(x.id));
  }

  function rotationOrder() {
    const selected = selectedWhatsappMembers();
    const firstId = $("#waFirstMember").value;
    if (!selected.length) return [];
    const firstIndex = selected.findIndex(x => x.id === firstId);
    if (firstIndex < 0) return selected;
    return selected.slice(firstIndex).concat(selected.slice(0, firstIndex));
  }

  function nextWeekdayAfter(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  }

  async function generateWhatsapp() {
    if (busy) return;
    const button = $("#generateWhatsappButton");
    const resultBox = $("#whatsappResult");
    const area = $("#waArea").value;
    const listId = $("#waList").value;
    const startValue = $("#waStartDate").value;
    const parsed = parsePhones();
    const members = rotationOrder();
    if (!startValue) return result(resultBox, "Escolha a data inicial do rodízio.", "error");
    if (!listId) return result(resultBox, "Escolha uma lista de destino.", "error");
    if (!parsed.valid.length) return result(resultBox, "Cole pelo menos um número válido.", "error");
    if (!members.length) return result(resultBox, "Selecione pelo menos uma pessoa para o rodízio.", "error");
    busy = true;
    setBusy(button, true, "Criando disparos...");
    show(resultBox, false);
    let created = 0;
    const skipped = [];
    const failures = [];
    try {
      const label = await ensureLabel(area, "WHATSAPP");
      const existingCards = await listCards(listId);
      let currentDay = nextWeekday(parseDateLocal(startValue));
      const numCards = Math.ceil(parsed.valid.length / cfg.contactsPerWhatsappCard);
      for (let cardIndex = 0; cardIndex < numCards; cardIndex++) {
        const member = members[cardIndex % members.length];
        const phones = parsed.valid.slice(cardIndex * cfg.contactsPerWhatsappCard, (cardIndex + 1) * cfg.contactsPerWhatsappCard);
        const memberName = member.fullName || member.username || "Responsável";
        const name = `Disparo WhatsApp — ${memberName} — ${formatDate(currentDay)}`;
        if (existingCards.some(card => norm(card.name) === norm(name) && !card.closed)) {
          skipped.push(`${name} (já existe na lista)`);
          currentDay = nextWeekdayAfter(currentDay);
          continue;
        }
        try {
          const desc = [
            "Disparo WhatsApp gerado pelo Power-Up Targus.",
            `Responsável: ${memberName}`,
            `Data do disparo: ${formatDate(currentDay)}`,
            `Contatos previstos: ${phones.length}`,
            "Marque cada número no checklist depois de enviar a mensagem."
          ].join("\n");
          const card = await createCard(area, listId, name, desc, atLocalHour(currentDay, cfg.whatsappStartHour));
          await addLabelAfterCreation(card.id, label.id);
          await addMember(card.id, member.id);
          await createChecklist(card.id, "Contatos para disparo", phones);
          created++;
        } catch (error) {
          failures.push(`${name}: ${error.message}`);
        }
        currentDay = nextWeekdayAfter(currentDay);
      }
      const lines = [`Cards de WhatsApp criados: ${created}.`, `Números válidos distribuídos: ${parsed.valid.length}.`, `Pessoas no rodízio: ${members.length}.`];
      if (parsed.duplicate.length) lines.push(`Números repetidos removidos: ${parsed.duplicate.length}.`);
      if (parsed.invalid.length) lines.push(`Linhas inválidas ignoradas: ${parsed.invalid.length}.`);
      if (skipped.length) lines.push(`Ignorados por duplicidade: ${skipped.length}\n- ${skipped.join("\n- ")}`);
      if (failures.length) lines.push(`Falhas: ${failures.length}\n- ${failures.join("\n- ")}`);
      result(resultBox, lines.join("\n"), failures.length ? "error" : "success");
    } catch (error) {
      result(resultBox, `Não foi possível gerar os disparos: ${error.message}`, "error");
    } finally {
      busy = false;
      setBusy(button, false, "");
    }
  }

  function switchTab(tab) {
    document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    show($("#contentTab"), tab === "content");
    show($("#whatsappTab"), tab === "whatsapp");
  }

  function connectAndLoad() {
    if (!checkConfig()) return;
    const button = $("#connectButton");
    button.disabled = true;
    $("#authError").textContent = "";
    try {
      const api = getApi();
      // A autorização é chamada diretamente a partir do clique do usuário,
      // para reduzir a chance de o navegador bloquear a janela de consentimento.
      api.authorize({ scope: "read,write", expiration: "never" })
        .then(async function () {
          try {
            show($("#authPanel"), false);
            show($("#mainPanel"), true);
            await Promise.all([
              refreshContentForm($("#contentArea").value),
              refreshWhatsappForm($("#waArea").value)
            ]);
          } catch (error) {
            show($("#mainPanel"), true);
            result($("#contentResult"), `Autorização concluída, mas não foi possível carregar os quadros: ${error.message}`, "error");
          }
        })
        .catch(function (error) {
          $("#authError").textContent = `Não foi possível conectar: ${error.message}`;
          button.disabled = false;
        });
    } catch (error) {
      $("#authError").textContent = `Não foi possível iniciar a autorização: ${error.message}`;
      button.disabled = false;
    }
  }

  async function init() {
    setupDateRows();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDay = nextWeekday(tomorrow);
    $("#waStartDate").value = dateInputValue(nextDay);
    checkConfig();
    $("#connectButton").addEventListener("click", connectAndLoad);
    $("#contentArea").addEventListener("change", async () => {
      try { await refreshContentForm($("#contentArea").value); }
      catch (error) { result($("#contentResult"), error.message, "error"); }
    });
    $("#contentType").addEventListener("change", () => {
      const area = $("#contentArea").value;
      const type = $("#contentType").value;
      const data = boardCache[area];
      const match = data && data.lists.find(x => norm(x.name) === norm(type));
      if (match) $("#contentList").value = match.id;
    });
    $("#waArea").addEventListener("change", async () => {
      try { await refreshWhatsappForm($("#waArea").value); }
      catch (error) { result($("#whatsappResult"), error.message, "error"); }
    });
    $("#waNumbers").addEventListener("input", updateWhatsappPreview);
    $("#waMembers").addEventListener("change", () => {
      const selected = selectedWhatsappMembers();
      if (!selected.some(x => x.id === $("#waFirstMember").value) && selected[0]) $("#waFirstMember").value = selected[0].id;
    });
    $("#generateContentButton").addEventListener("click", generateContent);
    $("#generateWhatsappButton").addEventListener("click", generateWhatsapp);
    document.querySelectorAll(".tab-button").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));

    if (checkConfig()) {
      try {
        const api = getApi();
        if (await api.isAuthorized()) {
          show($("#authPanel"), false);
          show($("#mainPanel"), true);
          await Promise.all([
            refreshContentForm($("#contentArea").value),
            refreshWhatsappForm($("#waArea").value)
          ]);
          return;
        }
      } catch (error) {
        $("#authError").textContent = error.message;
      }
      show($("#authPanel"), true);
    } else {
      show($("#authPanel"), true);
    }
  }

  t.render(init);
})();
