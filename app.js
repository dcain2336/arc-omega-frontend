const CFG = window.ARC_CONFIG || {};
const BACKEND = (CFG.BACKEND_URL || "").replace(/\/+$/, "");

// --------- Ticker speed (tweak this one number) ---------
// px per second. Try 70–120 range.
// If it feels too fast: lower it. Too slow: raise it.
const TICKER_PX_PER_SEC = 95;

const el = (id) => document.getElementById(id);
const logEl = el("log");
const apiUrlText = el("apiUrlText");
const upstreamEl = el("upstream");

apiUrlText.textContent = BACKEND || "(not set)";

function log(line){
  logEl.textContent = (logEl.textContent + line + "\n").trimStart();
}

async function fetchJSON(url, opts){
  const r = await fetch(url, opts);
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(`HTTP ${r.status} ${t}`);
  }
  return await r.json();
}

// ---------------- Ping / upstream ----------------
async function ping(){
  if(!BACKEND) return;
  try{
    const j = await fetchJSON(`${BACKEND}/ping`);
    upstreamEl.textContent = "ok";
    log(`> Ping\n${BACKEND}/ping -> ${JSON.stringify(j)}`);
  }catch(e){
    upstreamEl.textContent = "error";
    log(`> Ping\nsend error: ${e}`);
  }
}

async function sendQuery(text){
  try{
    const payload = { message: text, session_id: "web" };
    const j = await fetchJSON(`${BACKEND}/query`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    log(`> ${text}\n${j.ok ? j.text : ("ERR: "+j.error)}\n`);
  }catch(e){
    log(`send error: ${e}`);
  }
}

el("send").addEventListener("click", ()=>{
  const v = el("msg").value.trim();
  if(!v) return;
  el("msg").value = "";
  sendQuery(v);
});

el("msg").addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){
    el("send").click();
  }
});

// ---------------- Weather (Open-Meteo) ----------------
async function loadWeather(){
  const w = el("weatherText");
  try{
    w.textContent = "Getting location…";
    const pos = await new Promise((resolve, reject)=>{
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:false, timeout: 8000 });
    });

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;

    const j = await fetchJSON(url);
    const temp = j?.current?.temperature_2m;
    const wind = j?.current?.wind_speed_10m;

    w.textContent = `Your area · ${Math.round(temp)}°F · Wind ${wind.toFixed(1)} mph`;
  }catch(e){
    w.textContent = "Weather error";
    console.warn(e);
  }
}

// ---------------- News (GDELT) ----------------
async function loadNews(){
  const n = el("newsText");
  try{
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20OR%20cyber%20OR%20technology&mode=ArtList&format=json&maxrecords=5";

    const j = await fetchJSON(url);
    const arts = j?.articles || [];
    if(!arts.length){
      n.textContent = "No headlines returned.";
      return;
    }
    // show titles only, simple
    n.innerHTML = arts.map(a => (a.title || "").trim()).filter(Boolean).join(" · ");
  }catch(e){
    n.textContent = "News error";
    console.warn(e);
  }
}

// ---------------- World time ticker ----------------
const ZONES = [
  ["CT", "America/Chicago"],
  ["ET", "America/New_York"],
  ["MT", "America/Denver"],
  ["PT", "America/Los_Angeles"],
  ["UTC", "UTC"],
  ["London", "Europe/London"],
  ["Paris", "Europe/Paris"],
  ["Dubai", "Asia/Dubai"],
  ["Manila", "Asia/Manila"],
  ["Guam", "Pacific/Guam"],
  ["Seoul", "Asia/Seoul"],
  ["Tokyo", "Asia/Tokyo"],
];

function fmtTime(tz){
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit", minute:"2-digit", second:"2-digit",
    hour12: false,
    timeZone: tz
  }).format(new Date());
}

function buildTickerText(){
  return ZONES.map(([label, tz]) => `${label} ${fmtTime(tz)}`).join("  •  ");
}

function startTicker(){
  const ticker = el("timeTicker");
  const updateText = ()=>{
    ticker.textContent = buildTickerText();
  };
  updateText();
  setInterval(updateText, 1000);

  // animate by setting duration based on content width
  const applyAnim = ()=>{
    // reset animation to recalc
    ticker.style.animation = "none";
    const contentWidth = ticker.getBoundingClientRect().width;
    const outerWidth = ticker.parentElement.getBoundingClientRect().width;
    const travel = contentWidth + outerWidth;
    const duration = Math.max(10, travel / TICKER_PX_PER_SEC);

    // force reflow
    void ticker.offsetWidth;
    ticker.style.animation = `scroll-left ${duration}s linear infinite`;
  };

  // apply now and on resize
  setTimeout(applyAnim, 50);
  window.addEventListener("resize", applyAnim);
}

const styleTag = document.createElement("style");
styleTag.textContent = `
@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
`;
document.head.appendChild(styleTag);

// ---------------- Init ----------------
ping();
loadWeather();
loadNews();
startTicker();