// hud.js (DROP-IN for your current index.html)

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString();
}

function sysLog(line, kind = "muted") {
  const box = $("sysLog");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "sysline " + kind;
  div.textContent = `[${nowTime()}] ${line}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addMsg(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + role;

  const tag = document.createElement("div");
  tag.className = "msg-tag";
  tag.textContent = role === "user" ? "USER" : role === "arc" ? "ARC" : "ERROR";

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text;

  wrap.appendChild(tag);
  wrap.appendChild(body);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function fetchJSON(url, init) {
  const res = await fetch(url, init);
  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

async function postQuery(prompt, user_id = "web") {
  return fetchJSON(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id }),
  });
}

async function refreshMeta() {
  // Frontend
  const host = location.host;
  const metaFrontend = $("metaFrontend");
  if (metaFrontend) metaFrontend.textContent = host;

  // API base
  const metaApi = $("metaApi");
  if (metaApi) metaApi.textContent = API_BASE;

  // Try Worker /test
  try {
    const t = await fetchJSON(`${API_BASE}/test`, { method: "GET" });
    if (t.ok) {
      const hf = $("metaHf");
      if (hf) hf.textContent = "via Worker (Render/HF failover)";
      sysLog("Worker /test OK", "ok");
    } else {
      sysLog(`Worker /test returned ${t.status}`, "warn");
    }
  } catch (e) {
    sysLog(`Worker /test failed: ${String(e)}`, "bad");
  }
}

// ----- UI: Panels -----
function togglePanel(id, show) {
  const el = $(id);
  if (!el) return;
  const isHidden = el.classList.contains("hidden");
  const shouldShow = show ?? isHidden;
  el.classList.toggle("hidden", !shouldShow);
  el.setAttribute("aria-hidden", shouldShow ? "false" : "true");
}

function bindPanels() {
  const btnSessions = $("btnSessions");
  const btnTools = $("btnTools");
  const btnCloseSessions = $("btnCloseSessions");
  const btnCloseTools = $("btnCloseTools");

  if (btnSessions) btnSessions.onclick = () => togglePanel("panelSessions", true);
  if (btnTools) btnTools.onclick = () => togglePanel("panelTools", true);
  if (btnCloseSessions) btnCloseSessions.onclick = () => togglePanel("panelSessions", false);
  if (btnCloseTools) btnCloseTools.onclick = () => togglePanel("panelTools", false);
}

// ----- UI: Blackout -----
function bindBlackout() {
  const btn = $("btnBlackout");
  const blackout = $("blackout");
  if (!btn || !blackout) return;

  btn.onclick = () => {
    const hidden = blackout.classList.contains("hidden");
    blackout.classList.toggle("hidden", !hidden);
    blackout.setAttribute("aria-hidden", hidden ? "false" : "true");
  };

  blackout.onclick = () => {
    blackout.classList.add("hidden");
    blackout.setAttribute("aria-hidden", "true");
  };
}

// ----- Chat send -----
async function sendFromComposer() {
  const input = $("prompt");
  const btn = $("send");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  addMsg("user", prompt);
  input.value = "";

  if (btn) btn.disabled = true;
  sysLog("Sending /query …");

  try {
    const r = await postQuery(prompt, "web");

    const upstream = r.headers.get("X-ARC-Upstream");
    if (upstream) sysLog(`Upstream: ${upstream}`, "ok");

    if (!r.ok) {
      addMsg("err", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      sysLog(`Query failed (${r.status})`, "bad");
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addMsg("arc", reply);
    sysLog("Query OK", "ok");
  } catch (e) {
    addMsg("err", `NETWORK ERROR: ${String(e)}`);
    sysLog(`Network error: ${String(e)}`, "bad");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindComposer() {
  const btn = $("send");
  const input = $("prompt");

  if (btn) btn.onclick = sendFromComposer;

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendFromComposer();
      }
    });
  }
}

// ----- System buttons -----
function bindSystemButtons() {
  const btnPing = $("btnPing");
  const btnTest = $("btnTest");
  const btnClearChat = $("btnClearChat");

  if (btnPing) btnPing.onclick = () => {
    const input = $("prompt");
    if (input) input.value = "ping";
    sendFromComposer();
  };

  if (btnTest) btnTest.onclick = async () => {
    sysLog("Testing Worker /test …");
    try {
      const t = await fetchJSON(`${API_BASE}/test`, { method: "GET" });
      if (t.ok) {
        sysLog(`Worker /test OK: ${JSON.stringify(t.data)}`, "ok");
      } else {
        sysLog(`Worker /test ${t.status}: ${JSON.stringify(t.data)}`, "warn");
      }
    } catch (e) {
      sysLog(`Worker /test failed: ${String(e)}`, "bad");
    }
  };

  if (btnClearChat) btnClearChat.onclick = () => {
    const chat = $("chat");
    if (chat) chat.innerHTML = "";
    sysLog("Cleared chat view", "muted");
  };
}

document.addEventListener("DOMContentLoaded", () => {
  bindPanels();
  bindBlackout();
  bindComposer();
  bindSystemButtons();
  refreshMeta();

  // Friendly starter line so you know JS is alive
  sysLog("HUD ready. Type ping + tap Send.", "ok");
});