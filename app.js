// frontend/app.js

// ✅ SET THIS ONCE
const API_BASE = "https://arc-omega-backend.onrender.com";

const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");
const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");
const newsTrack = document.getElementById("newsTrack");
const timeTrack = document.getElementById("timeTrack");

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

/* --------------------
   Drawer + blackout UI
-------------------- */
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

/* --------------------
   Backend status polling (throttled)
-------------------- */
let lastBackendRefresh = 0;

async function refreshBackendStatus(force = false) {
  const now = Date.now();
  if (!force && now - lastBackendRefresh < 8000) return; // throttle
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

/* --------------------
   Time ticker
-------------------- */
function fmtTZ(date, tz) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return "??:??:??";
  }
}

function refreshTimeTicker() {
  if (!timeTrack) return;

  const d = new Date();
  const local = d.toLocaleTimeString([], { hour12: false });

  const utc = fmtTZ(d, "UTC");
  const manila = fmtTZ(d, "Asia/Manila");
  const tokyo = fmtTZ(d, "Asia/Tokyo");
  const london = fmtTZ(d, "Europe/London");

  const line =
    ` • LOCAL ${local}  • UTC ${utc}  • MANILA ${manila}  • TOKYO ${tokyo}  • LONDON ${london} ` +
    ` • LOCAL ${local}  • UTC ${utc}  • MANILA ${manila}  • TOKYO ${tokyo}  • LONDON ${london} • `;

  timeTrack.textContent = line;
}

refreshTimeTicker();
setInterval(refreshTimeTicker, 1000);

/* --------------------
   Send message
-------------------- */
async function sendMessage() {
  const msg = (promptEl.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg }); // provider chain decided by backend
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

/* --------------------
   Browser geolocation helper
-------------------- */
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

/* --------------------
   Weather (Open-Meteo) using browser geolocation
-------------------- */
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
  } catch (e) {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}

refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* --------------------
   News ticker (backend endpoint)
-------------------- */
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];

    if (!headlines.length) {
      newsTrack.textContent = "No headlines right now • No headlines right now • ";
      return;
    }

    // ✅ duplicate so CSS marquee is continuous
    const line = " • " + headlines.join(" • ") + " • " + headlines.join(" • ") + " • ";
    newsTrack.textContent = line;
  } catch (e) {
    newsTrack.textContent = "News unavailable • News unavailable • ";
  }
}

refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* --------------------
   Canvas Globe with Map Texture + Day/Night Terminator + Location Pin
-------------------- */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

let animId = null;
let lastLayoutW = 0;
let lastLayoutH = 0;

// user location (optional)
let userLat = null;
let userLon = null;

function setCanvasSize() {
  if (!canvas || !ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  // only resize if layout changed to avoid flicker
  if (w === lastLayoutW && h === lastLayoutH && canvas.width > 0) return;

  lastLayoutW = w;
  lastLayoutH = h;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lonLatToSphereXY(lonDeg, latDeg, rotDeg) {
  // Orthographic projection centered at lon=rotDeg, lat=0
  const lon = (lonDeg - rotDeg) * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;

  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon); // visible if z>0

  return { x, y, z };
}

function solarSubpointUTC(d) {
  // Approximate subsolar point for shading visuals.
  const ms = d.getTime();
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180);

  const eps = 23.439 - 0.0000004 * n;
  const delta = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lambda * Math.PI / 180)); // declination

  const timeUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subLon = (180 - timeUTC * 15) % 360;
  const subLat = delta * 180 / Math.PI;

  return { lat: subLat, lon: subLon };
}

// ✅ Map texture from your repo: /assets/world-map-blue.png
const LAND_IMG_SRC = "./assets/world-map-blue.png";
const landImg = new Image();
let landReady = false;
landImg.onload = () => { landReady = true; };
landImg.onerror = () => { landReady = false; };
landImg.src = LAND_IMG_SRC;

function drawGlobe(t) {
  if (!canvas || !ctx) return;

  setCanvasSize();

  const w = lastLayoutW || canvas.getBoundingClientRect().width;
  const h = lastLayoutH || canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  // background glow
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.2);
  grad.addColorStop(0, "rgba(45,212,191,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // sphere base
  const fill = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
  fill.addColorStop(0, "rgba(255,255,255,0.07)");
  fill.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // rotation
  const rotDeg = (t * 0.6) % 360;

  // ---------
  // Texture paint: project equirectangular map onto globe
  // ---------
  if (landReady) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // degrees step: lower = prettier, higher = faster
    const step = 2;

    for (let lon = -180; lon <= 180; lon += step) {
      const texLon = ((lon - rotDeg + 540) % 360) - 180; // normalize -180..180
      const u = (texLon + 180) / 360; // 0..1
      const sx = Math.floor(u * (landImg.width - 1));

      for (let lat = -90; lat <= 90; lat += step) {
        const p = lonLatToSphereXY(lon, lat, rotDeg);
        if (p.z <= 0) continue;

        const v = (90 - lat) / 180; // 0..1 (top->bottom)
        const sy = Math.floor(v * (landImg.height - 1));

        const x = cx + p.x * r;
        const y = cy - p.y * r;

        // 1x1 sample scaled to small block
        ctx.drawImage(landImg, sx, sy, 1, 1, x, y, 1.8, 1.8);
      }
    }

    ctx.restore();
  }

  // Graticule (optional subtle)
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let started = false;
    for (let lon = -180; lon <= 180; lon += 6) {
      const p = lonLatToSphereXY(lon, lat, rotDeg);
      if (p.z <= 0) continue;
      const x = cx + p.x * r;
      const y = cy - p.y * r;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
  }

  // Day/Night overlay
  const now = new Date();
  const sun = solarSubpointUTC(now);

  const sunP = lonLatToSphereXY(sun.lon, sun.lat, rotDeg);
  const sunDir = { x: sunP.x, y: sunP.y, z: sunP.z };

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Shade night side (dot < 0)
  for (let lat = -90; lat <= 90; lat += 2) {
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = lonLatToSphereXY(lon, lat, rotDeg);
      if (p.z <= 0) continue;
      const dot = (p.x * sunDir.x + p.y * sunDir.y + p.z * sunDir.z);
      if (dot >= 0) continue;

      const x = cx + p.x * r;
      const y = cy - p.y * r;

      // feather darkness near terminator
      const a = Math.min(0.55, Math.max(0.18, (-dot) * 0.55));
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }

  ctx.restore();

  // Sun marker
  if (sunP.z > 0) {
    const sx = cx + sunP.x * r;
    const sy = cy - sunP.y * r;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fill();
  }

  // User pin (if available)
  if (userLat != null && userLon != null) {
    const u = lonLatToSphereXY(userLon, userLat, rotDeg);
    if (u.z > 0) {
      const ux = cx + u.x * r;
      const uy = cy - u.y * r;

      ctx.beginPath();
      ctx.arc(ux, uy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251,113,133,0.95)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ux, uy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,113,133,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function startGlobe() {
  if (!canvas || !ctx) {
    if (statusEl) statusEl.textContent = "Globe unavailable (canvas missing)";
    return;
  }

  if (statusEl) statusEl.textContent = landReady ? "Globe running" : "Globe running (map not loaded)";
  let start = performance.now();

  function loop(now) {
    const t = (now - start) / 1000;
    drawGlobe(t);
    animId = requestAnimationFrame(loop);
  }

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  setCanvasSize();
  setTimeout(setCanvasSize, 250);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  } else {
    startGlobe();
  }
});

// Get user location once (best-effort) and keep it
(async () => {
  const pos = await getPosition();
  if (pos) {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    if (statusEl) statusEl.textContent = "Globe running (location pinned)";
  } else {
    if (statusEl) statusEl.textContent = "Globe running (location blocked)";
  }
  setTimeout(() => {
    setCanvasSize();
    startGlobe();
  }, 120);
})();

// Kick immediately in case location takes too long
setTimeout(() => {
  setCanvasSize();
  startGlobe();
}, 200);