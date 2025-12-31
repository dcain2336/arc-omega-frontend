// hud.js (DROP-IN)
// Uses Cloudflare Worker as the single API entrypoint.
// No x-arc-key header (Cloudflare Access is your current gate).

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

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

  try {
    // Worker expects { prompt, user_id }
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
  } catch (e) {
    setStatus(`NETWORK ERROR: ${String(e)}`);
  }
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