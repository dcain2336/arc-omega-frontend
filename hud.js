// hud.js — FULL DROP-IN (matches your index.html exactly)

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function setSysLog(text, kind = "") {
  const el = $("sysLog");
  if (!el) return;
  const line = document.createElement("div");
  line.className = "sysline " + kind;
  line.textContent = `[${nowTime()}] ${text}`;
  el.prepend(line);
}

function appendChat(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const wrap = document.createElement("div");
  wrap.className = "bubble " + role;

  const label = document.createElement("div");
  label.className = "bubble-label";
  label.textContent = role.toUpperCase();

  const body = document.createElement("div");
  body.className = "bubble-body";
  body.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(body);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function postJSON(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

  appendChat("user", prompt);
  input.value = "";

  setSysLog(`Sending prompt to Worker: ${API_BASE}/query`);

  const r = await postJSON("/query", { prompt, user_id: "web" });

  if (!r.ok) {
    appendChat("error", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
    setSysLog(`Error ${r.status}`, "err");
    return;
  }

  const reply =
    r.data?.response ??
    r.data?.text ??
    r.data?.raw ??
    JSON.stringify(r.data);

  appendChat("arc", reply);

  const upstream = r.data?.upstream || r.data?.provider || "(see X-ARC-Upstream header)";
  setSysLog(`OK (${r.status}). Reply received.`, "ok");
}

async function ping() {
  // Ping is just a convenience prompt
  $("prompt").value = "ping";
  await sendPrompt();
}

async function testApi() {
  try {
    setSysLog(`GET ${API_BASE}/test`);
    const res = await fetch(API_BASE + "/test", { method: "GET" });
    const txt = await res.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    appendChat("arc", `TEST RESULT\n${JSON.stringify(data, null, 2)}`);
    setSysLog(`Test OK (${res.status})`, "ok");
  } catch (e) {
    appendChat("error", `Test failed: ${String(e)}`);
    setSysLog(`Test failed: ${String(e)}`, "err");
  }
}

function wirePanels() {
  // Left panel (Sessions/Files)
  const panelSessions = $("panelSessions");
  const btnSessions = $("btnSessions");
  const btnCloseSessions = $("btnCloseSessions");

  // Right panel (Tools)
  const panelTools = $("panelTools");
  const btnTools = $("btnTools");
  const btnCloseTools = $("btnCloseTools");

  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }

  if (btnSessions) btnSessions.onclick = () => show(panelSessions);
  if (btnCloseSessions) btnCloseSessions.onclick = () => hide(panelSessions);

  if (btnTools) btnTools.onclick = () => show(panelTools);
  if (btnCloseTools) btnCloseTools.onclick = () => hide(panelTools);

  // Blackout
  const btnBlackout = $("btnBlackout");
  const blackout = $("blackout");
  if (btnBlackout && blackout) {
    btnBlackout.onclick = () => blackout.classList.toggle("hidden");
    blackout.onclick = () => blackout.classList.add("hidden"); // tap to clear
  }

  // Clear chat
  const btnClearChat = $("btnClearChat");
  if (btnClearChat) {
    btnClearChat.onclick = () => {
      const chat = $("chat");
      if (chat) chat.innerHTML = "";
      setSysLog("Chat cleared.");
    };
  }
}

function fillMeta() {
  const front = $("metaFrontend");
  const api = $("metaApi");
  const hf = $("metaHf");

  if (front) front.textContent = location.host;
  if (api) api.textContent = API_BASE;
  if (hf) hf.textContent = "via Worker (Render/HF failover)";
}

document.addEventListener("DOMContentLoaded", () => {
  fillMeta();
  wirePanels();

  const sendBtn = $("send");     // <-- your HTML uses id="send"
  const input = $("prompt");

  if (sendBtn) sendBtn.onclick = sendPrompt;

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

  if (btnPing) btnPing.onclick = ping;
  if (btnTest) btnTest.onclick = testApi;

  setSysLog("HUD ready.");
});