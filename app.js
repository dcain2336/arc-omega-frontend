// frontend/app.js
const API_BASE = "https://arc-omega-backend.onrender.com";

// Topbar
const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");

// Terminal + chat
const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

// Weather / News / Time
const weatherText = document.getElementById("weatherText");
const newsTrack = document.getElementById("newsTrack");
const timeTrack = document.getElementById("timeTrack");

// Files
const fileInput = document.getElementById("fileInput");
const btnUpload = document.getElementById("btnUpload");
const filesList = document.getElementById("filesList");

// Drawer / blackout
const btnMenu = document.getElementById("btnMenu");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const btnBlackout = document.getElementById("btnBlackout");
const blackout = document.getElementById("blackout");

const btnRefreshBackend = document.getElementById("btnRefreshBackend");
const btnRefreshWeather = document.getElementById("btnRefreshWeather");
const btnRefreshNews = document.getElementById("btnRefreshNews");
const btnRefreshFiles = document.getElementById("btnRefreshFiles");

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
  drawer?.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  drawer?.classList.remove("open");
  drawerOverlay?.classList.add("hidden");
  drawer?.setAttribute("aria-hidden", "true");
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

/* Backend status */
let lastBackendRefresh = 0;
async function refreshBackendStatus(force=false) {
  const now = Date.now();
  if (!force && now - lastBackendRefresh < 8000) return;
  lastBackendRefresh = now;

  try {
    const ping = await apiGet("/ping");
    upstreamText.textContent = ping.ok ? "ok" : "down";
    upstreamPill.classList.remove("bad");
  } catch {
    upstreamText.textContent = "down";
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
    const out = await apiPost("/query", { message: msg, provider: "auto" });
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
    const tempF = (cw.temperature * 9/5) + 32;
    weatherText.textContent = `Your area • ${tempF.toFixed(1)}°F • Wind ${cw.windspeed.toFixed(1)} mph`;
  } catch {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* News ticker */
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];
    if (!headlines.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }
    // duplicate so animation feels continuous like time ticker
    const line = " • " + headlines.join(" • ") + " • ";
    newsTrack.textContent = line + line;
  } catch {
    newsTrack.textContent = "News unavailable";
  }
}
refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* World time ticker (real-time) */
function buildWorldTimeLine() {
  const zones = [
    { name: "ET", tz: "America/New_York" },
    { name: "CT", tz: "America/Chicago" },
    { name: "MT", tz: "America/Denver" },
    { name: "PT", tz: "America/Los_Angeles" },
    { name: "UTC", tz: "UTC" },
    { name: "London", tz: "Europe/London" },
    { name: "Manila", tz: "Asia/Manila" },
    { name: "Guam", tz: "Pacific/Guam" },
    { name: "Tokyo", tz: "Asia/Tokyo" },
  ];

  const now = new Date();
  const pieces = zones.map((z) => {
    const fmt = new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: z.tz,
    });
    return `${z.name} ${fmt.format(now)}`;
  });

  return pieces.join("   •   ");
}

function refreshWorldTime() {
  const line = buildWorldTimeLine();
  timeTrack.textContent = line + "   •   " + line;
}
refreshWorldTime();
setInterval(refreshWorldTime, 1000);

/* --------------------
   Static map + day/night shading + location pin
-------------------- */
const mapCanvas = document.getElementById("mapCanvas");
const mapStatus = document.getElementById("mapStatus");
const mctx = mapCanvas?.getContext("2d");

const MAP_SRC = "./assets/world-map-blue.png";
const mapImg = new Image();
mapImg.crossOrigin = "anonymous";
mapImg.src = MAP_SRC;

let userLat = null;
let userLon = null;

function resizeCanvasToCSS(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const need = (canvas.width !== Math.floor(w * dpr)) || (canvas.height !== Math.floor(h * dpr));
  if (!need) return { w, h, dpr };

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

// Approx subsolar point (good for visuals)
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
  const subLon = ((180 - timeUTC * 15) % 360 + 360) % 360; // 0..360
  const subLat = delta * 180 / Math.PI;

  return { lat: subLat, lon: subLon };
}

// lon/lat -> x/y on equirect map
function lonLatToXY(lon, lat, w, h) {
  // map lon -180..180, lat 90..-90
  const x = ( (lon + 180) / 360 ) * w;
  const y = ( (90 - lat) / 180 ) * h;
  return { x, y };
}

// Dot product on sphere to determine day/night at lon/lat
function isNight(lon, lat, sunLon, sunLat) {
  const toRad = (x) => x * Math.PI / 180;

  const φ = toRad(lat);
  const λ = toRad(lon);
  const φs = toRad(sunLat);
  const λs = toRad(sunLon);

  const x = Math.cos(φ) * Math.cos(λ);
  const y = Math.cos(φ) * Math.sin(λ);
  const z = Math.sin(φ);

  const xs = Math.cos(φs) * Math.cos(λs);
  const ys = Math.cos(φs) * Math.sin(λs);
  const zs = Math.sin(φs);

  const dot = x*xs + y*ys + z*zs;
  return dot < 0;
}

function drawMapFrame() {
  if (!mapCanvas || !mctx) return;

  const { w, h } = resizeCanvasToCSS(mapCanvas, mctx);
  mctx.clearRect(0, 0, w, h);

  // Background
  mctx.fillStyle = "rgba(0,0,0,0.20)";
  mctx.fillRect(0, 0, w, h);

  // Draw image scaled to fill width while keeping aspect
  if (mapImg.complete && mapImg.naturalWidth > 0) {
    const imgW = mapImg.naturalWidth;
    const imgH = mapImg.naturalHeight;

    // cover-ish to fit canvas (no stretching)
    const scale = Math.max(w / imgW, h / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    mctx.drawImage(mapImg, dx, dy, dw, dh);

    // We'll do shading in the same coordinate space as canvas,
    // but compute lon/lat based on *canvas* dimensions.
  } else {
    // fallback grid if image not loaded
    mctx.strokeStyle = "rgba(45,212,191,0.35)";
    mctx.strokeRect(0.5, 0.5, w-1, h-1);
    mctx.fillStyle = "rgba(45,212,191,0.20)";
    mctx.font = "12px ui-monospace";
    mctx.fillText("Loading map texture…", 12, 18);
  }

  // Day/Night shading overlay
  const now = new Date();
  const sun = solarSubpointUTC(now);
  // convert sun lon from 0..360 to -180..180
  let sunLon = sun.lon > 180 ? sun.lon - 360 : sun.lon;

  // clip to canvas
  mctx.save();
  mctx.globalCompositeOperation = "source-over";
  mctx.fillStyle = "rgba(0,0,0,0.35)";

  // faster shading: sample every N pixels, fill blocks
  const step = Math.max(2, Math.floor(Math.min(w, h) / 120)); // adaptive
  for (let y = 0; y < h; y += step) {
    const lat = 90 - (y / h) * 180;
    for (let x = 0; x < w; x += step) {
      const lon = (x / w) * 360 - 180;
      if (isNight(lon, lat, sunLon, sun.lat)) {
        mctx.fillRect(x, y, step, step);
      }
    }
  }
  mctx.restore();

  // Location pin
  if (userLat != null && userLon != null) {
    const p = lonLatToXY(userLon, userLat, w, h);

    mctx.beginPath();
    mctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    mctx.fillStyle = "rgba(251,113,133,0.95)";
    mctx.fill();

    mctx.beginPath();
    mctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    mctx.strokeStyle = "rgba(251,113,133,0.35)";
    mctx.lineWidth = 2;
    mctx.stroke();
  }

  // Border glow
  mctx.strokeStyle = "rgba(45,212,191,0.55)";
  mctx.lineWidth = 2;
  mctx.strokeRect(1, 1, w-2, h-2);
}

let mapAnim = null;
function startMapLoop() {
  if (!mapCanvas || !mctx) {
    mapStatus.textContent = "Map unavailable (canvas missing)";
    return;
  }
  function loop() {
    drawMapFrame();
    mapAnim = requestAnimationFrame(loop);
  }
  if (mapAnim) cancelAnimationFrame(mapAnim);
  mapAnim = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  // iOS size can lag
  setTimeout(() => drawMapFrame(), 50);
  setTimeout(() => drawMapFrame(), 250);
});

(async () => {
  // user location best-effort
  const pos = await getPosition();
  if (pos) {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    mapStatus.textContent = "Map running (location pinned)";
  } else {
    mapStatus.textContent = "Map running (location blocked)";
  }

  // wait for map texture
  mapImg.onload = () => {
    mapStatus.textContent = (userLat != null) ? "Map running (location pinned)" : "Map running";
    startMapLoop();
  };
  mapImg.onerror = () => {
    mapStatus.textContent = "Map running (texture failed to load)";
    startMapLoop();
  };

  // start even if image takes time
  setTimeout(() => startMapLoop(), 200);
})();

/* --------------------
   Files (expects backend endpoints)
   GET  /files       -> { files: [{id,name,size,ts}] }
   GET  /files/{id}  -> download
   POST /files       -> multipart upload (field "file")
-------------------- */

async function refreshFiles() {
  try {
    const data = await apiGet("/files");
    const items = data?.files || [];
    if (!items.length) {
      filesList.textContent = "No files yet";
      return;
    }

    // build simple list with download links
    const lines = items.map(f => {
      const name = f.name || f.filename || f.id || "file";
      const size = (f.size != null) ? ` (${Math.round(f.size/1024)} KB)` : "";
      const id = f.id || f._id || name;
      return `⬇ ${name}${size}  →  ${API_BASE}/files/${encodeURIComponent(id)}`;
    });

    filesList.textContent = lines.join("\n");
  } catch {
    filesList.textContent = "Files unavailable";
  }
}

btnUpload?.addEventListener("click", async () => {
  const file = fileInput?.files?.[0];
  if (!file) {
    log("! choose a file first");
    return;
  }

  try {
    const fd = new FormData();
    fd.append("file", file);

    const r = await fetch(`${API_BASE}/files`, {
      method: "POST",
      body: fd,
      cache: "no-store",
    });

    const txt = await r.text();
    if (!r.ok) {
      log(`upload error: ${r.status} ${txt}`);
      return;
    }

    log(`uploaded: ${file.name}`);
    await refreshFiles();
  } catch (e) {
    log(`upload error: ${String(e)}`);
  }
});

refreshFiles();
setInterval(refreshFiles, 10 * 60 * 1000);