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
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

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

// poll every 10s (fixes your refresh storm)
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
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000 });
  });
}

async function refreshWeather() {
  try {
    const pos = await getPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
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
// News ticker (GDELT 2.1)
// --------------------
async function refreshNews() {
  try {
    // lightweight feed: last ~24h, English, top items
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=sourceCountry:US&mode=ArtList&format=json&maxrecords=10&format=json";
    const r = await fetch(url);
    const data = await r.json();
    const arts = data.articles || [];

    if (!arts.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }

    const titles = arts.map(a => a.title).filter(Boolean);
    const line = " • " + titles.join(" • ") + " • ";
    newsTrack.textContent = line;
  } catch (e) {
    newsTrack.textContent = "News unavailable";
  }
}

refreshNews();
setInterval(refreshNews, 300000); // every 5 minutes

// --------------------
// Simple globe (no re-init, no refresh storm)
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

// super-simple animated “globe” placeholder (keeps your UI stable)
// if you want the 3D lib later, we can swap this out safely.
let t = 0;
function draw() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.33;

  // globe
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

  // moving “orbit”
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