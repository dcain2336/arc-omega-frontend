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

const councilCard = document.getElementById("councilCard");
const councilLog = document.getElementById("councilLog");
const btnRefreshCouncilLog = document.getElementById("btnRefreshCouncilLog");
const btnClearCouncilLog = document.getElementById("btnClearCouncilLog");

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
const btnRefreshFiles = document.getElementById("btnRefreshFiles");

const btnOpenCouncilLog = document.getElementById("btnOpenCouncilLog");
const btnHideCouncilLog = document.getElementById("btnHideCouncilLog");

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
btnRefreshFiles?.addEventListener("click", refreshFilesList);

/* Council Log drawer controls */
function showCouncilLog() {
  councilCard?.classList.remove("hidden");
  btnOpenCouncilLog?.classList.add("hidden");
  btnHideCouncilLog?.classList.remove("hidden");
  refreshCouncilLog();
  closeDrawer();
}
function hideCouncilLog() {
  councilCard?.classList.add("hidden");
  btnOpenCouncilLog?.classList.remove("hidden");
  btnHideCouncilLog?.classList.add("hidden");
  closeDrawer();
}
btnOpenCouncilLog?.addEventListener("click", showCouncilLog);
btnHideCouncilLog?.addEventListener("click", hideCouncilLog);

btnRefreshCouncilLog?.addEventListener("click", refreshCouncilLog);
btnClearCouncilLog?.addEventListener("click", () => {
  if (councilLog) councilLog.textContent = "";
});

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
let lastCouncilSessionId = "default";

async function sendMessage() {
  const msg = (promptEl?.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg, session_id: lastCouncilSessionId });

    if (!out.ok) {
      log(`! error: ${out.error || "unknown"}`);
      return;
    }

    if (out.council_session_id) lastCouncilSessionId = out.council_session_id;

    log(out.text || "(no text)");

    // If council log panel is open, refresh it after a response
    if (councilCard && !councilCard.classList.contains("hidden")) {
      refreshCouncilLog();
    }
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
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  });
}

/* Weather (Open-Meteo via browser geolocation) */
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

/* News ticker — keep same visual speed as time ticker (CSS controls duration) */
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

/* Files */
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
    fileInput.value = "";
    refreshFilesList();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
});

refreshFilesList();
setInterval(refreshFilesList, 60 * 1000);

/* Council log */
async function refreshCouncilLog() {
  if (!councilLog) return;
  try {
    const data = await apiGet("/council/last");
    if (!data.ok || !data.has_log) {
      councilLog.textContent = "No council log yet. Ask a question that triggers tools/council (weather/web/news/etc.).";
      return;
    }
    const events = data.events || [];
    const lines = events.map((e) => {
      const role = e.role || "Event";
      const provider = e.provider ? ` (${e.provider}${e.model ? "/" + e.model : ""})` : "";
      const text = (e.text || "").toString();
      const tools = e.tools ? `\nTOOLS: ${JSON.stringify(e.tools, null, 2)}` : "";
      const err = e.error ? `\nERROR: ${e.error}` : "";
      return `== ${role}${provider} ==\n${text}${tools}${err}\n`;
    });
    councilLog.textContent = lines.join("\n");
    councilLog.scrollTop = councilLog.scrollHeight;
  } catch (e) {
    councilLog.textContent = `Council log unavailable: ${e.message || String(e)}`;
  }
}

/* -----------------------------
   ✅ REAL GEO MAP (Leaflet/OSM)
----------------------------- */
const mapStatus = document.getElementById("mapStatus");

let map = null;
let userMarker = null;
let nightLayer = null;

function solarSubpointUTC(d) {
  // same approximate as before, but we only use longitude for a simple night band
  const timeUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subLon = ((180 - timeUTC * 15) % 360 + 360) % 360; // 0..360
  const lon = subLon > 180 ? subLon - 360 : subLon; // -180..180
  return { lon };
}

function buildNightBandGeoJSON() {
  // Simple approx: night = longitudes where |Δlon| > 90 from subsolar lon.
  // We'll draw two big polygons that cover the night half-plane.
  const now = new Date();
  const { lon: sunLon } = solarSubpointUTC(now);

  // anti-solar center lon (middle of night)
  let nightCenter = sunLon + 180;
  if (nightCenter > 180) nightCenter -= 360;

  // night longitudes range: [nightCenter-90 .. nightCenter+90] is *centered* on night,
  // but we actually want the opposite of day, so this band is correct for a “night hemisphere”
  let west = nightCenter - 90;
  let east = nightCenter + 90;

  // Normalize to [-180..180] but handle wrap by splitting polygons if needed
  const polys = [];

  function poly(w, e) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[
          [w, -85],
          [e, -85],
          [e,  85],
          [w,  85],
          [w, -85],
        ]]
      }
    };
  }

  if (west < -180) {
    polys.push(poly(west + 360, 180));
    polys.push(poly(-180, east));
  } else if (east > 180) {
    polys.push(poly(west, 180));
    polys.push(poly(-180, east - 360));
  } else {
    polys.push(poly(west, east));
  }

  return { type: "FeatureCollection", features: polys };
}

function initMap(lat, lon) {
  if (!window.L) {
    if (mapStatus) mapStatus.textContent = "Map failed (Leaflet missing)";
    return;
  }

  map = L.map("map", { zoomControl: true }).setView([lat, lon], 7);

  // OSM tiles (no key)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  userMarker = L.circleMarker([lat, lon], {
    radius: 8,
    weight: 2,
    color: "rgba(53,232,255,0.95)",
    fillColor: "rgba(53,232,255,0.95)",
    fillOpacity: 0.85,
  }).addTo(map);

  userMarker.bindPopup("You are here").openPopup();

  // Night band overlay
  nightLayer = L.geoJSON(buildNightBandGeoJSON(), {
    style: {
      color: "rgba(0,0,0,0)",
      weight: 0,
      fillColor: "rgba(0,0,0,0.45)",
      fillOpacity: 0.45,
    },
    interactive: false,
  }).addTo(map);

  if (mapStatus) mapStatus.textContent = "Map running (geolocation)";
}

function updateNightBand() {
  if (!nightLayer) return;
  nightLayer.clearLayers();
  nightLayer.addData(buildNightBandGeoJSON());
}

(async () => {
  const pos = await getPosition();

  // If blocked, default near Camp Lejeune as a friendly fallback
  const fallback = { lat: 34.632, lon: -77.340 }; // Camp Lejeune area approx
  const lat = pos?.coords?.latitude ?? fallback.lat;
  const lon = pos?.coords?.longitude ?? fallback.lon;

  initMap(lat, lon);
  updateNightBand();
  setInterval(updateNightBand, 60 * 1000); // refresh night band every minute
})();

// Make Leaflet resize correctly if iOS changes layout
window.addEventListener("resize", () => {
  setTimeout(() => map?.invalidateSize?.(), 200);
});