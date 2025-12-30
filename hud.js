// ========= ARC OMEGA PHASE 1 HUD =========
// Frontend (Pages) -> Cloudflare Worker -> Private HF Space

const API_BASE = "https://arc-omega-api.dcain1.workers.dev";
const HF_SPACE = "https://dsc2336-arc-omega-backend.hf.space"; // display only

const el = {
  orb: document.getElementById("orb"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot"),

  chatLog: document.getElementById("chatLog"),
  prompt: document.getElementById("prompt"),
  send: document.getElementById("send"),

  // panels
  leftPanel: document.getElementById("leftPanel"),
  rightPanel: document.getElementById("rightPanel"),
  btnLeft: document.getElementById("btnLeft"),
  btnRight: document.getElementById("btnRight"),
  btnLeftClose: document.getElementById("btnLeftClose"),
  btnRightClose: document.getElementById("btnRightClose"),

  // tools
  btnPing: document.getElementById("btnPing"),
  btnClear: document.getElementById("btnClear"),

  // theme/blackout
  btnTheme: document.getElementById("btnTheme"),
  btnBlackout: document.getElementById("btnBlackout"),
  blackout: document.getElementById("blackout"),

  // labels
  frontLabel: document.getElementById("frontLabel"),
  apiPill: document.getElementById("apiPill"),
  hfPill: document.getElementById("hfPill"),
  apiLabel: document.getElementById("apiLabel"),
  hfLabel: document.getElementById("hfLabel"),
};

const STATE = {
  theme: localStorage.getItem("arc_theme") || "dark",
  // OPTIONAL: if you ever decide to require a key, set it here:
  // localStorage.setItem("arc_key","YOUR_KEY");
  arcKey: localStorage.getItem("arc_key") || "",
  messages: [],
};

function setTheme(theme){
  STATE.theme = theme;
  document.body.classList.toggle("light", theme === "light");
  localStorage.setItem("arc_theme", theme);
}

function setOrb(mode){
  el.orb.classList.remove("orb--idle","orb--thinking","orb--speaking","orb--error");
  if(mode === "thinking") el.orb.classList.add("orb--thinking");
  else if(mode === "speaking") el.orb.classList.add("orb--speaking");
  else if(mode === "error") el.orb.classList.add("orb--error");
  else el.orb.classList.add("orb--idle");
}

function setStatus(text, dot="ok"){
  el.statusText.textContent = text;
  if(dot === "ok"){
    el.statusDot.style.background = "rgba(0,229,255,.85)";
    el.statusDot.style.boxShadow = "0 0 12px rgba(0,229,255,.45)";
  }else if(dot === "warn"){
    el.statusDot.style.background = "rgba(255,210,80,.9)";
    el.statusDot.style.boxShadow = "0 0 12px rgba(255,210,80,.35)";
  }else{
    el.statusDot.style.background = "rgba(255,77,109,.95)";
    el.statusDot.style.boxShadow = "0 0 12px rgba(255,77,109,.35)";
  }
}

function addMessage(role, text){
  STATE.messages.push({ role, text, ts: Date.now() });
  render();
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function render(){
  el.chatLog.innerHTML = "";
  for(const m of STATE.messages){
    const row = document.createElement("div");
    row.className = "msg";

    const badge = document.createElement("div");
    badge.className = "badge " + (m.role === "you" ? "badge--you" : "badge--arc");
    badge.textContent = m.role === "you" ? "YOU" : "ARC";

    const bubble = document.createElement("div");
    bubble.className = "bubble " + (m.role === "you" ? "bubble--you" : "bubble--arc");
    bubble.textContent = m.text;

    row.appendChild(badge);
    row.appendChild(bubble);
    el.chatLog.appendChild(row);
  }
}

async function apiPost(path, body){
  const headers = {
    "Content-Type": "application/json",
  };

  // If your Worker enforces a key later, this will automatically send it.
  if(STATE.arcKey){
    headers["x-arc-key"] = STATE.arcKey;
  }

  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { data = { raw: text }; }

  return { ok: res.ok, status: res.status, data };
}

async function sendPrompt(promptText){
  const prompt = (promptText || "").trim();
  if(!prompt) return;

  addMessage("you", prompt);

  el.send.disabled = true;
  setStatus("THINKING", "warn");
  setOrb("thinking");

  try{
    const r = await apiPost("/query", {
      prompt,
      user_id: "web",
    });

    if(!r.ok){
      setStatus(`ERROR ${r.status}`, "bad");
      setOrb("error");

      const detail =
        r.data?.detail ||
        r.data?.error ||
        (typeof r.data?.raw === "string" ? r.data.raw : "Request failed");

      addMessage("arc", `Error ${r.status}: ${detail}`);
      return;
    }

    // success
    setStatus("ONLINE", "ok");
    setOrb("speaking");

    const reply =
      r.data?.response ??
      r.data?.answer ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addMessage("arc", String(reply));

    // back to idle shortly after
    setTimeout(()=> setOrb("idle"), 650);

  }catch(err){
    setStatus("NETWORK ERROR", "bad");
    setOrb("error");
    addMessage("arc", `Network error: ${err?.message || err}`);
  }finally{
    el.send.disabled = false;
  }
}

/* ===== Panels ===== */
function openPanel(panel){
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden","false");
}
function closePanel(panel){
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden","true");
}

/* ===== Blackout ===== */
function toggleBlackout(){
  const isHidden = el.blackout.classList.contains("hidden");
  el.blackout.classList.toggle("hidden", !isHidden);
  el.blackout.setAttribute("aria-hidden", String(!isHidden));
}

/* ===== Theme ===== */
function toggleTheme(){
  setTheme(STATE.theme === "dark" ? "light" : "dark");
}

/* ===== Wire UI ===== */
setTheme(STATE.theme);
setStatus("ONLINE","ok");
setOrb("idle");

el.frontLabel.textContent = `Frontend: ${location.host}`;
el.apiPill.textContent = `API: ${API_BASE}`;
el.hfPill.textContent = `HF: ${HF_SPACE}`;
el.apiLabel.textContent = API_BASE;
el.hfLabel.textContent = HF_SPACE;

el.btnLeft.onclick = () => openPanel(el.leftPanel);
el.btnRight.onclick = () => openPanel(el.rightPanel);
el.btnLeftClose.onclick = () => closePanel(el.leftPanel);
el.btnRightClose.onclick = () => closePanel(el.rightPanel);

el.btnBlackout.onclick = toggleBlackout;
el.blackout.onclick = toggleBlackout;

el.btnTheme.onclick = toggleTheme;

el.btnPing.onclick = async () => {
  closePanel(el.rightPanel);
  await sendPrompt("ping");
};

el.btnClear.onclick = () => {
  STATE.messages = [];
  render();
  closePanel(el.rightPanel);
};

el.send.onclick = async () => {
  const text = el.prompt.value;
  el.prompt.value = "";
  await sendPrompt(text);
};

// Enter to send (Shift+Enter for newline)
el.prompt.addEventListener("keydown", async (e) => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    const text = el.prompt.value;
    el.prompt.value = "";
    await sendPrompt(text);
  }
});

// First message (optional)
addMessage("arc", "ARC ONLINE.");