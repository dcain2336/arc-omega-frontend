// hud.js (drop-in for your current index.html)

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const $ = (id) => document.getElementById(id);

// --------- UI helpers ----------
function addMsg(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + role;

  const tag = document.createElement("div");
  tag.className = "msg-tag";
  tag.textContent = role.toUpperCase();

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text;

  wrap.appendChild(tag);
  wrap.appendChild(body);
  chat.appendChild(wrap);

  chat.scrollTop = chat.scrollHeight;
}

function sysLog(line) {
  const box = $("sysLog");
  if (!box) return;
  const div = document.createElement("div");
  div.className = "sys-line";
  div.textContent = line;
  box.prepend(div);
}

function setMeta() {
  const host = location.host;
  if ($("metaFrontend")) $("metaFrontend").textContent = host || "—";
  if ($("metaApi")) $("metaApi").textContent = API_BASE;
  if ($("metaHf")) $("metaHf").textContent = "via Worker (Render/HF failover)";
}

// --------- API calls ----------
async function postQuery(prompt, user_id = "web") {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id }),
  });

  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

async function getTest() {
  const res = await fetch(`${API_BASE}/test`, { method: "GET" });
  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  return { ok: res.ok, status: res.status, data };
}

// --------- Send flow ----------
async function sendPrompt() {
  const input = $("prompt");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  addMsg("user", prompt);
  input.value = "";
  input.style.height = "auto";

  sysLog("Sending /query …");

  try {
    const r = await postQuery(prompt, "web");

    if (!r.ok) {
      addMsg("error", `Error ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
      sysLog(`Error ${r.status}`);
      return;
    }

    const upstream = r.headers.get("X-ARC-Upstream") || "unknown";
    const reply =
      r.data?.response ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addMsg("arc", reply);
    sysLog(`OK (upstream: ${upstream})`);
  } catch (e) {
    addMsg("error", `NETWORK ERROR: ${String(e)}`);
    sysLog(`NETWORK ERROR: ${String(e)}`);
  }
}

// --------- Panels / toggles ----------
function togglePanel(panelId, show) {
  const p = $(panelId);
  if (!p) return;
  p.classList.toggle("hidden", !show);
  p.setAttribute("aria-hidden", show ? "false" : "true");
}

function toggleBlackout() {
  const b = $("blackout");
  if (!b) return;
  b.classList.toggle("hidden");
}

// --------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setMeta();

  // Send button
  const sendBtn = $("send");
  if (sendBtn) sendBtn.addEventListener("click", sendPrompt);

  // Enter key (mobile friendly)
  const input = $("prompt");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });

    // auto-grow textarea
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    });
  }

  // System buttons
  const btnPing = $("btnPing");
  if (btnPing) btnPing.addEventListener("click", () => {
    $("prompt").value = "ping";
    sendPrompt();
  });

  const btnTest = $("btnTest");
  if (btnTest) {
    btnTest.addEventListener("click", async () => {
      sysLog("Fetching /test …");
      try {
        const r = await getTest();
        if (!r.ok) {
          addMsg("error", `Test failed: ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
          return;
        }
        addMsg("arc", `Worker test:\n${JSON.stringify(r.data, null, 2)}`);
      } catch (e) {
        addMsg("error", `NETWORK ERROR: ${String(e)}`);
      }
    });
  }

  // Left panel
  const btnSessions = $("btnSessions");
  const btnCloseSessions = $("btnCloseSessions");
  if (btnSessions) btnSessions.addEventListener("click", () => togglePanel("panelSessions", true));
  if (btnCloseSessions) btnCloseSessions.addEventListener("click", () => togglePanel("panelSessions", false));

  // Right panel
  const btnTools = $("btnTools");
  const btnCloseTools = $("btnCloseTools");
  if (btnTools) btnTools.addEventListener("click", () => togglePanel("panelTools", true));
  if (btnCloseTools) btnCloseTools.addEventListener("click", () => togglePanel("panelTools", false));

  // Blackout
  const btnBlackout = $("btnBlackout");
  if (btnBlackout) btnBlackout.addEventListener("click", toggleBlackout);

  sysLog("HUD ready.");
});