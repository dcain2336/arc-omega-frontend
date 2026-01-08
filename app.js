// frontend/app.js
const API_BASE = "https://arc-omega-backend.onrender.com";

// Elements
const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");

const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");
const newsTrack = document.getElementById("newsTrack");
const timeTrack = document.getElementById("timeTrack");

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
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

if (apiUrlText) apiUrlText.textContent = API_BASE;

function log(line) {
  if (!terminal) return;
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
  } catch {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}
refreshBackendStatus();
setInterval(refreshBackendStatus, 12000);

/* Geolocation */
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
      if (weatherText) weatherText.textContent = "Weather unavailable (no location / blocked)";
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
      if (weatherText) weatherText.textContent = "Weather unavailable";
      return;
    }

    const tempF = (cw.temperature * 9 / 5) + 32;
    if (weatherText) weatherText.textContent = `Your area • ${tempF.toFixed(1)}°F • Wind ${cw.windspeed.toFixed(1)} mph`;
  } catch {
    if (weatherText) weatherText.textContent = "Weather unavailable";
  }
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* World Time ticker */
function buildWorldTimeLine() {
  const zones = [
    { name: "LOCAL", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { name: "ET", tz: "America/New_York" },
    { name: "CT", tz: "America/Chicago" },
    { name: "MT", tz: "America/Denver" },
    { name: "PT", tz: "America/Los_Angeles" },
    { name: "UTC", tz: "UTC" },
    { name: "London", tz: "Europe/London" },
    { name: "Paris", tz: "Europe/Paris" },
    { name: "Dubai", tz: "Asia/Dubai" },
    { name: "Manila", tz: "Asia/Manila" },
    { name: "Guam", tz: "Pacific/Guam" },
    { name: "Seoul", tz: "Asia/Seoul" },
    { name: "Tokyo", tz: "Asia/Tokyo" },
    { name: "Sydney", tz: "Australia/Sydney" },
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
  if (!timeTrack) return;
  const line = buildWorldTimeLine();
  timeTrack.textContent = `${line}   •   ${line}`;
}
refreshWorldTime();
setInterval(refreshWorldTime, 1000);

/* News ticker */
async function refreshNews() {
  if (!newsTrack) return;
  try {
    const data = await apiGet("/tools/news");
    const headlines = Array.isArray(data?.headlines) ? data.headlines : [];
    const clean = headlines
      .filter((h) => typeof h === "string")
      .map((h) => h.trim())
      .filter((h) => h.length);

    const base = clean.length ? clean.join("   •   ") : "No headlines right now";
    newsTrack.textContent = `${base}   •   ${base}`;
  } catch {
    newsTrack.textContent = `News unavailable   •   News unavailable`;
  }
}
refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* Files */
let lastUploadedFileId = null;
let lastUploadedMime = null;

async function refreshFilesList() {
  if (!filesList) return;
  try {
    const data = await apiGet("/files");
    if (!data.ok) {
      filesList.textContent = data.error || "Files unavailable";
      return;
    }
    const files = data.files || [];
    if (!files.length) {
      filesList.textContent = "No files yet";
      return;
    }

    filesList.innerHTML = files.map((f) => {
      const name = (f.name || "file")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `• <a href="${API_BASE}/files/${f.id}" target="_blank" rel="noopener noreferrer">${name}</a> (${f.size} bytes)`;
    }).join("<br/>");
  } catch {
    filesList.textContent = "Files unavailable";
  }
}

uploadBtn?.addEventListener("click", async () => {
  if (!fileInput?.files?.length) return;
  const file = fileInput.files[0];

  try {
    const form = new FormData();
    form.append("file", file);

    const r = await fetch(`${API_BASE}/files`, { method: "POST", body: form });
    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!r.ok || !data.ok) {
      log(`upload failed: ${data.error || txt}`);
      return;
    }

    lastUploadedFileId = data.id;
    lastUploadedMime = data.content_type || file.type || null;

    log(`uploaded: ${data.name} (${data.size} bytes)`);
    fileInput.value = "";
    refreshFilesList();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
});

refreshFilesList();
setInterval(refreshFilesList, 60 * 1000);

/* “Tell me about the picture I uploaded” helper */
async function maybeAnalyzeLatestImage(userText) {
  const t = (userText || "").toLowerCase();
  const mentionsImage = t.includes("picture") || t.includes("image") || t.includes("photo") || t.includes("uploaded");
  if (!mentionsImage) return null;
  if (!lastUploadedFileId) return null;

  const imageish = (lastUploadedMime || "").startsWith("image/");
  if (!imageish) return null;

  try {
    const out = await apiPost(`/files/${encodeURIComponent(lastUploadedFileId)}/analyze`, {
      prompt: "Describe the image clearly. Include key objects and any text you can read. Be concise.",
    });
    if (out.ok && out.text) return out.text;
  } catch {
    // ignore
  }
  return null;
}

/* Send message */
async function sendMessage() {
  const msg = (promptEl?.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const analysis = await maybeAnalyzeLatestImage(msg);
    const payload = analysis
      ? { message: `${msg}\n\n[CONTEXT: Image analysis of the last uploaded image]\n${analysis}` }
      : { message: msg };

    // Council selection is automatic server-side
    const out = await apiPost("/query", payload);
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

/* ---------------- MAP MODE ---------------- */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

let mapImg = new Image();
mapImg.src = "./assets/world-map-blue.png";
mapImg.crossOrigin = "anonymous";

let userLat = null;
let userLon = null;

/*
  ✅ IMPORTANT: Your PNG likely has padding/margins or isn't perfectly equirectangular.
  These crop values let us "calibrate" without replacing the image.

  Try small tweaks (e.g. left=0.02 right=0.02) until the pin matches.
  Values are FRACTIONS of the drawn map width/height.
*/
const MAP_CROP = {
  left: 0.00,   // e.g. 0.02
  right: 0.00,  // e.g. 0.02
  top: 0.00,    // e.g. 0.01
  bottom: 0.00, // e.g. 0.01
};

function setCanvasSize() {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  const subLon = ((180 - timeUTC * 15) % 360 + 360) % 360;

  return { lon: subLon, lat: delta * 180 / Math.PI };
}

function drawMap() {
  if (!canvas || !ctx) return;

  setCanvasSize();
  const rect = canvas.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, W, H);

  if (!mapImg.complete || mapImg.naturalWidth === 0) {
    if (statusEl) statusEl.textContent = "Map loading…";
    return;
  }

  const imgAR = mapImg.naturalWidth / mapImg.naturalHeight;
  const canvasAR = W / H;

  let drawW, drawH, offX, offY;
  if (imgAR > canvasAR) {
    drawH = H;
    drawW = H * imgAR;
    offX = (W - drawW) / 2;
    offY = 0;
  } else {
    drawW = W;
    drawH = W / imgAR;
    offX = 0;
    offY = (H - drawH) / 2;
  }

  ctx.drawImage(mapImg, offX, offY, drawW, drawH);

  // Apply crop calibration region (for mapping + overlays)
  const cropX = offX + drawW * MAP_CROP.left;
  const cropY = offY + drawH * MAP_CROP.top;
  const cropW = drawW * (1 - MAP_CROP.left - MAP_CROP.right);
  const cropH = drawH * (1 - MAP_CROP.top - MAP_CROP.bottom);

  // Day/night overlay
  const now = new Date();
  const sun = solarSubpointUTC(now);
  const subLon = sun.lon;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cropX, cropY, cropW, cropH);
  ctx.clip();

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "rgba(0,0,0,1)";

  const x0 = Math.max(0, Math.floor(cropX));
  const x1 = Math.min(W, Math.ceil(cropX + cropW));
  for (let x = x0; x < x1; x += 2) {
    const u = (x - cropX) / cropW;   // 0..1 across cropped map region
    const lon = u * 360 - 180;
    const lon360 = ((lon % 360) + 360) % 360;

    let d = lon360 - subLon;
    d = ((d + 540) % 360) - 180;
    if (Math.abs(d) > 90) ctx.fillRect(x, cropY, 2, cropH);
  }

  ctx.restore();

  // User pin (mapped inside the CROPPED region)
  if (userLat != null && userLon != null) {
    const u = (userLon + 180) / 360;
    const v = (90 - userLat) / 180;

    const px = cropX + u * cropW;
    const py = cropY + v * cropH;

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(53,232,255,0.95)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(53,232,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (statusEl) statusEl.textContent = "Map running";
}

let animId = null;
function startMapLoop() {
  if (animId) cancelAnimationFrame(animId);
  const loop = () => {
    drawMap();
    animId = requestAnimationFrame(loop);
  };
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
    startMapLoop();
  }
});

(async () => {
  const pos = await getPosition();
  if (pos) {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
  }
  setCanvasSize();
  startMapLoop();
})();

mapImg.onload = () => {
  setCanvasSize();
  startMapLoop();
};