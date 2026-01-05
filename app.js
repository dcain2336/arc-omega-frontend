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
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

// --------------------
// Backend status polling
// - ping verifies server up
// - candidates verifies at least one usable provider key
// --------------------
async function refreshBackendStatus() {
  try {
    const ping = await apiGet("/ping");
    if (!ping.ok) throw new Error("ping not ok");

    const cand = await apiGet("/candidates");
    const providers = cand.providers || {};

    const anyKey =
      !!providers.openai?.key_present ||
      !!providers.openrouter?.key_present ||
      !!providers.groq?.key_present ||
      !!providers.huggingface?.key_present ||
      !!providers.anthropic?.key_present;

    upstreamText.textContent = anyKey ? "ok" : "keys missing";
    upstreamPill.classList.remove("bad");
    upstreamPill.classList.add(anyKey ? "ok" : "bad");
  } catch (e) {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}

// poll every 30s (stable)
refreshBackendStatus();
setInterval(refreshBackendStatus, 30000);

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
// Weather (Open-Meteo) using browser geolocation
// --------------------
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

async function refreshWeather() {
  try {
    const pos = await getPosition();
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
  } catch (e) {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}

refreshWeather();
setInterval(refreshWeather, 600000); // every 10 minutes

// --------------------
// News ticker (GDELT 2.1) - more stable URL + cache buster
// --------------------
async function refreshNews() {
  try {
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc" +
      "?query=sourceCountry:US%20language:English" +
      "&mode=ArtList" +
      "&format=json" +
      "&maxrecords=10" +
      "&sort=HybridRel" +
      `&cb=${Date.now()}`;

    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    const arts =
      data.articles ||
      data?.data?.articles ||
      [];

    if (!arts.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }

    const titles = arts.map(a => a.title).filter(Boolean).slice(0, 10);
    newsTrack.textContent = " • " + titles.join(" • ") + " • ";
  } catch (e) {
    newsTrack.textContent = "News unavailable";
  }
}

refreshNews();
setInterval(refreshNews, 600000); // every 10 minutes

// --------------------
// Globe + Ham-lock day/night terminator overlay
// --------------------
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas.getContext("2d");

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

function toRad(d){ return (d * Math.PI) / 180; }
function toDeg(r){ return (r * 180) / Math.PI; }

// Approx solar position -> subsolar lat/lon (good UI-grade)
function subsolarPoint(date = new Date()) {
  const d = (date.getTime() / 86400000) - 10957.5; // days since ~2000-01-01
  const g = toRad((357.529 + 0.98560028 * d) % 360);
  const q = toRad((280.459 + 0.98564736 * d) % 360);
  const L = q + toRad(1.915) * Math.sin(g) + toRad(0.020) * Math.sin(2 * g);
  const e = toRad(23.439 - 0.00000036 * d);

  const sinDec = Math.sin(e) * Math.sin(L);
  const dec = Math.asin(sinDec); // subsolar latitude

  const RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const GMST = (18.697374558 + 24.06570982441908 * d) % 24;
  const lon = ((toDeg(RA) / 15) - GMST) * 15;

  return { lat: toDeg(dec), lon: ((lon + 540) % 360) - 180 };
}

// optional: store last known user location for a pin on the globe
let userLoc = null;
(async () => {
  try {
    const pos = await getPosition();
    userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {}
})();

let t = 0;
function draw() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.33;

  // globe outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // latitude lines
  for (let i = -2; i <= 2; i++) {
    const y = cy + (i * r * 0.3);
    const rx = Math.sqrt(Math.max(0, r*r - (y - cy)*(y - cy)));
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, 1, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();
  }

  // --------------------
  // Ham-lock style day/night overlay (terminator + night shade)
  // --------------------
  const { lat: sunLat, lon: sunLon } = subsolarPoint(new Date());

  ctx.save();
  // clip to globe
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Build terminator curve
  ctx.beginPath();
  for (let i = 0; i <= 140; i++) {
    const lon = -180 + (360 * i) / 140;
    const dl = toRad(lon - sunLon);
    const sl = toRad(sunLat);

    // terminator latitude
    const phi = Math.atan2(-Math.cos(dl), Math.tan(sl));
    const lat = toDeg(phi);

    // project to disk (simple & good-looking)
    const x = cx + (lon / 180) * r;
    const y = cy - (lat / 90) * (r * 0.55);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // close shape to shade "night" side (stylistic)
  ctx.lineTo(cx + r, cy + r);
  ctx.lineTo(cx - r, cy + r);
  ctx.closePath();

  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fill();

  // draw terminator line
  ctx.beginPath();
  for (let i = 0; i <= 140; i++) {
    const lon = -180 + (360 * i) / 140;
    const dl = toRad(lon - sunLon);
    const sl = toRad(sunLat);
    const phi = Math.atan2(-Math.cos(dl), Math.tan(sl));
    const lat = toDeg(phi);

    const x = cx + (lon / 180) * r;
    const y = cy - (lat / 90) * (r * 0.55);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // user location pin (if we have it)
  if (userLoc) {
    const x = cx + (userLoc.lon / 180) * r;
    const y = cy - (userLoc.lat / 90) * (r * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.stroke();
  }

  ctx.restore();

  // moving “orbit” dot (keeps motion)
  const ox = cx + Math.cos(t) * (r * 1.2);
  const oy = cy + Math.sin(t) * (r * 0.6);
  ctx.beginPath();
  ctx.arc(ox, oy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  t += 0.02;
  animId = requestAnimationFrame(draw);
}

statusEl.textContent = "Running (stable)";
draw();