// app.js

// Use Worker as the primary aggregation layer:
const API_BASE = "https://arc-omega-api.dcain1.workers.dev"; // change if needed
document.getElementById("apiBaseLabel").textContent = API_BASE;

const weatherLine = document.getElementById("weatherLine");
const newsLine = document.getElementById("newsLine");
const newsList = document.getElementById("newsList");
const timeTicker = document.getElementById("timeTicker");
const consoleEl = document.getElementById("console");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

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

async function tryFetchJson(paths) {
  let lastErr = null;
  for (const path of paths) {
    try {
      const url = `${API_BASE}${path}`;
      const r = await fetch(url, { method: "GET" });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("fetch failed");
}

function pickFirst(obj, keys, fallback = undefined) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

async function refreshWeather() {
  try {
    const data = await tryFetchJson(["/weather", "/api/weather", "/v1/weather"]);

    if (data && data.ok === false) throw new Error(data.error || "weather error");

    // tolerate different schemas
    const loc = pickFirst(data, ["location", "city", "place", "name"], "Local");
    const tf = pickFirst(data, ["temp_f", "tempF", "temp", "temperature_f"], "—");
    const desc = pickFirst(data, ["desc", "description", "summary", "conditions"], "—");
    const rh = pickFirst(data, ["rh", "humidity", "humid"], "—");
    const wind = pickFirst(data, ["wind_mph", "wind", "windSpeed", "wind_speed_mph"], "—");

    weatherLine.textContent = `${loc} · ${tf}°F · ${desc} · RH ${rh}% · Wind ${wind} mph`;
    weatherLine.classList.remove("muted");
  } catch (e) {
    weatherLine.textContent = `Weather error`;
    weatherLine.classList.add("muted");
  }
}

async function refreshNews() {
  try {
    const data = await tryFetchJson(["/news", "/api/news", "/v1/news"]);

    if (data && data.ok === false) throw new Error(data.error || "news error");

    // tolerate: headlines array, articles array, or "data" object
    const headlines =
      pickFirst(data, ["headlines"], null) ||
      (Array.isArray(data?.articles) ? data.articles.map(a => a.title || String(a)).filter(Boolean) : null) ||
      (Array.isArray(data?.data) ? data.data.map(a => a.title || String(a)).filter(Boolean) : null) ||
      [];

    newsList.innerHTML = "";

    if (!headlines.length || (headlines.length === 1 && String(headlines[0]).toLowerCase().includes("no headlines"))) {
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

function buildTimeLineFromTimes(timesObj) {
  // prefer ordering
  const order = [
    "Local",
    "ET", "CT", "MT", "PT",
    "UTC",
    "London", "Paris", "Dubai",
    "Seoul", "Tokyo",
    "Guam",
    "Manila",
  ];
  const parts = [];
  for (const k of order) {
    if (timesObj[k]) parts.push(`${k} ${timesObj[k]}`);
  }
  // add anything else
  for (const [k, v] of Object.entries(timesObj)) {
    if (!order.includes(k)) parts.push(`${k} ${v}`);
  }
  return parts.join(" · ");
}

async function refreshTime() {
  try {
    const data = await tryFetchJson(["/time", "/worldtime", "/world_time", "/api/time", "/v1/time"]);

    if (data && data.ok === false) throw new Error(data.error || "time error");

    // tolerate: {line}, {times}, or {data:{times}}
    const line = pickFirst(data, ["line"], null) || pickFirst(data?.data, ["line"], null);
    if (line) {
      timeTicker.textContent = line;
      return;
    }

    const times =
      pickFirst(data, ["times"], null) ||
      pickFirst(data?.data, ["times"], null) ||
      null;

    if (times && typeof times === "object") {
      timeTicker.textContent = buildTimeLineFromTimes(times);
      return;
    }

    // fallback: if API returns array or something unexpected
    timeTicker.textContent = JSON.stringify(data).slice(0, 200);
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
      throw new Error(data.error || `${r.status} ${JSON.stringify(data).slice(0, 140)}`);
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

  globe.pointOfView({ lat: 20, lng: 0, altitude: 2.2 });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        globe.pointsData([{ lat, lng, size: 1 }]);
        globe.pointOfView({ lat, lng, altitude: 1.7 }, 1200);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }
}

initGlobe();


// Refresh loops
refreshWeather();
refreshNews();
refreshTime();

// Weather/news slower refresh
setInterval(refreshWeather, 60_000);
setInterval(refreshNews, 90_000);

// Time refresh often
setInterval(refreshTime, 10_000);