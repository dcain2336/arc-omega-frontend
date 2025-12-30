const $ = (id) => document.getElementById(id);

const sidemenu = $("sidemenu");
const toolspanel = $("toolspanel");
const blackout = $("blackout");
const backdrop = $("backdrop");

const btnMenu = $("btnMenu");
const btnCloseMenu = $("btnCloseMenu");

const btnTools = $("btnTools");
const btnCloseTools = $("btnCloseTools");

const btnBlackout = $("btnBlackout");
const btnAllClear = $("btnAllClear");

const chatFeed = $("chatFeed");
const chatBox = $("chatBox");
const btnSend = $("btnSend");

const modePill = $("modePill");
const pulseState = $("pulseState");
const statusText = $("statusText");
const reactorSvg = document.querySelector(".reactor");

const MODES = { BLUE:"BLUE", CYAN:"CYAN", PURPLE:"PURPLE", RED:"RED", GREEN:"GREEN", ORANGE:"ORANGE" };

function setMode(name){
  modePill.textContent = MODES[name] || "BLUE";
}

function addMsg(role, text){
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "USER" ? "msg--user" : "msg--arc"}`;

  const meta = document.createElement("div");
  meta.className = "msg__meta mono";
  meta.textContent = role;

  const body = document.createElement("div");
  body.className = "msg__body";
  body.textContent = text;

  wrap.appendChild(meta);
  wrap.appendChild(body);
  chatFeed.appendChild(wrap);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function thinkPulse(on){
  if(!reactorSvg) return;
  if(on){
    reactorSvg.classList.add("reactorPulse");
    pulseState.textContent = "THINKING";
    setMode("CYAN");
    statusText.textContent = "ARC: THINKING";
  }else{
    reactorSvg.classList.remove("reactorPulse");
    pulseState.textContent = "IDLE";
    setMode("BLUE");
    statusText.textContent = "ARC: ONLINE";
  }
}

/* Panels */
function openPanel(panel){
  panel.classList.add("open");
  backdrop.classList.add("show");
}
function closePanels(){
  sidemenu.classList.remove("open");
  toolspanel.classList.remove("open");
  backdrop.classList.remove("show");
}

btnMenu?.addEventListener("click", () => openPanel(sidemenu));
btnCloseMenu?.addEventListener("click", closePanels);

btnTools?.addEventListener("click", () => openPanel(toolspanel));
btnCloseTools?.addEventListener("click", closePanels);

backdrop?.addEventListener("click", closePanels);

/* Blackout */
btnBlackout?.addEventListener("click", () => blackout.classList.add("show"));
btnAllClear?.addEventListener("click", () => blackout.classList.remove("show"));

/* Chat send (Phase 1 local only) */
async function onSend(){
  const text = (chatBox.value || "").trim();
  if(!text) return;
  chatBox.value = "";

  addMsg("USER", text);
  thinkPulse(true);

  // Phase 2: replace with fetch() to your worker /query
  setTimeout(() => {
    thinkPulse(false);
    addMsg("ARC", "Acknowledged. (Phase 2: wire to backend council + tools.)");
  }, 650);
}

btnSend?.addEventListener("click", onSend);
chatBox?.addEventListener("keydown", (e) => { if(e.key === "Enter") onSend(); });

setMode("BLUE");
pulseState.textContent = "IDLE";