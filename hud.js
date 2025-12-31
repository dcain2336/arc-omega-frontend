// hud.js
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// IMPORTANT: must match Worker secret ARC_KEY
const ARC_KEY = "PASTE_THE_SAME_VALUE_YOU_SET_AS_ARC_KEY";

const $ = (id) => document.getElementById(id);

async function postJSON(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-arc-key": ARC_KEY,
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: res.ok, status: res.status, data };
}

function setStatus(text) {
  const out = $("out");
  if (out) out.textContent = text;
}

function appendChat(role, text) {
  const log = $("log");
  if (!log) return;
  const wrap = document.createElement("div");
  wrap.className = "bubble " + role;
  wrap.textContent = text;
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

async function sendPrompt() {
  const input = $("prompt");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  appendChat("user", prompt);
  input.value = "";
  setStatus("(sending...)");

  const r = await postJSON("/query", { prompt, user_id: "web" });

  if (!r.ok) {
    setStatus(`Error ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  const reply =
    r.data?.response ??
    r.data?.text ??
    r.data?.raw ??
    JSON.stringify(r.data);

  appendChat("arc", reply);
  setStatus("(ok)");
}

// Hook button + Enter
document.addEventListener("DOMContentLoaded", () => {
  const btn = $("sendBtn");
  const input = $("prompt");

  if (btn) btn.onclick = sendPrompt;

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  }
});