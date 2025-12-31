// hud.js (DROP-IN for YOUR index.html)

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const el = (id) => document.getElementById(id);

function logSys(line) {
  const box = el("sysLog");
  if (!box) return;
  const p = document.createElement("div");
  p.textContent = line;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

function setMeta() {
  const f = el("metaFrontend");
  const a = el("metaApi");
  const h = el("metaHf");
  if (f) f.textContent = window.location.host || window.location.href;
  if (a) a.textContent = API_BASE;
  if (h) h.textContent = "via Worker (HF/Render failover)";
}

function addMsg(role, text) {
  const chat = el("chat");
  if (!chat) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + role;

  // Minimal inline styling in case CSS classes are missing
  wrap.style.margin = "10px 0";
  wrap.style.padding = "12px 14px";
  wrap.style.borderRadius = "14px";
  wrap.style.border = "1px solid rgba(80,220,255,.18)";
  wrap.style.background = "rgba(10,20,30,.55)";
  wrap.style.whiteSpace = "pre-wrap";

  // Slight distinction
  if (role === "user") {
    wrap.style.borderColor = "rgba(80,220,255,.25)";
    wrap.style.background = "rgba(10,25,40,.55)";
  } else if (role === "arc") {
    wrap.style.borderColor = "rgba(80,220,255,.18)";
    wrap.style.background = "rgba(10,20,30,.55)";
  } else {
    wrap.style.borderColor = "rgba(255,120,120,.25)";
    wrap.style.background = "rgba(40,10,10,.35)";
  }

  const tag = document.createElement("div");
  tag.textContent = role.toUpperCase();
  tag.style.fontSize = "11px";
  tag.style.opacity = "0.7";
  tag.style.letterSpacing = "0.18em";
  tag.style.marginBottom = "6px";

  const body = document.createElement("div");
  body.textContent = text;

  wrap.appendChild(tag);
  wrap.appendChild(body);

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function postJSON(path, body) {
  // Cloudflare Access: send cookies
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    mode: "cors",
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  return { ok: res.ok, status: res.status, data };
}

async function getJSON(path) {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    credentials: "include",
    mode: "cors",
  });

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  return { ok: res.ok, status: res.status, data };
}

async function sendPrompt(promptOverride = null) {
  const input = el("prompt");
  if (!input) {
    logSys("ERROR: #prompt not found");
    return;
  }

  const prompt = (promptOverride ?? input.value ?? "").trim();
  if (!prompt) return;

  addMsg("user", prompt);
  if (!promptOverride) input.value = "";

  logSys("sending /query ...");

  try {
    const r = await postJSON("/query", { prompt, user_id: "web" });

    if (!r.ok) {
      logSys(`HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      addMsg("error", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addMsg("arc", reply);
    logSys("ok");
  } catch (e) {
    // This is your "TypeError: Load failed"
    logSys(`NETWORK ERROR: ${e?.name || "Error"}: ${e?.message || e}`);
    addMsg("error", `NETWORK ERROR:\n${e?.name || "Error"}: ${e?.message || e}`);
  }
}

async function ping() {
  return sendPrompt("ping");
}

async function testAPI() {
  logSys("testing /test ...");
  try {
    const r = await getJSON("/test");
    if (!r.ok) {
      logSys(`HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      addMsg("error", `Test failed ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      return;
    }
    logSys("test ok");
    addMsg("arc", `Test OK:\n${JSON.stringify(r.data, null, 2)}`);
  } catch (e) {
    logSys(`NETWORK ERROR: ${e?.message || e}`);
    addMsg("error", `NETWORK ERROR:\n${e?.message || e}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setMeta();

  const btnSend = el("send");
  const input = el("prompt");
  const btnPing = el("btnPing");
  const btnTest = el("btnTest");

  // Prevent overlay/toast from blocking taps if your CSS uses one
  const possibleOverlays = ["out", "status", "toast", "hudToast", "hudStatus"];
  for (const id of possibleOverlays) {
    const node = el(id);
    if (node) node.style.pointerEvents = "none";
  }

  if (btnSend) {
    btnSend.addEventListener("click", (e) => {
      e.preventDefault();
      sendPrompt();
    });
  } else {
    logSys("WARN: #send button not found");
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });
  } else {
    logSys("WARN: #prompt input not found");
  }

  if (btnPing) btnPing.addEventListener("click", (e) => { e.preventDefault(); ping(); });
  if (btnTest) btnTest.addEventListener("click", (e) => { e.preventDefault(); testAPI(); });

  logSys("HUD ready");
});