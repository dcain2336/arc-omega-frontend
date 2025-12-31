// hud.js (works with YOUR index.html IDs)
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

function logSys(msg) {
  const el = $("sysLog");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function addMsg(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + role;

  // Simple bubble (no dependency on old CSS class names)
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function postQuery(prompt, user_id = "web") {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id }),
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

  return { ok: res.ok, status: res.status, data };
}

async function sendPrompt() {
  const input = $("prompt");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  addMsg("user", prompt);
  input.value = "";

  logSys("Sending…");

  try {
    const r = await postQuery(prompt, "web");

    if (!r.ok) {
      addMsg("error", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      logSys(`Error ${r.status}`);
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addMsg("arc", reply);
    logSys("OK");
  } catch (e) {
    addMsg("error", `NETWORK ERROR: ${String(e)}`);
    logSys(`NETWORK ERROR: ${String(e)}`);
  }
}

async function testApi() {
  try {
    const res = await fetch(`${API_BASE}/test`);
    const txt = await res.text();
    logSys(`/test -> ${res.status}`);
    addMsg("arc", txt);
  } catch (e) {
    logSys(`Test failed: ${String(e)}`);
  }
}

// Panels + UI controls
function wirePanels() {
  const btnSessions = $("btnSessions");
  const panelSessions = $("panelSessions");
  const btnCloseSessions = $("btnCloseSessions");

  const btnTools = $("btnTools");
  const panelTools = $("panelTools");
  const btnCloseTools = $("btnCloseTools");

  const btnBlackout = $("btnBlackout");
  const blackout = $("blackout");

  function toggle(el) {
    if (!el) return;
    el.classList.toggle("hidden");
  }

  if (btnSessions && panelSessions) btnSessions.onclick = () => toggle(panelSessions);
  if (btnCloseSessions && panelSessions) btnCloseSessions.onclick = () => panelSessions.classList.add("hidden");

  if (btnTools && panelTools) btnTools.onclick = () => toggle(panelTools);
  if (btnCloseTools && panelTools) btnCloseTools.onclick = () => panelTools.classList.add("hidden");

  if (btnBlackout && blackout) btnBlackout.onclick = () => toggle(blackout);

  // Tool placeholders
  const w = $("btnToolWeather");
  const n = $("btnToolNews");
  const m = $("btnToolMarkets");
  const t = $("btnToolWorldTime");
  if (w) w.onclick = () => logSys("Weather tool (mock)");
  if (n) n.onclick = () => logSys("News tool (mock)");
  if (m) m.onclick = () => logSys("Markets tool (mock)");
  if (t) t.onclick = () => logSys("World Time tool (mock)");

  const clear = $("btnClearChat");
  if (clear) clear.onclick = () => { const c = $("chat"); if (c) c.innerHTML = ""; logSys("Chat cleared"); };
}

function setMeta() {
  const mf = $("metaFrontend");
  const ma = $("metaApi");
  const mh = $("metaHf");
  if (mf) mf.textContent = window.location.host;
  if (ma) ma.textContent = API_BASE;
  if (mh) mh.textContent = "via Worker (Render/HF failover)";
}

document.addEventListener("DOMContentLoaded", () => {
  setMeta();
  wirePanels();

  // Send wiring (THIS is what was broken for you earlier)
  const btnSend = $("send");
  const input = $("prompt");

  if (btnSend) btnSend.onclick = sendPrompt;

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  }

  // System buttons
  const btnPing = $("btnPing");
  const btnTest = $("btnTest");
  if (btnPing) btnPing.onclick = () => { $("prompt").value = "ping"; sendPrompt(); };
  if (btnTest) btnTest.onclick = testApi;

  logSys("HUD: ready (type ping + tap Send)");
});