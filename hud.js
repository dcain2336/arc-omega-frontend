// hud.js (DROP-IN)
// No x-arc-key. Uses Cloudflare Access (cookies) instead.

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);

function findEl() {
  // Chat log container
  const log =
    $("#log") ||
    $("#chatLog") ||
    $("#hudLog") ||
    $('[data-role="log"]');

  // Prompt input (textarea or input)
  const prompt =
    $("#prompt") ||
    $("#promptInput") ||
    $("#promptBox") ||
    $('textarea[name="prompt"]') ||
    $('input[name="prompt"]') ||
    $('[data-role="prompt"]') ||
    $("textarea") ||
    $('input[type="text"]');

  // Send button
  const sendBtn =
    $("#sendBtn") ||
    $("#send") ||
    $("#btnSend") ||
    $('[data-action="send"]') ||
    $('button[type="submit"]') ||
    $("button");

  // Status/toast output
  const status =
    $("#out") ||
    $("#status") ||
    $("#hudStatus") ||
    $("#toast") ||
    $("#hudToast") ||
    $('[data-role="status"]');

  // Optional system buttons
  const pingBtn =
    $("#pingBtn") ||
    $('[data-action="ping"]') ||
    $("#btnPing");

  const testBtn =
    $("#testApiBtn") ||
    $('[data-action="test-api"]') ||
    $("#btnTestApi");

  return { log, prompt, sendBtn, status, pingBtn, testBtn };
}

function setStatus(text) {
  const { status } = findEl();
  if (!status) return;

  // If it's a toast-like bar, update it
  status.textContent = text;

  // Prevent it from blocking taps if it's overlaying the input
  try {
    status.style.pointerEvents = "none";
  } catch {}
}

function appendChat(role, text) {
  const { log } = findEl();
  if (!log) return;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  log.appendChild(bubble);

  // scroll to bottom
  try {
    log.scrollTop = log.scrollHeight;
  } catch {}
}

async function postJSON(path, body) {
  // IMPORTANT for Cloudflare Access:
  // - credentials: "include" sends CF Access cookies
  // - if your Worker CORS is mis-set (Allow-Origin:* + Allow-Credentials:true), Safari will throw TypeError: Load failed
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    mode: "cors",
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: res.ok, status: res.status, data };
}

async function getJSON(path) {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    credentials: "include",
    mode: "cors",
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: res.ok, status: res.status, data };
}

// ---------- actions ----------
async function sendPrompt(promptOverride = null) {
  const { prompt } = findEl();
  if (!prompt) {
    setStatus("HUD: can't find prompt input (missing #prompt?)");
    return;
  }

  const text = (promptOverride ?? prompt.value ?? "").trim();
  if (!text) return;

  appendChat("user", text);

  if (!promptOverride) prompt.value = "";
  setStatus("HUD: (sending...)");

  try {
    const r = await postJSON("/query", { prompt: text, user_id: "web" });

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
    setStatus("HUD: (ok)");
  } catch (e) {
    setStatus(`HUD: NETWORK ERROR: ${e?.name || "Error"}: ${e?.message || e}`);
  }
}

async function testAPI() {
  setStatus("HUD: (testing API...)");
  try {
    const r = await getJSON("/test");
    if (!r.ok) {
      setStatus(`HUD: /test failed ${r.status}: ${JSON.stringify(r.data)}`);
      return;
    }
    setStatus(`HUD: /test OK: ${JSON.stringify(r.data)}`);
  } catch (e) {
    setStatus(`HUD: /test NETWORK ERROR: ${e?.message || e}`);
  }
}

// ---------- wiring ----------
document.addEventListener("DOMContentLoaded", () => {
  const { sendBtn, prompt, pingBtn, testBtn } = findEl();

  // Send button
  if (sendBtn) {
    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendPrompt();
    });
  }

  // Enter to send (Shift+Enter for newline)
  if (prompt) {
    prompt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  }

  // Optional Ping button
  if (pingBtn) {
    pingBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendPrompt("ping");
    });
  }

  // Optional Test API button
  if (testBtn) {
    testBtn.addEventListener("click", (e) => {
      e.preventDefault();
      testAPI();
    });
  }

  setStatus("HUD: ready (type ping + tap Send)");
});