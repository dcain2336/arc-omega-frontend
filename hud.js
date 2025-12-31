// hud.js — DROP IN FULL FILE

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

function sys(msg) {
  const el = $("sysLog");
  if (!el) return;
  const line = document.createElement("div");
  line.className = "sys-line";
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function addMessage(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const card = document.createElement("div");
  card.className = `msg ${role}`;

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = role.toUpperCase();

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text;

  card.appendChild(label);
  card.appendChild(body);
  chat.appendChild(card);
  chat.scrollTop = chat.scrollHeight;
}

async function postJSON(path, payload) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  return { ok: res.ok, status: res.status, data };
}

async function sendPrompt() {
  const input = $("prompt");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  addMessage("user", prompt);
  input.value = "";

  sys("Sending /query …");

  try {
    const r = await postJSON("/query", { prompt, user_id: "web" });

    if (!r.ok) {
      addMessage("error", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      sys(`Error ${r.status}`);
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    // show which upstream answered if the Worker returned it
    // (we can’t read response headers in this simple helper, but your Worker sets X-ARC-Upstream—
    // you’ll see it when testing with a REST client; UI can be upgraded later)
    addMessage("arc", reply);
    sys("OK");
  } catch (e) {
    addMessage("error", `NETWORK ERROR: ${String(e)}`);
    sys(`NETWORK ERROR: ${String(e)}`);
  }
}

async function testAPI() {
  sys("Testing API /test …");
  try {
    const res = await fetch(API_BASE + "/test", { method: "GET" });
    const txt = await res.text();
    sys(`API /test -> ${res.status}`);
    addMessage("system", txt);
  } catch (e) {
    addMessage("error", `NETWORK ERROR: ${String(e)}`);
    sys(`NETWORK ERROR: ${String(e)}`);
  }
}

// Panels + controls (your Phase 1 UI)
function togglePanel(id, show) {
  const p = $(id);
  if (!p) return;
  p.classList.toggle("hidden", !show);
  p.setAttribute("aria-hidden", show ? "false" : "true");
}

function setupUI() {
  // meta pills
  const metaFrontend = $("metaFrontend");
  const metaApi = $("metaApi");
  const metaHf = $("metaHf");

  if (metaFrontend) metaFrontend.textContent = location.host;
  if (metaApi) metaApi.textContent = API_BASE;
  if (metaHf) metaHf.textContent = "via Worker (Render/HF failover)";

  // composer wiring
  const sendBtn = $("send");
  const input = $("prompt");

  if (sendBtn) sendBtn.addEventListener("click", sendPrompt);

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  }

  // system buttons
  const btnPing = $("btnPing");
  const btnTest = $("btnTest");
  if (btnPing) btnPing.addEventListener("click", () => {
    if (input) input.value = "ping";
    sendPrompt();
  });
  if (btnTest) btnTest.addEventListener("click", testAPI);

  // sessions panel
  const btnSessions = $("btnSessions");
  const btnCloseSessions = $("btnCloseSessions");
  if (btnSessions) btnSessions.addEventListener("click", () => togglePanel("panelSessions", true));
  if (btnCloseSessions) btnCloseSessions.addEventListener("click", () => togglePanel("panelSessions", false));

  // tools panel
  const btnTools = $("btnTools");
  const btnCloseTools = $("btnCloseTools");
  if (btnTools) btnTools.addEventListener("click", () => togglePanel("panelTools", true));
  if (btnCloseTools) btnCloseTools.addEventListener("click", () => togglePanel("panelTools", false));

  // blackout
  const btnBlackout = $("btnBlackout");
  const blackout = $("blackout");
  if (btnBlackout && blackout) {
    btnBlackout.addEventListener("click", () => {
      blackout.classList.toggle("hidden");
      blackout.setAttribute("aria-hidden", blackout.classList.contains("hidden") ? "true" : "false");
    });
    blackout.addEventListener("click", () => blackout.classList.add("hidden"));
  }

  // clear chat
  const btnClearChat = $("btnClearChat");
  if (btnClearChat) {
    btnClearChat.addEventListener("click", () => {
      const chat = $("chat");
      if (chat) chat.innerHTML = "";
      sys("Chat cleared.");
    });
  }

  // initial message
  sys("HUD: ready (type ping + tap Send)");
}

document.addEventListener("DOMContentLoaded", setupUI);