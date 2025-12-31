// hud.js (drop-in, self-debugging, auto-wires)
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// ---------- helpers ----------
const byId = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

function ensureDebugBox() {
  // Prefer existing #out if you have it
  let out = byId("out");
  if (out) return out;

  // Otherwise create a small debug/status line at bottom
  out = document.createElement("div");
  out.id = "out";
  out.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:12px;" +
    "padding:10px 12px;border-radius:12px;" +
    "background:rgba(0,0,0,.55);border:1px solid rgba(69,214,255,.25);" +
    "color:#cfe7ff;font:12px/1.3 system-ui;z-index:9999;" +
    "backdrop-filter: blur(6px);";
  out.textContent = "HUD: loaded";
  document.body.appendChild(out);
  return out;
}

function setStatus(msg) {
  const out = ensureDebugBox();
  out.textContent = msg;
}

function findPromptInput() {
  // Try your expected IDs first
  return (
    byId("prompt") ||
    byId("input") ||
    byId("msg") ||
    qs("textarea") ||
    qs('input[type="text"]') ||
    qs('input:not([type="hidden"]):not([type="email"]):not([type="password"])')
  );
}

function findSendButton() {
  // Try your expected IDs first
  return (
    byId("sendBtn") ||
    byId("send") ||
    byId("btnSend") ||
    qs('[data-action="send"]') ||
    qs("button")
  );
}

function findLogContainer() {
  return byId("log") || qs('[data-role="chatlog"]') || qs(".log") || qs(".chat") || null;
}

function appendChat(role, text) {
  const log = findLogContainer();
  if (!log) {
    // No log container? Still show status so you can see it’s firing
    setStatus(`HUD: ${role}: ${String(text).slice(0, 120)}`);
    return;
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble " + role;
  bubble.textContent = text;

  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

async function postJSON(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },

    // Cloudflare Access cookie support (safe even if not needed)
    credentials: "include",
    mode: "cors",

    body: JSON.stringify(body),
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: res.ok, status: res.status, data };
}

// ---------- main ----------
async function sendPrompt() {
  const input = findPromptInput();
  if (!input) {
    setStatus("HUD ERROR: can't find input. Add id='prompt' to your input/textarea.");
    return;
  }

  const prompt = (input.value || "").trim();
  if (!prompt) {
    setStatus("HUD: type something first");
    return;
  }

  appendChat("user", prompt);
  input.value = "";
  setStatus("HUD: sending…");

  try {
    const r = await postJSON("/query", { prompt, user_id: "web" });

    if (!r.ok) {
      setStatus(`HUD: Error ${r.status}: ${JSON.stringify(r.data)}`);
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    appendChat("arc", reply);
    setStatus("HUD: ok");
  } catch (e) {
    setStatus(`HUD: NETWORK ERROR: ${String(e)}`);
  }
}

function wireUp() {
  setStatus("HUD: wiring…");

  const btn = findSendButton();
  const input = findPromptInput();

  if (!btn) setStatus("HUD WARN: can't find send button. Add id='sendBtn' to your button.");
  else {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      sendPrompt();
    });
  }

  // Enter to send (textarea: Enter sends, Shift+Enter newline)
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  }

  // If there is a form, also hook submit
  const form = btn?.closest("form") || input?.closest("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendPrompt();
    });
  }

  setStatus("HUD: ready (type ping + tap Send)");
}

document.addEventListener("DOMContentLoaded", wireUp);