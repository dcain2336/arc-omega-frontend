// frontend/app.js
const API_BASE = "https://arc-omega-backend.onrender.com";

const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");
const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");
const newsTrack = document.getElementById("newsTrack");

// Drawer + blackout
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const btnMenu = document.getElementById("btnMenu");
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
  const r = await fetch(`${API_BASE}${path}`, { method: "GET" });
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
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

/* -------------------------
   Drawer controls
-------------------------- */
function openDrawer() {
  drawer.classList.add("open");
  drawerOverlay.classList.remove("hidden");
}
function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.add("hidden");
}
btnMenu.addEventListener("click", openDrawer);
btnCloseDrawer.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

// Blackout
btnBlackout.addEventListener("click", () => {
  blackout.classList.remove("hidden");
  closeDrawer();
});
blackout.addEventListener("click", () => blackout.classList.add("hidden"));

/* -------------------------
   Backend status polling
-------------------------- */
async function refreshBackendStatus() {
  try {
    const ping = await apiGet("/ping");
    upstreamText.textContent = ping.ok ? "ok" : "down";
    upstreamPill.classList.remove("bad");
    upstreamPill.classList.add("ok");
  } catch {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}

btnRefreshBackend.addEventListener("click", () => {
  refreshBackendStatus();
  closeDrawer();
});

refreshBackendStatus();
setInterval(refreshBackendStatus, 10000);

/* -------------------------
   Send message
-------------------------- */
async function sendMessage() {
  const msg = (promptEl.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg, provider: "auto" });

    if (!out.ok) {
      log(`! error: ${out.error || "unknown"}`);
      if (out.attempts) log(`attempts: ${JSON.stringify(out.attempts)}`);
      return;
    }
    log(out.text || "(no text)");
  } catch (e) {
    log(`send error: ${e.message || String(e)}`);
  }
}

sendBtn.addEventListener("click", sendMessage);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

/* -------------------------
   Weather (Open-Meteo)
-------------------------- */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000
    });
  });
}

async function refreshWeather() {
  try {
    const pos = await getPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    const data = await r.json();
    const cw = data.current_weather;

    if (!cw) {
      weatherText.textContent = "Weather unavailable";
      return;
    }

    const tempF = (cw.temperature * 9/5) + 32;
    weatherText.textContent = `Your area • ${tempF.toFixed(1)}°F • Wind ${cw.windspeed.toFixed(1)} mph`;
  } catch {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}

btnRefreshWeather.addEventListener("click", () => {
  refreshWeather();
  closeDrawer();
});

refreshWeather();
setInterval(refreshWeather, 600000);

/* -------------------------
   News (use backend)
   Fixes iOS CORS / reliability
-------------------------- */
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data.headlines || [];
    if (!headlines.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }
    const line = " • " + headlines.join(" • ") + " • ";
    newsTrack.textContent = line;
  } catch {
    newsTrack.textContent = "News unavailable";
  }
}

btnRefreshNews.addEventListener("click", () => {
  refreshNews();
  closeDrawer();
});

refreshNews();
setInterval(refreshNews, 300000);

/* -------------------------
   Globe (canvas) — FIXED
   + day/night “terminator wave”
-------------------------- */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext?.("2d");

let animId = null;
let t = 0;

function safeRect() {
  // iOS sometimes returns 0 early; use parent fallback.
  const r = canvas.getBoundingClientRect();
  const w = Math.max(10, Math.floor(r.width));
  const h = Math.max(10, Math.floor(r.height));
  return { w, h };
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const { w, h } = safeRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  // draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  // force a redraw next frame
});
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 250);
});

// Rough solar declination (good enough for a UI terminator)
function solarDeclinationRad(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const doy = Math.floor((now - start) / 86400000);
  return (23.44 * Math.PI/180) * Math.sin((2 * Math.PI * (doy - 81)) / 365);
}

// Subsolar longitude in radians (approx):
// 12:00 UTC -> 0°, 00:00 UTC -> -180°, 18:00 UTC -> +90° etc.
function subsolarLonRad(date) {
  const hrs = date.getUTCHours() + date.getUTCMinutes()/60 + date.getUTCSeconds()/3600;
  const lonDeg = (hrs * 15) - 180;
  return lonDeg * Math.PI/180;
}

// Draw a “ham lock” day/night wave across the globe
function drawTerminatorWave(cx, cy, r, date) {
  const dec = solarDeclinationRad(date);
  const lon = subsolarLonRad(date);

  // Use lon to rotate the wave horizontally
  const phase = lon;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.clip();

  // Shadow “hemisphere” like a moon-phase (simple but looks great)
  const offset = Math.cos(phase) * r * 0.55;
  const grd = ctx.createRadialGradient(cx + offset, cy, r*0.15, cx + offset, cy, r*1.2);
  grd.addColorStop(0, "rgba(0,0,0,0.00)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.20)");
  grd.addColorStop(1, "rgba(0,0,0,0.55)");

  ctx.fillStyle = grd;
  ctx.fillRect(cx - r, cy - r, r*2, r*2);

  // Terminator wave line
  ctx.beginPath();
  const amp = r * 0.10;
  const freq = 6;
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    const x = cx - r + (u * r * 2);
    const yBase = cy + Math.sin(dec) * r * 0.18; // seasonal tilt
    const y = yBase + Math.sin(u * Math.PI * freq + phase) * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function draw() {
  if (!canvas || !ctx) {
    if (statusEl) statusEl.textContent = "Globe failed: canvas context not available";
    return;
  }

  const { w, h } = safeRect();

  // If canvas ends up tiny on iOS, resync.
  if (w < 40 || h < 40) {
    resizeCanvas();
  }

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.33;

  // Globe outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Grid lines
  for (let i = -2; i <= 2; i++) {
    const y = cy + (i * r * 0.3);
    const rx = Math.sqrt(Math.max(0, r*r - (y - cy)*(y - cy)));
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, 1, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let j = -2; j <= 2; j++) {
    const x = cx + (j * r * 0.3);
    const ry = Math.sqrt(Math.max(0, r*r - (x - cx)*(x - cx)));
    ctx.beginPath();
    ctx.ellipse(x, cy, 1, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
  }

  // Day/Night overlay + wave
  drawTerminatorWave(cx, cy, r, new Date());

  // “You are here” dot (static, decorative)
  ctx.beginPath();
  ctx.arc(cx - r*0.40, cy - r*0.10, 6, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - r*0.40, cy - r*0.10, 2.5, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  // Orbiting dot (the “one dot zooming around the circle”)
  const ox = cx + Math.cos(t) * (r * 1.2);
  const oy = cy + Math.sin(t) * (r * 0.6);
  ctx.beginPath();
  ctx.arc(ox, oy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  t += 0.02;

  if (statusEl) statusEl.textContent = "Running (stable)";
  animId = requestAnimationFrame(draw);
}

// Kick canvas sizing AFTER layout is stable (important on iOS)
setTimeout(() => {
  resizeCanvas();
  draw();
}, 60);