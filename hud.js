// ===========================
// ARC OMEGA - Phase 1 HUD JS
// ===========================

// ✅ Your worker API (the only thing frontend talks to)
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// UI refs
const chatEl = document.getElementById("chat");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const sysLog = document.getElementById("sysLog");

const metaFrontend = document.getElementById("metaFrontend");
const metaApi = document.getElementById("metaApi");
const metaHf = document.getElementById("metaHf");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const arcState = document.getElementById("arcState");
const arcOrb = document.getElementById("arcOrb");

const blackout = document.getElementById("blackout");
const btnBlackout = document.getElementById("btnBlackout");

const panelTools = document.getElementById("panelTools");
const panelSessions = document.getElementById("panelSessions");
const btnTools = document.getElementById("btnTools");
const btnSessions = document.getElementById("btnSessions");
const btnCloseTools = document.getElementById("btnCloseTools");
const btnCloseSessions = document.getElementById("btnCloseSessions");

const btnPing = document.getElementById("btnPing");
const btnTest = document.getElementById("btnTest");

const tickerWeather = document.getElementById("tickerWeather");
const tickerNews = document.getElementById("tickerNews");
const tickerMarkets = document.getElementById("tickerMarkets");
const tickerTime = document.getElementById("tickerTime");

const sessionList = document.getElementById("sessionList");
const btnNewSession = document.getElementById("btnNewSession");
const btnClearChat = document.getElementById("btnClearChat");

// Tools buttons (mock for now)
document.getElementById("btnToolWeather").onclick = () => pushSys("Tools: Weather (mock).");
document.getElementById("btnToolNews").onclick = () => pushSys("Tools: News (mock).");
document.getElementById("btnToolStocks").onclick = () => pushSys("Tools: Markets (mock).");
document.getElementById("btnToolWorldTime").onclick = () => pushSys("Tools: World Time (mock).");

// Session state (local-only for Phase 1)
let sessions = [];
let activeSessionId = null;

// ---------- Helpers ----------
function setStatus(mode, text){
  statusText.textContent = text || mode;
  arcState.textContent = text || mode;

  // dot colors
  if (mode === "THINKING"){
    statusDot.style.background = "#45d6ff";
    statusDot.style.boxShadow = "0 0 12px rgba(0,229,255,.35)";
    arcOrb.classList.add("thinking");
  } else if (mode === "ERROR"){
    statusDot.style.background = "#ff4d6d";
    statusDot.style.boxShadow = "0 0 12px rgba(255,77,109,.35)";
    arcOrb.classList.remove("thinking");
  } else {
    statusDot.style.background = "#26ff7a";
    statusDot.style.boxShadow = "0 0 12px rgba(38,255,122,.25)";
    arcOrb.classList.remove("thinking");
  }
}

function addMsg(who, text, kind){
  const wrap = document.createElement("div");
  wrap.className = "msg " + (kind || "");
  wrap.innerHTML = `
    <div class="who">${who}</div>
    <div class="text"></div>
  `;
  wrap.querySelector(".text").textContent = text;
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function pushSys(line){
  const t = new Date().toLocaleTimeString();
  sysLog.textContent = `[${t}] ${line}\n` + (sysLog.textContent || "");
}

async function httpGet(path){
  const r = await fetch(API_BASE + path, { method: "GET" });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: r.ok, status: r.status, data };
}

async function httpPost(path, body){
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: r.ok, status: r.status, data };
}

// ---------- Sessions (Phase 1 local-only) ----------
function newSession(){
  const id = "s_" + Math.random().toString(16).slice(2);
  const label = "Session " + (sessions.length + 1);
  const s = { id, label, created: Date.now() };
  sessions.unshift(s);
  activeSessionId = id;
  renderSessions();
  addMsg("SYSTEM", `Loaded ${label}`, "ok");
}

function renderSessions(){
  sessionList.innerHTML = "";
  sessions.forEach(s => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = (s.id === activeSessionId ? "• " : "") + s.label;
    item.onclick = () => {
      activeSessionId = s.id;
      renderSessions();
      addMsg("SYSTEM", `Switched to ${s.label} (Phase 1: chat not persisted yet)`, "ok");
      closePanels();
    };
    sessionList.appendChild(item);
  });
}

// ---------- Panels ----------
function closePanels(){
  panelTools.classList.add("hidden");
  panelTools.setAttribute("aria-hidden","true");
  panelSessions.classList.add("hidden");
  panelSessions.setAttribute("aria-hidden","true");
}

btnTools.onclick = () => {
  panelTools.classList.toggle("hidden");
  panelTools.setAttribute("aria-hidden", panelTools.classList.contains("hidden") ? "true" : "false");
};
btnSessions.onclick = () => {
  panelSessions.classList.toggle("hidden");
  panelSessions.setAttribute("aria-hidden", panelSessions.classList.contains("hidden") ? "true" : "false");
};
btnCloseTools.onclick = closePanels;
btnCloseSessions.onclick = closePanels;

// Close panels if you tap outside (mobile friendly)
document.addEventListener("click", (e) => {
  const isPanelClick = panelTools.contains(e.target) || panelSessions.contains(e.target);
  const isButtonClick = e.target === btnTools || e.target === btnSessions;
  if (!isPanelClick && !isButtonClick){
    // don't force-close always; just close if open
    if (!panelTools.classList.contains("hidden") || !panelSessions.classList.contains("hidden")){
      closePanels();
    }
  }
});

// ---------- Blackout ----------
btnBlackout.onclick = () => {
  blackout.classList.toggle("hidden");
  blackout.setAttribute("aria-hidden", blackout.classList.contains("hidden") ? "true" : "false");
};

// Tap blackout to exit (you can remove this later if you want it “all clear” only)
blackout.onclick = () => {
  blackout.classList.add("hidden");
  blackout.setAttribute("aria-hidden","true");
};

// ---------- Composer autosize ----------
function autosize(){
  promptEl.style.height = "auto";
  promptEl.style.height = Math.min(promptEl.scrollHeight, 160) + "px";
}
promptEl.addEventListener("input", autosize);

// Send on Enter (without shift)
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    send();
  }
});

// ---------- API actions ----------
async function refreshMeta(){
  metaFrontend.textContent = location.host;
  metaApi.textContent = API_BASE;

  // Best-effort: ask Worker who the HF space is
  const t = await httpGet("/test");
  if (t.ok){
    metaHf.textContent = t.data.hf_space || "(unknown)";
  } else {
    metaHf.textContent = "(test failed)";
  }
}

async function send(){
  const prompt = (promptEl.value || "").trim();
  if (!prompt) return;

  setStatus("THINKING", "THINKING");
  sendBtn.disabled = true;
  promptEl.disabled = true;

  addMsg("ADMIN", prompt, "admin");
  promptEl.value = "";
  autosize();

  try{
    const res = await httpPost("/query", {
      prompt,
      user_id: activeSessionId || "default_session"
    });

    if (!res.ok){
      setStatus("ERROR", "ERROR");
      addMsg("ERROR", `HTTP ${res.status}\n${JSON.stringify(res.data, null, 2)}`, "err");
      pushSys(`Query failed: HTTP ${res.status}`);
      return;
    }

    // expected shape from your backend:
    // { response: "...", provider: "...", timestamp: ... }
    const out = res.data.response ?? JSON.stringify(res.data, null, 2);
    addMsg("ARC", out, "arc");
    setStatus("ONLINE", "ONLINE");
    pushSys("Query OK.");
  } catch (e){
    setStatus("ERROR", "ERROR");
    addMsg("ERROR", `NETWORK ERROR\n${String(e)}`, "err");
    pushSys("Network error during /query.");
  } finally {
    sendBtn.disabled = false;
    promptEl.disabled = false;
    promptEl.focus();
  }
}

// ---------- Buttons ----------
sendBtn.onclick = send;

btnPing.onclick = async () => {
  addMsg("ADMIN", "ping", "admin");
  setStatus("THINKING", "THINKING");
  try{
    const res = await httpPost("/query", { prompt:"ping", user_id: activeSessionId || "default_session" });
    if (res.ok){
      addMsg("ARC", res.data.response ?? JSON.stringify(res.data, null, 2), "arc");
      setStatus("ONLINE", "ONLINE");
      pushSys("Ping OK.");
    } else {
      setStatus("ERROR", "ERROR");
      addMsg("ERROR", `HTTP ${res.status}\n${JSON.stringify(res.data, null, 2)}`, "err");
      pushSys("Ping failed.");
    }
  } catch(e){
    setStatus("ERROR", "ERROR");
    addMsg("ERROR", `NETWORK ERROR\n${String(e)}`, "err");
    pushSys("Ping network error.");
  }
};

btnTest.onclick = async () => {
  setStatus("THINKING", "THINKING");
  const t = await httpGet("/test");
  if (t.ok){
    addMsg("SYSTEM", JSON.stringify(t.data, null, 2), "ok");
    pushSys("GET /test OK.");
    metaHf.textContent = t.data.hf_space || "(unknown)";
    setStatus("ONLINE", "ONLINE");
  } else {
    addMsg("ERROR", `GET /test failed (HTTP ${t.status})\n${JSON.stringify(t.data, null, 2)}`, "err");
    pushSys("GET /test failed.");
    setStatus("ERROR", "ERROR");
  }
};

btnNewSession.onclick = () => {
  newSession();
  closePanels();
};

btnClearChat.onclick = () => {
  chatEl.innerHTML = "";
  addMsg("SYSTEM", "Chat cleared (view only).", "ok");
  closePanels();
};

// ---------- Mock tickers (Phase 1 placeholders) ----------
function seedTickers(){
  tickerWeather.textContent = "Clear · 72°F · Wind 6mph (mock)";
  tickerNews.textContent = "Headlines ready (mock ticker)";
  tickerMarkets.textContent = "BTC +0.0% · SPY +0.0% (mock)";
  tickerTime.textContent = "UTC — · Local — (mock)";
}

// ---------- Boot ----------
(function init(){
  seedTickers();

  // create first session
  sessions = [];
  newSession();

  refreshMeta().catch(()=>{});
  setStatus("ONLINE", "ONLINE");

  addMsg("SYSTEM", "Phase 1 Command Center online. Backend stable. UI layout locked.", "ok");
})();