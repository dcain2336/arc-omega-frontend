// hud.js (Phase 1: working chat + reactor states + panels + blackout)
// Frontend talks ONLY to your Cloudflare Worker.
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function nowEpoch() { return Date.now(); }

// ---------- UI Elements ----------
const chatFeed = $("chatFeed");
const chatBox  = $("chatBox");
const btnSend  = $("btnSend");

const statusDot  = $("statusDot");
const statusText = $("statusText");
const modePill   = $("modePill");
const pulseState = $("pulseState");

const reactorSvg = document.querySelector("svg.reactor");

const backdrop   = $("backdrop");
const sidemenu   = $("sidemenu");
const toolspanel = $("toolspanel");

const btnMenu       = $("btnMenu");
const btnCloseMenu  = $("btnCloseMenu");
const btnTools      = $("btnTools");
const btnCloseTools = $("btnCloseTools");

const blackout   = $("blackout");
const btnBlackout = $("btnBlackout");
const btnAllClear = $("btnAllClear");

// ---------- Reactor State ----------
const ARC_STATE = {
  IDLE:   { name: "BLUE",  dot: "rgba(0,229,255,.85)", pill: "BLUE" },
  THINK:  { name: "CYAN",  dot: "rgba(0,229,255,.95)", pill: "CYAN" },
  DONE:   { name: "GREEN", dot: "rgba(46,255,165,.90)", pill: "GREEN" },
  WARN:   { name: "ORANGE",dot: "rgba(255,170,65,.92)", pill: "ORANGE" },
  ERROR:  { name: "RED",   dot: "rgba(255,59,59,.90)", pill: "RED" },
};

function setArcState(key) {
  const s = ARC_STATE[key] || ARC_STATE.IDLE;
  if (statusDot) statusDot.style.background = s.dot;
  if (modePill)  modePill.textContent = s.pill;
  if (pulseState) pulseState.textContent = key;

  // Pulse animation only while THINK
  if (reactorSvg) {
    if (key === "THINK") reactorSvg.classList.add("reactorPulse");
    else reactorSvg.classList.remove("reactorPulse");
  }
}

// ---------- Panels ----------
function closePanels() {
  sidemenu?.classList.remove("open");
  toolspanel?.classList.remove("open");
  backdrop?.classList.remove("show");
  sidemenu?.setAttribute("aria-hidden", "true");
  toolspanel?.setAttribute("aria-hidden", "true");
  backdrop?.setAttribute("aria-hidden", "true");
}

function openLeftPanel() {
  closePanels();
  sidemenu?.classList.add("open");
  backdrop?.classList.add("show");
  sidemenu?.setAttribute("aria-hidden", "false");
  backdrop?.setAttribute("aria-hidden", "false");
}

function openRightPanel() {
  closePanels();
  toolspanel?.classList.add("open");
  backdrop?.classList.add("show");
  toolspanel?.setAttribute("aria-hidden", "false");
  backdrop?.setAttribute("aria-hidden", "false");
}

backdrop?.addEventListener("click", closePanels);
btnMenu?.addEventListener("click", openLeftPanel);
btnCloseMenu?.addEventListener("click", closePanels);
btnTools?.addEventListener("click", openRightPanel);
btnCloseTools?.addEventListener("click", closePanels);

// ---------- Blackout ----------
btnBlackout?.addEventListener("click", () => {
  blackout?.classList.add("show");
  blackout?.setAttribute("aria-hidden", "false");
});
btnAllClear?.addEventListener("click", () => {
  blackout?.classList.remove("show");
  blackout?.setAttribute("aria-hidden", "true");
});

// ---------- Chat Rendering ----------
function addMessage(role, text) {
  if (!chatFeed) return;

  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "msg--user" : "msg--arc"}`;

  const meta = document.createElement("div");
  meta.className = "msg__meta mono";
  meta.textContent = role === "user" ? "ADMIN" : "ARC";

  const body = document.createElement("div");
  body.className = "msg__body";
  body.textContent = text;

  wrap.appendChild(meta);
  wrap.appendChild(body);
  chatFeed.appendChild(wrap);

  // scroll to bottom
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function lockSend(lock) {
  if (btnSend) btnSend.disabled = !!lock;
  if (chatBox) chatBox.disabled = !!lock;
}

// ---------- API ----------
async function postJSON(path, payload) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let data = {};
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

  return { ok: res.ok, status: res.status, data };
}

// ---------- Send Flow ----------
async function sendPrompt() {
  const text = (chatBox?.value || "").trim();
  if (!text) return;

  addMessage("user", text);
  chatBox.value = "";

  setText("statusText", "ARC: THINKING");
  setArcState("THINK");
  lockSend(true);

  try {
    const started = nowEpoch();

    // minimal payload; backend can ignore extras
    const r = await postJSON("/query", { prompt: text });

    if (!r.ok) {
      setArcState("ERROR");
      setText("statusText", `ARC: ERROR (${r.status})`);
      addMessage("arc", r.data?.detail || r.data?.error || "Request failed.");
      return;
    }

    const reply = r.data?.response || r.data?.answer || r.data?.raw || "(no response)";
    addMessage("arc", reply);

    // small “completed” state
    setArcState("DONE");
    setText("statusText", `ARC: ONLINE (${Math.max(1, Math.round((nowEpoch() - started)/1000))}s)`);
    setTimeout(() => setArcState("IDLE"), 900);

  } catch (e) {
    setArcState("ERROR");
    setText("statusText", "ARC: NETWORK ERROR");
    addMessage("arc", "Network error talking to the API.");
  } finally {
    lockSend(false);
    chatBox?.focus();
  }
}

// enter-to-send
chatBox?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});
btnSend?.addEventListener("click", sendPrompt);

// ---------- Tickers (Phase 1 basic clock) ----------
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtTZ(tz){
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const hh = parts.find(p=>p.type==="hour")?.value || "00";
  const mm = parts.find(p=>p.type==="minute")?.value || "00";
  return `${hh}:${mm}`;
}

function tick() {
  const str =
    `NYC ${fmtTZ("America/New_York")} | ` +
    `CHI ${fmtTZ("America/Chicago")} | ` +
    `DEN ${fmtTZ("America/Denver")} | ` +
    `LAX ${fmtTZ("America/Los_Angeles")} | ` +
    `UTC ${fmtTZ("UTC")} | ` +
    `OKI ${fmtTZ("Asia/Tokyo")} | ` +   // Okinawa uses Japan time
    `KOR ${fmtTZ("Asia/Seoul")} | ` +
    `PHI ${fmtTZ("Asia/Manila")}`;
  setText("tickerTime", str);
}
setInterval(tick, 1000 * 10);
tick();

// Initial state
setArcState("IDLE");
setText("statusText", "ARC: ONLINE");