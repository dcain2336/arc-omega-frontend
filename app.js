// frontend/app.js
const API_BASE = "https://arc-omega-backend.onrender.com";

// session id (persist per browser)
const SESSION_KEY = "arc_session_id";
function getSessionId() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = "s_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}
const SESSION_ID = getSessionId();

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

const btnOpenCouncilLog = document.getElementById("btnOpenCouncilLog");
const councilLog = document.getElementById("councilLog");
const councilStatus = document.getElementById("councilStatus");

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

/* Send message */
async function sendMessage() {
  const msg = (promptEl?.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    // IMPORTANT: include session_id so council log binds correctly
    const out = await apiPost("/query", { message: msg, session_id: SESSION_ID });
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

/* Weather (UI only, map + tool router will also use backend when needed) */
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
    weatherText.textContent = "Weather unavailable";
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
  timeTrack.textContent = line + "   •   " + line;
}
refreshWorldTime();
setInterval(refreshWorldTime, 1000);

/* News ticker */
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];
    const clean = headlines.filter((h) => typeof h === "string" && h.trim().length);
    const base = clean.length ? clean.join("   •   ") : "No headlines right now";
    newsTrack.textContent = base + "   •   " + base;
  } catch {
    newsTrack.textContent = "News unavailable   •   News unavailable";
  }
}
refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* Files list + upload */
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
      const name = (f.name || "file").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    log(`uploaded: ${data.name} (${data.size} bytes)`);
    // ✅ clear file chooser
    fileInput.value = "";
    refreshFilesList();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
});

refreshFilesList();
setInterval(refreshFilesList, 60 * 1000);

/* Council log (drawer) */
async function openCouncilLog() {
  if (!councilLog || !councilStatus) return;

  councilStatus.textContent = "Loading council session…";
  try {
    const data = await apiGet(`/council/last?session_id=${encodeURIComponent(SESSION_ID)}`);
    if (!data.ok) {
      councilStatus.textContent = data.error || "No council session found.";
      councilLog.style.display = "none";
      return;
    }

    councilStatus.textContent = `Council session: ${data.session_id} • ${new Date(data.ts).toLocaleString()}`;
    councilLog.style.display = "block";
    councilLog.textContent = data.log || "(empty)";
  } catch (e) {
    councilStatus.textContent = "No council session found yet for this session.";
    councilLog.style.display = "none";
  }
}
btnOpenCouncilLog?.addEventListener("click", openCouncilLog);

/* -------------------------
   GEO MAP (no uploaded map)
   Uses a free static map:
   https://staticmap.openstreetmap.de/
------------------------- */
const geoMapImg = document.getElementById("geoMapImg");
const mapPin = document.getElementById("mapPin");
const mapStatus = document.getElementById("mapStatus");
const nightOverlay = document.getElementById("nightOverlay");

function isLikelyNightLocal() {
  // simple local heuristic: darken from 18:30 to 06:30
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return (h >= 18.5 || h <= 6.5);
}

async function refreshGeoMap() {
  if (!geoMapImg || !mapPin || !mapStatus || !nightOverlay) return;

  const pos = await getPosition();
  if (!pos) {
    mapStatus.textContent = "Map unavailable (location blocked)";
    return;
  }

  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  // ✅ correct location pin (centered map)
  const zoom = 8; // good for Onslow/Jacksonville
  const w = 900;
  const h = 520;

  // Static map service (free, no key)
  // Marker uses lat,lon
  const url =
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${encodeURIComponent(lat + "," + lon)}` +
    `&zoom=${zoom}&size=${w}x${h}` +
    `&markers=${encodeURIComponent(lat + "," + lon + ",cyan-pushpin")}`;

  geoMapImg.src = url;
  mapStatus.textContent = `Map running • lat ${lat.toFixed(4)} lon ${lon.toFixed(4)}`;

  // night overlay
  nightOverlay.style.background = isLikelyNightLocal() ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.06)";

  // pin is already baked into image, but we keep a subtle UI pin anyway (center)
  mapPin.style.left = "50%";
  mapPin.style.top = "50%";
}

refreshGeoMap();
setInterval(refreshGeoMap, 5 * 60 * 1000);