(function () {
  "use strict";

  const cfg = window.TARGUS_POWERUP_CONFIG;
  const $ = (selector) => document.querySelector(selector);
  const t = window.TrelloPowerUp.iframe({ appKey: cfg.appKey, appName: cfg.appName });
  let currentApi = null;
  let boardCache = null;
  let busy = false;

  const CALENDAR_SVG = '<svg class="cal-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';

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
    if (isPlaceholder(cfg.appKey)) {
      const box = $("#setupNotice");
      box.textContent = "CONFIGURAÇÃO PENDENTE: falta inserir a chave do Power-Up em config.js (appKey).";
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

  /* Usa o quadro em que o botão foi clicado. */
  async function getCurrentBoardId() {
    const ctx = t.getContext();
    if (ctx && ctx.board) return ctx.board;
    const board = await t.board("id");
    return board.id;
  }

  async function getBoardData(forceReload = false) {
    if (!forceReload && boardCache) return boardCache;
    const boardId = await getCurrentBoardId();
    const id = encodeURIComponent(boardId);
    const [lists, labels, board] = await Promise.all([
      apiRequest("GET", `/boards/${id}/lists`, { filter: "open", fields: "id,name,closed" }),
      apiRequest("GET", `/boards/${id}/labels`, { fields: "id,name,color", limit: 1000 }),
      apiRequest("GET", `/boards/${id}`, { fields: "id,name" })
    ]);
    boardCache = { boardId: board.id, boardName: board.name, lists, labels };
    return boardCache;
  }

  function findAreaList(data, area) {
    const wanted = norm(cfg.areas[area].listName);
    return data.lists.find(list => norm(list.name) === wanted);
  }

  function showListWarnings(data) {
    const missing = Object.values(cfg.areas).filter(a => !data.lists.some(l => norm(l.name) === norm(a.listName)));
    const box = $("#setupNotice");
    if (missing.length) {
      const names = data.lists.map(l => l.name).join(", ") || "nenhuma";
      box.textContent = `ATENÇÃO: no quadro “${data.boardName}” não encontrei a(s) lista(s): ${missing.map(a => a.listName).join(", ")}. Listas existentes: ${names}. Ajuste o nome em config.js (listName).`;
      show(box, true);
    } else {
      show(box, false);
    }
  }

  /* Tipos de card disponíveis dependem da área (ex.: STORYS só no Instagram). */
  function fillTypes() {
    const area = $("#contentArea").value;
    const select = $("#contentType");
    select.innerHTML = "";
    for (const type of cfg.areas[area].types) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    }
  }

  function setupDateRows() {
    const container = $("#contentRows");
    container.innerHTML = "";
    for (let index = 1; index <= cfg.contentCardsPerBatch; index++) {
      const row = document.createElement("div");
      row.className = "date-row";
      row.innerHTML = `
        <label>Data da publicação ${index}
          <span class="date-field">
            ${CALENDAR_SVG}
            <input type="date" class="publish-date" data-index="${index}" aria-label="Data da publicação ${index}">
          </span>
        </label>
        <label>Tema / título (opcional)
          <input type="text" class="publish-title" data-index="${index}" maxlength="120" placeholder="Ex.: 3 erros que custam caro">
        </label>`;
      container.appendChild(row);
    }
    container.querySelectorAll("input").forEach(input => input.addEventListener("input", updateContentCount));
    container.querySelectorAll(".publish-date").forEach(input => input.addEventListener("click", () => {
      try { input.showPicker(); } catch (e) { /* navegador sem showPicker */ }
    }));
  }

  function updateContentCount() {
    const dates = Array.from(document.querySelectorAll(".publish-date")).map(x => x.value).filter(Boolean);
    $("#contentCount").textContent = `${dates.length} card(s) selecionado(s)`;
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
  function atLocalHour(date, hour) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
    return d.toISOString();
  }
  function formatDate(value) {
    const d = typeof value === "string" ? parseDateLocal(value) : value;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  async function ensureLabel(type) {
    const spec = cfg.labelsByType[type];
    if (!spec || !spec.name) throw new Error(`Não há etiqueta configurada para o tipo “${type}”.`);
    const data = await getBoardData();
    let label = data.labels.find(item => norm(item.name) === norm(spec.name));
    if (!label) {
      label = await apiRequest("POST", `/boards/${encodeURIComponent(data.boardId)}/labels`, {
        name: spec.name,
        color: spec.color || "blue"
      });
      data.labels.push(label);
    }
    return label;
  }

  async function createCard(listId, name, dueDate) {
    const params = { idList: listId, name };
    if (dueDate) params.due = dueDate;
    return apiRequest("POST", "/cards", params);
  }

  async function addLabelAfterCreation(cardId, labelId) {
    // Aplicar separadamente após criar o card para gerar o evento "etiqueta adicionada" (Butler).
    return apiRequest("POST", `/cards/${encodeURIComponent(cardId)}/idLabels`, { value: labelId });
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
    const dateInputs = Array.from(document.querySelectorAll(".publish-date"));
    const titleInputs = Array.from(document.querySelectorAll(".publish-title"));
    const entries = dateInputs
      .map((input, index) => ({ date: input.value, title: titleInputs[index].value.trim() }))
      .filter(x => x.date);

    if (!entries.length) return result(resultBox, "Selecione pelo menos uma data de publicação.", "error");
    if (!cfg.areas[area].types.includes(type)) {
      return result(resultBox, `O tipo ${type} não pode ser criado na área ${cfg.areas[area].name}.`, "error");
    }
    const duplicates = entries.map(x => x.date).filter((date, index, all) => all.indexOf(date) !== index);
    if (duplicates.length) return result(resultBox, "Há datas repetidas. Use uma data diferente para cada card.", "error");

    busy = true;
    setBusy(button, true, "Gerando cards...");
    show(resultBox, false);
    let created = 0;
    const skipped = [];
    const failures = [];
    try {
      const data = await getBoardData();
      const targetList = findAreaList(data, area);
      if (!targetList) {
        throw new Error(`não encontrei a lista “${cfg.areas[area].listName}” neste quadro.`);
      }
      const label = await ensureLabel(type);
      const existingCards = await listCards(targetList.id);
      for (const entry of entries) {
        const name = entry.title
          ? `${type} — ${entry.title} — ${formatDate(entry.date)}`
          : `${type} — ${formatDate(entry.date)}`;
        if (existingCards.some(card => norm(card.name) === norm(name) && !card.closed)) {
          skipped.push(`${name} (já existe na lista)`);
          continue;
        }
        try {
          const dueDay = addCalendarDays(entry.date, -cfg.publishLeadDays);
          const dueIso = atLocalHour(dueDay, cfg.contentDeadlineHour);
          const card = await createCard(targetList.id, name, dueIso);
          await addLabelAfterCreation(card.id, label.id);
          created++;
        } catch (error) {
          failures.push(`${name}: ${error.message}`);
        }
      }
      const lines = [`Cards criados: ${created}.`];
      if (skipped.length) lines.push(`Ignorados por duplicidade: ${skipped.length}\n- ${skipped.join("\n- ")}`);
      if (failures.length) lines.push(`Falhas: ${failures.length}\n- ${failures.join("\n- ")}`);
      result(resultBox, lines.join("\n"), failures.length ? "error" : "success");
    } catch (error) {
      result(resultBox, `Não foi possível gerar os cards: ${error.message}`, "error");
    } finally {
      busy = false;
      setBusy(button, false, "");
    }
  }

  async function loadMainPanel() {
    show($("#authPanel"), false);
    show($("#mainPanel"), true);
    fillTypes();
    updateContentCount();
    showListWarnings(await getBoardData());
  }

  function connectAndLoad() {
    if (!checkConfig()) return;
    const button = $("#connectButton");
    button.disabled = true;
    $("#authError").textContent = "";
    try {
      // authorize() precisa ser chamado direto do clique para o navegador não bloquear o popup.
      getApi().authorize({ scope: "read,write", expiration: "never" })
        .then(async function () {
          try {
            await loadMainPanel();
          } catch (error) {
            show($("#mainPanel"), true);
            result($("#contentResult"), `Autorização concluída, mas não foi possível carregar o quadro: ${error.message}`, "error");
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
    fillTypes();
    checkConfig();
    $("#connectButton").addEventListener("click", connectAndLoad);
    $("#contentArea").addEventListener("change", fillTypes);
    $("#generateContentButton").addEventListener("click", generateContent);

    if (checkConfig()) {
      try {
        if (await getApi().isAuthorized()) {
          await loadMainPanel();
          return;
        }
      } catch (error) {
        if (error && /Erro do Trello|quadro/i.test(error.message)) {
          show($("#authPanel"), false);
          show($("#mainPanel"), true);
          result($("#contentResult"), `Não foi possível carregar o quadro: ${error.message}`, "error");
          return;
        }
        $("#authError").textContent = error.message;
      }
      show($("#authPanel"), true);
    } else {
      show($("#authPanel"), true);
    }
  }

  t.render(init);
})();
