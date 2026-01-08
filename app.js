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

// ✅ Council Log
const btnCouncilLog = document.getElementById("btnCouncilLog");
const councilOverlay = document.getElementById("councilOverlay");
const councilText = document.getElementById("councilText");
const btnCloseCouncil = document.getElementById("btnCloseCouncil");

// Map
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

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

/* ✅ Council modal */
function openCouncil() {
  councilOverlay?.classList.remove("hidden");
}
function closeCouncil() {
  councilOverlay?.classList.add("hidden");
}

btnCouncilLog?.addEventListener("click", async () => {
  // ✅ feels right: close drawer then open modal
  closeDrawer();
  openCouncil();
  await refreshCouncilLog();
});

btnCloseCouncil?.addEventListener("click", closeCouncil);

// tap outside the modal to close
councilOverlay?.addEventListener("click", (e) => {
  if (e.target === councilOverlay) closeCouncil();
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
let lastSessionId = "default";

async function sendMessage() {
  const msg = (promptEl?.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg, session_id: lastSessionId });
    if (!out.ok) {
      log(`! error: ${out.error || "unknown"}`);
      return;
    }

    if (out?.meta?.council_used) {
      log(`[council] tools: ${(out.meta.tools_called || []).join(", ") || "none"}`);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
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
  return zones.map((z) => {
    const fmt = new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: z.tz,
    });
    return `${z.name} ${fmt.format(now)}`;
  }).join("   •   ");
}
function refreshWorldTime() {
  if (!timeTrack) return;
  const line = buildWorldTimeLine();
  timeTrack.textContent = line + "   •   " + line;
}
refreshWorldTime();
setInterval(refreshWorldTime, 1000);

/* News */
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

/* ✅ Council log fetch */
async function refreshCouncilLog() {
  if (!councilText) return;
  councilText.textContent = "Loading…";
  try {
    const data = await apiGet(`/council/last?session_id=${encodeURIComponent(lastSessionId)}`);
    const last = data?.last;
    if (!last) {
      councilText.textContent = "No council log yet for this session.";
      return;
    }
    councilText.textContent = JSON.stringify(last, null, 2);
  } catch (e) {
    councilText.textContent = `Council log unavailable: ${e.message || String(e)}`;
  }
}

/* Map (unchanged from your current working version)
   Keep your existing map code below this line if you prefer.
   (I’m not touching it here since your ask was specifically the Council Log UI.)
*/