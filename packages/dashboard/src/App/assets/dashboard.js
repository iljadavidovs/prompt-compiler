function defaultApiBase() {
  if (window.location.port === "4317") {
    return "";
  }
  if (["pcr.lan", "127.0.0.1", "localhost"].includes(window.location.hostname) && ["", "80"].includes(window.location.port)) {
    return "";
  }
  return "http://127.0.0.1:4317";
}

const apiBase = localStorage.getItem("pcr.apiBase") || defaultApiBase();
const page = document.body.dataset.page || "history";

const state = {
  tools: [],
  settings: {},
  selectedToolId: "",
  history: [],
};

const $ = (id) => document.getElementById(id);

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function setStatus(value, isError = false) {
  const node = $("daemonStatus");
  if (!node) return;
  node.textContent = value;
  node.classList.toggle("error", isError);
}

function selectedTool() {
  return state.tools.find((tool) => tool.id === state.selectedToolId) || state.tools[0];
}

function renderShell(settings, history) {
  if ($("runCount")) $("runCount").textContent = String(history.length);
  if ($("toolCount")) $("toolCount").textContent = String(state.tools.length);
  if ($("configPath")) $("configPath").textContent = settings.paths?.userConfigPath || "unknown";
}

function renderTools() {
  const list = $("toolList");
  if (!list) return;
  list.innerHTML = "";
  state.tools.forEach((tool) => {
    const button = document.createElement("button");
    button.className = `tool-item${tool.id === state.selectedToolId ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong>${text(tool.name)}${tool.enabled ? "" : " (disabled)"}</strong><span>${text(tool.description)}</span>`;
    button.addEventListener("click", () => {
      state.selectedToolId = tool.id;
      renderTools();
      renderSelectedTool();
    });
    list.appendChild(button);
  });
}

function renderSelectedTool() {
  const tool = selectedTool();
  if (!tool || !$("selectedToolName")) return;
  state.selectedToolId = tool.id;
  $("selectedToolName").textContent = `${tool.name} Configuration`;
  $("toolEnabled").checked = Boolean(tool.enabled);
  $("toolKeywords").value = Array.isArray(tool.config?.keywords) ? tool.config.keywords.join(", ") : "";
  $("toolConfig").value = JSON.stringify(tool.config || {}, null, 2);
  $("toolHint").textContent = `${tool.packageName} | intents: ${tool.intents.join(", ")} | modes: ${tool.modes.join(", ")}`;
}

function renderHistory(records) {
  const body = $("historyTable");
  if (!body) return;
  body.innerHTML = "";
  if (!records.length) {
    body.innerHTML = `<tr><td colspan="5" class="muted">No runs yet.</td></tr>`;
    return;
  }
  records.forEach((record) => {
    const row = document.createElement("tr");
    const skipped = Boolean(record.metadata?.skipped);
    const tool = skipped ? "skipped" : record.metadata?.selectedToolId || "unknown";
    const mode = skipped ? `${text(record.mode)} / skipped` : text(record.mode);
    row.innerHTML = `
      <td>${new Date(record.createdAt).toLocaleString()}</td>
      <td>${mode}</td>
      <td>${tool}</td>
      <td class="clip">${text(record.rawText)}</td>
      <td><button class="text-button detail-button" data-id="${text(record.compileId)}">Details</button></td>
    `;
    if (skipped) {
      row.classList.add("skipped-row");
    }
    body.appendChild(row);
  });
  body.querySelectorAll(".detail-button").forEach((button) => {
    button.addEventListener("click", () => openRunDetails(button.dataset.id));
  });
}

function renderSettings(settings) {
  const settingsJson = $("settingsJson");
  if (settingsJson) settingsJson.value = JSON.stringify(settings.config || {}, null, 2);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

async function openRunDetails(compileId) {
  if (!compileId) return;
  const record = await request(`/v1/history/${encodeURIComponent(compileId)}`);
  $("runDialogTitle").textContent = record.compileId;
  $("runDialogSubtitle").textContent = `${new Date(record.createdAt).toLocaleString()} | ${record.mode} | ${record.metadata?.skipped ? "skipped" : record.metadata?.selectedToolId || "unknown"}`;
  $("detailPrompt").textContent = record.prompt || "";
  $("detailRaw").textContent = record.rawText || "";
  $("detailMetadata").textContent = pretty(record.metadata || {});
  $("detailContext").textContent = pretty(record.contextPack || {});
  $("detailIr").textContent = pretty(record.promptIr || {});
  $("runDialog").showModal();
}

async function refresh() {
  try {
    setStatus("Checking");
    const historyLimit = $("historyLimit")?.value || "50";
    const [health, settings, history] = await Promise.all([
      request("/health"),
      request("/v1/settings"),
      request(`/v1/history?limit=${historyLimit}`),
    ]);
    state.settings = settings;
    state.tools = settings.tools || [];
    state.history = history;
    state.selectedToolId = state.selectedToolId || state.tools[0]?.id || "";
    renderShell(settings, history);
    renderTools();
    renderSelectedTool();
    renderSettings(settings);
    renderHistory(history);
    setStatus(health.ok ? "Online" : "Unknown", !health.ok);
  } catch (error) {
    setStatus("Offline", true);
    const target = $("toolList") || $("historyTable") || $("settingsJson");
    if (target) target.innerHTML = `<p class="hint error">${error.message}</p>`;
  }
}

async function saveSelectedTool() {
  const tool = selectedTool();
  if (!tool) return;
  let config;
  try {
    config = JSON.parse($("toolConfig").value || "{}");
  } catch {
    setStatus("Invalid tool JSON", true);
    return;
  }
  const keywords = $("toolKeywords").value.split(",").map((item) => item.trim()).filter(Boolean);
  if (keywords.length > 0) {
    config.keywords = keywords;
  } else {
    delete config.keywords;
  }
  await request(`/v1/tools/${encodeURIComponent(tool.id)}`, {
    method: "POST",
    body: JSON.stringify({
      enabled: $("toolEnabled").checked,
      config,
    }),
  });
  await refresh();
}

async function saveSettings() {
  let config;
  try {
    config = JSON.parse($("settingsJson").value || "{}");
  } catch {
    setStatus("Invalid settings JSON", true);
    return;
  }
  await request("/v1/settings", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
  await refresh();
}

$("refreshButton")?.addEventListener("click", refresh);
$("saveToolButton")?.addEventListener("click", saveSelectedTool);
$("saveSettingsButton")?.addEventListener("click", saveSettings);
$("historyLimit")?.addEventListener("change", refresh);
$("closeRunDialog")?.addEventListener("click", () => $("runDialog").close());
$("runDialog")?.addEventListener("click", (event) => {
  if (event.target === $("runDialog")) {
    $("runDialog").close();
  }
});

if (page === "history" || page === "tools" || page === "settings") {
  refresh();
}
