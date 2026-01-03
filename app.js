// app.js

// Pick which API the frontend uses.
// If your Worker is the aggregation layer, keep this as workers.dev.
// If you want to hit Render directly, put your Render base here.
const API_BASE = "https://arc-omega-api.dcain1.workers.dev"; // change if needed

document.getElementById("apiBaseLabel").textContent = API_BASE;

const weatherLine = document.getElementById("weatherLine");
const newsLine = document.getElementById("newsLine");
const newsList = document.getElementById("newsList");
const timeTicker = document.getElementById("timeTicker");
const consoleEl = document.getElementById("console");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

// Simple session id stored in localStorage (so it persists across refresh)
const SESSION_ID_KEY = "arc_session_id";
let sessionId = localStorage.getItem(SESSION_ID_KEY);
if (!sessionId) {
  sessionId = "s_" + Math.random().toString(36).slice(2);
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

function logLine(s) {
  const p = document.createElement("div");
  p.textContent = s;
  consoleEl.appendChild(p);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function fetchJson(path) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return await r.json();
}

async function refreshWeather() {
  try {
    const data = await fetchJson("/weather");
    // Expecting { ok, location, temp_f, desc, rh, wind_mph } (or similar)
    if (!data || data.ok === false) throw new Error(data?.error || "weather error");
    const loc = data.location || data.city || "Local";
    const tf = data.temp_f ?? data.tempF ?? data.temp ?? "—";
    const desc = data.desc || data.description || "—";
    const rh = data.rh ?? data.humidity ?? "—";
    const wind = data.wind_mph ?? data.wind ?? "—";
    weatherLine.textContent = `${loc} · ${tf}°F · ${desc} · RH ${rh}% · Wind ${wind} mph`;
    weatherLine.classList.remove("muted");
  } catch (e) {
    weatherLine.textContent = `Weather error`;
    weatherLine.classList.add("muted");
  }
}

async function refreshNews() {
  try {
    const data = await fetchJson("/news");
    newsList.innerHTML = "";

    if (!data || data.ok === false) throw new Error(data?.error || "news error");
    const headlines = data.headlines || [];
    if (!headlines.length) {
      newsLine.textContent = "No headlines returned.";
      newsLine.classList.add("muted");
      return;
    }
    newsLine.textContent = `Top headlines`;
    newsLine.classList.remove("muted");

    headlines.slice(0, 6).forEach((h) => {
      const div = document.createElement("div");
      div.className = "newsItem";
      div.textContent = h;
      newsList.appendChild(div);
    });
  } catch (e) {
    newsLine.textContent = "News error";
    newsLine.classList.add("muted");
    newsList.innerHTML = "";
  }
}

async function refreshTime() {
  try {
    const data = await fetchJson("/time");
    // Expect either { ok, line } or { ok, times: {...} }
    if (!data || data.ok === false) throw new Error(data?.error || "time error");

    if (data.line) {
      timeTicker.textContent = data.line;
      return;
    }

    // build a line if times object exists
    const t = data.times || {};
    const parts = [];
    for (const [k, v] of Object.entries(t)) {
      parts.push(`${k} ${v}`);
    }
    timeTicker.textContent = parts.join(" · ") || "—";
  } catch (e) {
    timeTicker.textContent = "Time error";
  }
}

// Chat: POST /query with {message, session_id}
async function sendChat() {
  const msg = (chatInput.value || "").trim();
  if (!msg) return;

  chatInput.value = "";
  logLine(`> ${msg}`);

  try {
    const r = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ message: msg, session_id: sessionId })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      throw new Error(data.error || `${r.status} ${JSON.stringify(data).slice(0, 120)}`);
    }
    logLine(data.text || "(no text)");
  } catch (e) {
    logLine(`send error: ${e}`);
  }
}

sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});


// -----------------
// Globe
// -----------------
function initGlobe() {
  const globeEl = document.getElementById("globe");

  const globe = Globe()(globeEl)
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
    .backgroundColor("rgba(0,0,0,0)")
    .pointAltitude(0.03)
    .pointRadius(0.7);

  // Default world view
  globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 });

  // Pin to location when allowed
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        globe.pointsData([{ lat, lng, size: 1 }]);
        globe.pointOfView({ lat, lng, altitude: 1.7 }, 1200);
      },
      () => {
        // no permission -> keep world view
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }
}

initGlobe();


// Refresh loops
refreshWeather();
refreshNews();
refreshTime();

// Weather + news can refresh slower
setInterval(refreshWeather, 60_000);
setInterval(refreshNews, 90_000);

// Time refresh often (but ticker handles motion)
setInterval(refreshTime, 10_000);