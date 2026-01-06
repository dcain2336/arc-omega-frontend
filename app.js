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
const globeStatus = document.getElementById("globeStatus");

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
    cache: "no-store",
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

// --------------------
// Backend status polling
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

// Node health view (optional, shown in globe status)
async function refreshNodeStatus() {
  try {
    const data = await apiGet("/nodes");
    const nodes = data.nodes || [];
    const up = nodes.filter(n => n.ok === true).map(n => n.name).join(", ");
    globeStatus.textContent = up ? `Node up: ${up}` : "Node down (cloud fallback)";
  } catch {
    globeStatus.textContent = "Node status unavailable";
  }
}
refreshNodeStatus();
setInterval(refreshNodeStatus, 30000);

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
      return;
    }
    if (out.provider) log(`[via ${out.provider}${out.model ? " / " + out.model : ""}]`);
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

    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, { cache: "no-store" });
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
setInterval(refreshWeather, 600000);

// --------------------
// News ticker (from backend, so your key stays secret)
// --------------------
async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data.headlines || [];
    if (!headlines.length) {
      newsTrack.textContent = "No headlines right now";
      return;
    }
    newsTrack.textContent = " • " + headlines.join(" • ") + " • ";
  } catch {
    newsTrack.textContent = "News unavailable";
  }
}
refreshNews();
setInterval(refreshNews, 600000);

// --------------------
// Globe placeholder (stable canvas animation)
// --------------------
const canvas = document.getElementById("globeCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let t = 0;
function draw() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.33;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // “day/night” hint band (visual only)
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.95, r * 0.35, Math.sin(t) * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();

  // orbit dot (just a UI effect)
  const ox = cx + Math.cos(t) * (r * 1.2);
  const oy = cy + Math.sin(t) * (r * 0.6);
  ctx.beginPath();
  ctx.arc(ox, oy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  t += 0.02;
  requestAnimationFrame(draw);
}
draw();