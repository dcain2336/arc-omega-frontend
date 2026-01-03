const API_BASE = "https://arc-omega-api.dcain1.workers.dev";
const $ = (id) => document.getElementById(id);

function getOrCreate(id, genFn) {
  let v = localStorage.getItem(id);
  if (!v) {
    v = genFn();
    localStorage.setItem(id, v);
  }
  return v;
}

const USER_ID = getOrCreate("arc_user_id", () => "u_" + Math.random().toString(36).slice(2, 10));
const SESSION_ID = getOrCreate("arc_session_id", () => "s_" + Math.random().toString(36).slice(2, 10));

function logSys(msg) {
  const el = $("sysLog");
  if (!el) return;
  el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
}

function addBubble(role, text) {
  const chat = $("chat");
  if (!chat) return;
  const b = document.createElement("div");
  b.className = "bubble " + role;
  b.textContent = text;
  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

async function fetchJSON(url, init) {
  const res = await fetch(url, init);
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: res.ok, status: res.status, headers: res.headers, data };
}

async function sendPrompt() {
  const input = $("prompt");
  const btn = $("send");
  if (!input) return;

  const prompt = (input.value || "").trim();
  if (!prompt) return;

  addBubble("user", prompt);
  input.value = "";
  if (btn) btn.disabled = true;

  try {
    const payload = { prompt, user_id: USER_ID, session_id: SESSION_ID };
    const r = await fetchJSON(API_BASE + "/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const upstream = r.headers.get("X-ARC-Upstream") || "—";
    $("metaUpstream").textContent = upstream;

    if (!r.ok) {
      logSys(`Error ${r.status}: ${JSON.stringify(r.data)}`);
      addBubble("arc", `Error ${r.status}: ${JSON.stringify(r.data)}`);
      return;
    }

    const reply =
      r.data?.response ??
      r.data?.final ??
      r.data?.text ??
      r.data?.raw ??
      JSON.stringify(r.data);

    addBubble("arc", reply);
  } catch (e) {
    logSys("send error: " + String(e));
    addBubble("arc", "Send failed: " + String(e));
  } finally {
    if (btn) btn.disabled = false;
  }
}

function toggle(el) { if (el) el.classList.toggle("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function setupPanels() {
  const panelSessions = $("panelSessions");
  const panelTools = $("panelTools");

  $("btnSessions")?.addEventListener("click", () => toggle(panelSessions));
  $("btnTools")?.addEventListener("click", () => toggle(panelTools));
  $("btnCloseSessions")?.addEventListener("click", () => hide(panelSessions));
  $("btnCloseTools")?.addEventListener("click", () => hide(panelTools));

  $("btnClearChat")?.addEventListener("click", () => {
    $("chat").innerHTML = "";
    logSys("chat cleared");
  });

  $("btnBlackout")?.addEventListener("click", () => {
    $("blackout")?.classList.toggle("hidden");
  });

  $("blackout")?.addEventListener("click", () => {
    $("blackout")?.classList.add("hidden");
  });
}

/* -------- Location -------- */
async function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 300000 }
    );
  });
}

/* -------- Weather -------- */
async function refreshWeather() {
  const loc = await getBrowserLocation();
  if (!loc) {
    $("tickerWeather").textContent = "Location blocked. Enable location for local weather.";
    return;
  }

  const url = `${API_BASE}/tools/weather?lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lon)}`;
  const r = await fetchJSON(url, { method: "GET" });

  if (!r.ok) {
    $("tickerWeather").textContent = `Weather error (${r.status})`;
    logSys(`weather error ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  const d = r.data || {};
  const parts = [];
  if (d.name) parts.push(d.name);
  if (d.temp_f != null) parts.push(`${Math.round(d.temp_f)}°F`);
  if (d.summary) parts.push(d.summary);
  if (d.humidity != null) parts.push(`RH ${d.humidity}%`);
  if (d.wind_mph != null) parts.push(`Wind ${Math.round(d.wind_mph)} mph`);

  $("tickerWeather").textContent = parts.join(" · ") || "—";
}

/* -------- News -------- */
async function refreshNews() {
  const r = await fetchJSON(API_BASE + "/tools/news", { method: "GET" });
  if (!r.ok) {
    $("tickerNews").textContent = `News error (${r.status})`;
    logSys(`news error ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }

  const headlines = r.data?.headlines || [];
  $("tickerNews").textContent = headlines.length ? headlines.join(" | ") : "—";
}

/* -------- World Time ticker -------- */
function buildWorldTimeLine() {
  // Includes local + US zones + UTC + Philippines/Guam/Seoul/Tokyo + major cities
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
  // Put the line into the scrolling ticker track
  const track = document.querySelector("#tickerTimeTrack");
  if (!track) return;
  track.textContent = buildWorldTimeLine() + "   •   " + buildWorldTimeLine(); // duplicate for smoother loop
}

/* -------- Map -------- */
let map = null;
let marker = null;

function initMap() {
  const el = $("map");
  if (!el || typeof L === "undefined") return;

  map = L.map("map", { zoomControl: true }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  getBrowserLocation().then((loc) => {
    if (!loc) return;
    map.setView([loc.lat, loc.lon], 11);
    marker = L.marker([loc.lat, loc.lon]).addTo(map);
    $("mapCaption").textContent = "Pinned to your location (browser geolocation).";
  });

  // Fix iOS / orientation render glitches
  setTimeout(() => map.invalidateSize(true), 400);
  window.addEventListener("orientationchange", () => setTimeout(() => map.invalidateSize(true), 400));
  window.addEventListener("resize", () => setTimeout(() => map.invalidateSize(true), 250));
}

/* -------- System Buttons -------- */
async function ping() {
  addBubble("user", "ping");
  const r = await fetchJSON(API_BASE + "/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "ping", user_id: USER_ID, session_id: SESSION_ID }),
  });

  const upstream = r.headers.get("X-ARC-Upstream") || "—";
  $("metaUpstream").textContent = upstream;

  if (!r.ok) {
    addBubble("arc", `Ping failed ${r.status}: ${JSON.stringify(r.data)}`);
    return;
  }
  addBubble("arc", r.data?.response || JSON.stringify(r.data));
}

async function testAPI() {
  const r = await fetchJSON(API_BASE + "/test", { method: "GET" });
  logSys("TEST: " + (r.ok ? "OK" : "FAIL") + " " + r.status);
  logSys(JSON.stringify(r.data, null, 2));
}

document.addEventListener("DOMContentLoaded", () => {
  $("metaApi").textContent = API_BASE;
  $("metaUpstream").textContent = "—";
  setupPanels();
  initMap();

  $("send")?.addEventListener("click", sendPrompt);
  $("prompt")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  $("btnPing")?.addEventListener("click", ping);
  $("btnTest")?.addEventListener("click", testAPI);

  $("btnToolWeather")?.addEventListener("click", refreshWeather);
  $("btnToolNews")?.addEventListener("click", refreshNews);
  $("btnToolWorldTime")?.addEventListener("click", refreshWorldTime);

  refreshNews();
  refreshWeather();
  refreshWorldTime();

  setInterval(refreshWorldTime, 1000);
  setInterval(refreshNews, 5 * 60 * 1000);
  setInterval(refreshWeather, 10 * 60 * 1000);
});