// frontend/app.js
const API_BASE = "https://arc-omega-backend.onrender.com";

const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");
const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");

// News marquee
const newsInner = document.getElementById("newsInner");

// Time pill (local clock)
const timePill = document.getElementById("timePill");

// World time ticker
const worldTimeInner = document.getElementById("worldTimeInner");

// Files
const filePick = document.getElementById("filePick");
const btnUpload = document.getElementById("btnUpload");
const btnRefreshFiles = document.getElementById("btnRefreshFiles");
const filesList = document.getElementById("filesList");

// Drawer / overlay / blackout
const btnMenu = document.getElementById("btnMenu");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const btnBlackout = document.getElementById("btnBlackout");
const blackout = document.getElementById("blackout");

const btnRefreshBackend = document.getElementById("btnRefreshBackend");
const btnRefreshWeather = document.getElementById("btnRefreshWeather");
const btnRefreshNews = document.getElementById("btnRefreshNews");

apiUrlText.textContent = API_BASE;

function log(line) {
  terminal.textContent += `${line}\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { method: "GET", cache: "no-store" });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

/* Drawer + blackout */
function openDrawer() {
  drawer?.classList.add("open");
  drawerOverlay?.classList.remove("hidden");
}
function closeDrawer() {
  drawer?.classList.remove("open");
  drawerOverlay?.classList.add("hidden");
}
btnMenu?.addEventListener("click", openDrawer);
btnCloseDrawer?.addEventListener("click", closeDrawer);
drawerOverlay?.addEventListener("click", closeDrawer);

btnBlackout?.addEventListener("click", () => blackout?.classList.remove("hidden"));
blackout?.addEventListener("click", () => blackout?.classList.add("hidden"));

btnRefreshBackend?.addEventListener("click", () => refreshBackendStatus(true));
btnRefreshWeather?.addEventListener("click", refreshWeather);
btnRefreshNews?.addEventListener("click", refreshNews);
btnRefreshFiles?.addEventListener("click", refreshFiles);

/* Local clock pill */
function pad2(n){ return String(n).padStart(2,"0"); }
function tickTime(){
  const d = new Date();
  const s = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  if (timePill) timePill.textContent = s;
}
tickTime();
setInterval(tickTime, 1000);

/* ✅ World time ticker (scrolling) */
function fmtTZ(tz){
  const now = new Date();
  const fmt = new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz
  });
  return fmt.format(now);
}

function buildWorldLine(){
  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = [
    ["LOCAL", localTZ],
    ["ET", "America/New_York"],
    ["CT", "America/Chicago"],
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
    ["Sydney", "Australia/Sydney"],
  ];

  const parts = zones.map(([name, tz]) => `${name} ${fmtTZ(tz)}`);
  return parts.join("   •   ");
}

function refreshWorldTicker(){
  if (!worldTimeInner) return;
  const line = buildWorldLine();
  // duplicate for smooth -50% translate
  worldTimeInner.textContent = line + "   •   " + line;
}
refreshWorldTicker();
setInterval(refreshWorldTicker, 1000);

/* Backend status polling */
let lastBackendRefresh = 0;
async function refreshBackendStatus(force = false) {
  const now = Date.now();
  if (!force && now - lastBackendRefresh < 8000) return;
  lastBackendRefresh = now;

  try {
    const ping = await apiGet("/ping");
    upstreamText.textContent = ping.ok ? "ok" : "down";
    upstreamPill.classList.remove("bad");
    upstreamPill.classList.add("ok");
  } catch (e) {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}
refreshBackendStatus();
setInterval(refreshBackendStatus, 12000);

/* Send message */
async function sendMessage() {
  const msg = (promptEl.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg });
    if (!out.ok) {
      log(`! error: ${out.error || "unknown"}`);
      return;
    }
    log(out.text || "(no text)");
  } catch (e) {
    log(`send error: ${e.message || String(e)}`);
  }
}
sendBtn?.addEventListener("click", sendMessage);
promptEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

/* Geolocation helper */
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

/* Weather */
async function refreshWeather() {
  try {
    const pos = await getPosition();
    if (!pos) {
      weatherText.textContent = "Weather unavailable (no location / blocked)";
      return;
    }
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      { cache: "no-store" }
    );
    const data = await r.json();
    const cw = data.current_weather;
    if (!cw) {
      weatherText.textContent = "Weather unavailable";
      return;
    }
    const tempF = (cw.temperature * 9 / 5) + 32;
    weatherText.textContent = `Your area • ${tempF.toFixed(1)}°F • Wind ${cw.windspeed.toFixed(1)} mph`;
  } catch {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* News (no flashing; only update if changed) */
let _lastNews = "";
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];
    const base = headlines.length ? (" • " + headlines.join(" • ") + " • ") : "No headlines • ";
    const line = base + base; // duplicate for smooth loop

    if (line !== _lastNews) {
      _lastNews = line;
      if (newsInner) newsInner.textContent = line;
    }
  } catch {
    const base = "News unavailable • ";
    const line = base + base + base + base;
    if (line !== _lastNews) {
      _lastNews = line;
      if (newsInner) newsInner.textContent = line + line;
    }
  }
}
refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* Files */
async function refreshFiles() {
  try {
    const data = await apiGet("/files");
    if (!data.ok) {
      filesList.textContent = `Files unavailable: ${data.error || "unknown"}`;
      return;
    }
    const items = data.files || [];
    if (!items.length) {
      filesList.textContent = "No files yet";
      return;
    }
    filesList.innerHTML = items.map(f => {
      const id = encodeURIComponent(f.id);
      const name = (f.name || "file").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `• <a href="${API_BASE}/files/${id}" target="_blank" rel="noopener">${name}</a> (${f.size} bytes)`;
    }).join("<br/>");
  } catch {
    filesList.textContent = "File list unavailable";
  }
}

async function uploadFile() {
  const file = filePick?.files?.[0];
  if (!file) return;

  try {
    const form = new FormData();
    form.append("file", file);

    const r = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
    if (!r.ok || !data.ok) throw new Error(data.error || txt);

    log(`uploaded: ${data.name} (${data.size} bytes)`);
    await refreshFiles();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
}
btnUpload?.addEventListener("click", uploadFile);
refreshFiles();

/* ✅ Globe (fast, textured, no per-pixel loops) */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

let dpr = window.devicePixelRatio || 1;
let cw = 0, ch = 0;

function resizeCanvas(){
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  cw = Math.max(1, Math.floor(rect.width));
  ch = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", () => setTimeout(resizeCanvas, 100));
resizeCanvas();

// Texture image (your repo already has it)
const mapImg = new Image();
mapImg.crossOrigin = "anonymous";
mapImg.src = "./assets/world-map-blue.png";

let mapReady = false;
mapImg.onload = () => { mapReady = true; };

function solarSubpointUTC(d) {
  const timeUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subLon = (180 - timeUTC * 15) % 360;
  return { lon: subLon };
}

let globeAnim = null;

function drawTexturedGlobe(t){
  if (!canvas || !ctx) return;
  if (!cw || !ch) resizeCanvas();

  const cx = cw/2, cy = ch/2;
  const r = Math.min(cw, ch) * 0.36;

  ctx.clearRect(0,0,cw,ch);

  // background glow
  const glow = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r*1.25);
  glow.addColorStop(0, "rgba(45,212,191,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,cw,ch);

  // clip sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.clip();

  // base shading for curvature
  const base = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, r*0.2, cx, cy, r);
  base.addColorStop(0, "rgba(255,255,255,0.12)");
  base.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = base;
  ctx.fillRect(cx-r, cy-r, r*2, r*2);

  // draw rotating map (fast hack: slide equirect map behind circle, wrap by drawing twice)
  if (mapReady) {
    const rotPx = (t * 35) % mapImg.width; // speed
    const drawW = r*2;
    const drawH = r*2;

    // scale image to sphere size
    // we slide it by changing source x (crop)
    const sx = Math.floor(rotPx);
    const sw = Math.min(mapImg.width - sx, mapImg.width);

    // first segment
    ctx.drawImage(mapImg, sx, 0, sw, mapImg.height, cx - r, cy - r, drawW * (sw / mapImg.width), drawH);

    // wrap segment if needed
    if (sw < mapImg.width) {
      const rem = mapImg.width - sw;
      ctx.drawImage(mapImg, 0, 0, rem, mapImg.height, cx - r + drawW * (sw / mapImg.width), cy - r, drawW * (rem / mapImg.width), drawH);
    }

    // darken edges for “roundness”
    const vign = ctx.createRadialGradient(cx, cy, r*0.55, cx, cy, r);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vign;
    ctx.fillRect(cx-r, cy-r, r*2, r*2);
  }

  // day/night overlay (simple rotated gradient)
  const sun = solarSubpointUTC(new Date());
  const rotDeg = (t * 6) % 360; // visual rotation degrees
  const rel = ((sun.lon - rotDeg) + 360) % 360;

  // gradient direction: shift based on rel
  const angle = (rel * Math.PI) / 180;
  const gx = Math.cos(angle), gy = Math.sin(angle);

  const x1 = cx - gx * r, y1 = cy - gy * r;
  const x2 = cx + gx * r, y2 = cy + gy * r;
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0.00, "rgba(0,0,0,0.45)");
  g.addColorStop(0.45, "rgba(0,0,0,0.20)");
  g.addColorStop(0.52, "rgba(0,0,0,0.05)");
  g.addColorStop(1.00, "rgba(0,0,0,0.00)");
  ctx.fillStyle = g;
  ctx.fillRect(cx-r, cy-r, r*2, r*2);

  ctx.restore();

  // outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function startGlobe(){
  if (!canvas || !ctx) {
    if (statusEl) statusEl.textContent = "Globe unavailable";
    return;
  }
  if (statusEl) statusEl.textContent = "Globe running";

  const start = performance.now();
  function loop(now){
    const t = (now - start) / 1000;
    drawTexturedGlobe(t);
    globeAnim = requestAnimationFrame(loop);
  }
  if (globeAnim) cancelAnimationFrame(globeAnim);
  globeAnim = requestAnimationFrame(loop);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (globeAnim) cancelAnimationFrame(globeAnim);
    globeAnim = null;
  } else {
    startGlobe();
  }
});

setTimeout(() => { resizeCanvas(); startGlobe(); }, 150);