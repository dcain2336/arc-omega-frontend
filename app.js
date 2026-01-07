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
  if (!terminal) return;
  terminal.textContent += `${line}\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

window.addEventListener("error", (e) => {
  log(`JS error: ${e.message || e.error || "unknown"}`);
});

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

/* Drawer + blackout UI */
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
  } catch (e) {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}

refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* News */
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];
    if (!headlines.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }
    const line = " • " + headlines.join(" • ") + " • ";
    newsTrack.textContent = line;
  } catch (e) {
    newsTrack.textContent = "News unavailable";
  }
}

refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* ✅ World map texture (land mask) */
const landImg = new Image();
// ✅ RELATIVE so it works on Pages regardless of base path
landImg.src = "./assets/world-map-blue.png";

let landReady = false;

const landCanvas = document.createElement("canvas");
const landCtx = landCanvas.getContext("2d", { willReadFrequently: true });

landImg.onload = () => {
  landCanvas.width = landImg.width;
  landCanvas.height = landImg.height;
  landCtx.drawImage(landImg, 0, 0);
  landReady = true;
  log("Map loaded: land mask ready");
};

landImg.onerror = () => {
  log("Map FAILED to load. Check: ./assets/world-map-blue.png exists and is deployed.");
};

function isLandAt(lonDeg, latDeg) {
  if (!landReady) return false;

  const x = Math.floor(((lonDeg + 180) / 360) * landCanvas.width);
  const y = Math.floor(((90 - latDeg) / 180) * landCanvas.height);
  if (x < 0 || y < 0 || x >= landCanvas.width || y >= landCanvas.height) return false;

  const pixel = landCtx.getImageData(x, y, 1, 1).data;
  const r = pixel[0], g = pixel[1], b = pixel[2];

  return (b > 120 && b > r + 15 && b > g + 15);
}

/* Globe */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

let animId = null;
let lastLayoutW = 0;
let lastLayoutH = 0;
let userLat = null;
let userLon = null;

function setCanvasSize() {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (w === lastLayoutW && h === lastLayoutH && canvas.width > 0) return;

  lastLayoutW = w;
  lastLayoutH = h;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lonLatToSphereXY(lonDeg, latDeg, rotDeg) {
  const lon = (lonDeg - rotDeg) * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  return { x, y, z };
}

function solarSubpointUTC(d) {
  const ms = d.getTime();
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180);

  const eps = 23.439 - 0.0000004 * n;
  const delta = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lambda * Math.PI / 180));

  const timeUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subLon = (180 - timeUTC * 15) % 360;
  const subLat = delta * 180 / Math.PI;

  return { lat: subLat, lon: subLon };
}

function drawGlobe(t) {
  if (!canvas || !ctx) return;

  setCanvasSize();

  const w = lastLayoutW || canvas.getBoundingClientRect().width;
  const h = lastLayoutH || canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.2);
  grad.addColorStop(0, "rgba(45,212,191,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const fill = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
  fill.addColorStop(0, "rgba(255,255,255,0.08)");
  fill.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const rotDeg = (t * 0.6) % 360;

  // Land masses
  if (landReady) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "rgba(56,189,248,0.70)";
    for (let lat = -90; lat <= 90; lat += 1.5) {
      for (let lon = -180; lon <= 180; lon += 1.5) {
        if (!isLandAt(lon, lat)) continue;
        const p = lonLatToSphereXY(lon, lat, rotDeg);
        if (p.z <= 0) continue;
        ctx.fillRect(cx + p.x * r, cy - p.y * r, 1.8, 1.8);
      }
    }

    ctx.restore();
  }

  // Terminator
  const sun = solarSubpointUTC(new Date());
  const sunP = lonLatToSphereXY(sun.lon, sun.lat, rotDeg);
  const sunDir = { x: sunP.x, y: sunP.y, z: sunP.z };

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  for (let lat = -90; lat <= 90; lat += 2) {
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = lonLatToSphereXY(lon, lat, rotDeg);
      if (p.z <= 0) continue;
      const dot = (p.x * sunDir.x + p.y * sunDir.y + p.z * sunDir.z);
      if (dot >= 0) continue;
      ctx.fillRect(cx + p.x * r, cy - p.y * r, 1.6, 1.6);
    }
  }
  ctx.restore();

  // User pin
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
    statusEl.textContent = "Globe unavailable (canvas missing)";
    return;
  }

  statusEl.textContent = "Globe running";
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

(async () => {
  const pos = await getPosition();
  if (pos) {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    statusEl.textContent = "Globe running (location pinned)";
  } else {
    statusEl.textContent = "Globe running (location blocked)";
  }

  setTimeout(() => {
    setCanvasSize();
    startGlobe();
  }, 120);
})();

setTimeout(() => {
  setCanvasSize();
  startGlobe();
}, 200);