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

// Tools / Blackout UI
const panelTools = document.getElementById("panelTools");
const btnTools = document.getElementById("btnTools");
const btnCloseTools = document.getElementById("btnCloseTools");
const btnBlackout = document.getElementById("btnBlackout");
const blackout = document.getElementById("blackout");
const toolsLog = document.getElementById("toolsLog");
const btnToolWeather = document.getElementById("btnToolWeather");
const btnToolNews = document.getElementById("btnToolNews");

// Globe UI
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const globeMeta = document.getElementById("globeMeta");
const ctx = canvas.getContext("2d");

apiUrlText.textContent = API_BASE;

function log(line) {
  terminal.textContent += `${line}\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

function toolMsg(s) {
  if (!toolsLog) return;
  toolsLog.textContent = s;
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

// --------------------
// Panel + Blackout wiring
// --------------------
function toggleHidden(el) { if (el) el.classList.toggle("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

btnTools?.addEventListener("click", () => toggleHidden(panelTools));
btnCloseTools?.addEventListener("click", () => hide(panelTools));

btnBlackout?.addEventListener("click", () => toggleHidden(blackout));
blackout?.addEventListener("click", () => blackout.classList.add("hidden"));

// --------------------
// Backend status polling (throttled)
// --------------------
async function refreshBackendStatus() {
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
setInterval(refreshBackendStatus, 10000);

// --------------------
// Send message
// --------------------
async function sendMessage() {
  const msg = (promptEl.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg, provider: "auto" });

    if (!out.ok) {
      // This is the "providers missing / no providers succeeded" case.
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

// --------------------
// Browser geolocation helper
// --------------------
let lastLoc = null;

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 5 * 60 * 1000
    });
  });
}

async function refreshLocation() {
  try {
    const pos = await getPosition();
    lastLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    return lastLoc;
  } catch {
    lastLoc = null;
    return null;
  }
}

// --------------------
// Weather (Open-Meteo) using browser geolocation
// --------------------
async function refreshWeather() {
  try {
    const loc = lastLoc || await refreshLocation();
    if (!loc) throw new Error("no location");

    const { lat, lon } = loc;

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
    toolMsg("Weather refreshed");
  } catch (e) {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
    toolMsg("Weather failed (location blocked?)");
  }
}

btnToolWeather?.addEventListener("click", refreshWeather);

refreshWeather();
setInterval(refreshWeather, 600000); // every 10 minutes

// --------------------
// News ticker (GDELT 2.1)
// NOTE: Some browsers/networks block this via CORS. If so, you should proxy via backend.
// --------------------
async function refreshNews() {
  try {
    // ✅ fixed URL (removed duplicate format=json)
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc" +
      "?query=sourceCountry:US" +
      "&mode=ArtList" +
      "&format=json" +
      "&maxrecords=10";

    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const arts = data.articles || [];
    if (!arts.length) {
      newsTrack.textContent = "No headlines right now";
      toolMsg("News refreshed (empty feed)");
      return;
    }

    const titles = arts.map(a => a.title).filter(Boolean);
    const line = " • " + titles.join(" • ") + " • ";
    newsTrack.textContent = line;
    toolMsg("News refreshed");
  } catch (e) {
    // CORS often looks like: TypeError: Failed to fetch
    const msg = String(e?.message || e);
    if (msg.includes("Failed to fetch")) {
      newsTrack.textContent = "News unavailable (likely CORS-blocked). Use backend proxy /tools/news to fix.";
    } else {
      newsTrack.textContent = "News unavailable";
    }
    toolMsg("News failed");
  }
}

btnToolNews?.addEventListener("click", refreshNews);

refreshNews();
setInterval(refreshNews, 300000); // every 5 minutes

// --------------------
// Globe canvas (location dot + day/night terminator + wave line)
// --------------------
let animId = null;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// math helpers
const DEG = Math.PI / 180;

function normLon(lon) {
  // normalize to [-180, 180)
  let x = lon;
  while (x < -180) x += 360;
  while (x >= 180) x -= 360;
  return x;
}

// Approx solar subpoint (good enough for UI day/night)
// Returns { lat, lon } in degrees where sun is overhead
function solarSubpoint(date) {
  // Based on a compact approximation (not high-precision astronomy)
  const ms = date.getTime();
  const d = ms / 86400000.0 - 10957.5; // days since ~2000-01-01 noon-ish baseline
  const g = (357.529 + 0.98560028 * d) * DEG; // mean anomaly
  const q = (280.459 + 0.98564736 * d) * DEG; // mean longitude
  const L = q + (1.915 * DEG) * Math.sin(g) + (0.020 * DEG) * Math.sin(2 * g); // ecliptic long
  const e = 23.439 * DEG; // obliquity

  // declination
  const sinDec = Math.sin(e) * Math.sin(L);
  const dec = Math.asin(sinDec);

  // equation of time-ish to get subsolar lon
  const RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const GMST = (18.697374558 + 24.06570982441908 * d) % 24; // hours
  const subLon = normLon((RA / DEG) - (GMST * 15)); // degrees

  return { lat: dec / DEG, lon: subLon };
}

// Orthographic projection of lat/lon onto circle
function project(lat, lon, centerLat, centerLon) {
  // all in radians
  const φ = lat * DEG;
  const λ = lon * DEG;
  const φ0 = centerLat * DEG;
  const λ0 = centerLon * DEG;

  const cosc =
    Math.sin(φ0) * Math.sin(φ) +
    Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);

  // behind the globe
  if (cosc < 0) return null;

  const x = Math.cos(φ) * Math.sin(λ - λ0);
  const y =
    Math.cos(φ0) * Math.sin(φ) -
    Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0);

  return { x, y };
}

let t = 0;

async function draw() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  // Decide globe "center" so your location is near center when available
  const loc = lastLoc || null;
  const centerLat = loc ? loc.lat : 15;
  const centerLon = loc ? loc.lon : -30;

  // base globe outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // grid lines (lat)
  for (let i = -2; i <= 2; i++) {
    const y = cy + (i * r * 0.28);
    const rx = Math.sqrt(Math.max(0, r*r - (y - cy)*(y - cy)));
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, 1, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();
  }

  // --------------------
  // Day/Night terminator shading
  // --------------------
  const sun = solarSubpoint(new Date());
  // Terminator in this 2D projection is perpendicular to sun direction projected.
  // We'll approximate by taking the sun vector projected into the screen and shading the opposite half.
  const sunProj = project(sun.lat, sun.lon, centerLat, centerLon);

  if (sunProj) {
    const ang = Math.atan2(sunProj.y, sunProj.x); // direction toward sun on the disk
    // Night side is opposite the sun
    const nightAngle = ang + Math.PI;

    // Clip to globe circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // rotate and shade half-plane
    ctx.translate(cx, cy);
    ctx.rotate(nightAngle);

    // a soft gradient for night
    const grad = ctx.createLinearGradient(0, 0, r, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.38)");
    grad.addColorStop(1, "rgba(0,0,0,0.00)");
    ctx.fillStyle = grad;

    // fill the half that represents night
    ctx.fillRect(-r, -r, r, 2*r);

    ctx.restore();

    // --------------------
    // "Ham lock" wave line on terminator
    // --------------------
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Terminator line direction (perpendicular to sun direction)
    const termAngle = ang + Math.PI / 2;

    ctx.translate(cx, cy);
    ctx.rotate(termAngle);

    ctx.beginPath();
    const amp = r * 0.04;
    const len = r * 1.25;
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = -len/2 + (len * i / steps);
      const y = Math.sin((i / steps) * Math.PI * 6 + t) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // --------------------
  // Location dot (your pin)
  // --------------------
  if (loc) {
    const p = project(loc.lat, loc.lon, centerLat, centerLon);
    if (p) {
      const px = cx + p.x * r;
      const py = cy + p.y * r;

      // glow ring
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // core
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();

      globeMeta.textContent = `Pinned • lat ${loc.lat.toFixed(3)} • lon ${loc.lon.toFixed(3)}`;
    } else {
      globeMeta.textContent = "Location on far side of globe (not visible)";
    }
  } else {
    globeMeta.textContent = "Location not available (allow location to pin)";
  }

  // Keep a tiny “satellite” dot so you still get motion even if location is blocked
  // (this replaces the confusing old orbit dot: it's explicitly a satellite)
  const sx = cx + Math.cos(t) * (r * 1.10);
  const sy = cy + Math.sin(t) * (r * 0.55);
  ctx.beginPath();
  ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();

  statusEl.textContent = "Running (day/night + location pin)";
  t += 0.02;
  animId = requestAnimationFrame(draw);
}

// Kick things off: get location once, then render loop
(async () => {
  await refreshLocation();
  draw();
  // refresh location occasionally so it can update if you move / permissions change
  setInterval(refreshLocation, 5 * 60 * 1000);
})();
