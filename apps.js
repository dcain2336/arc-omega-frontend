// app.js

const API_BASE =
  (localStorage.getItem("ARC_API_BASE") || "").trim() ||
  "https://arc-omega-api.dcain1.workers.dev"; // <-- your CF worker API

const $ = (id) => document.getElementById(id);

const apiBaseEl = $("apiBase");
const upstreamTxt = $("upstreamTxt");
const systemOut = $("systemOut");
const chatIn = $("chatIn");
const sendBtn = $("sendBtn");
const weatherLine = $("weatherLine");
const newsLine = $("newsLine");
const timeTicker = $("timeTicker");
const globeHint = $("globeHint");

apiBaseEl.textContent = API_BASE;

// Stable IDs
function getOrMake(key, makeFn) {
  let v = localStorage.getItem(key);
  if (!v) {
    v = makeFn();
    localStorage.setItem(key, v);
  }
  return v;
}
const user_id = getOrMake("arc_user_id", () => "u_" + Math.random().toString(36).slice(2, 10));
const session_id = getOrMake("arc_session_id", () => "s_" + Math.random().toString(36).slice(2, 10));

// ----------------- Helpers -----------------
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch (e) {}
  if (!r.ok) {
    const msg = j ? JSON.stringify(j) : text;
    throw new Error(`HTTP ${r.status}: ${msg}`);
  }
  return j ?? {};
}

function logSystem(msg) {
  const ts = new Date().toLocaleTimeString();
  systemOut.textContent = `[${ts}] ${msg}\n` + systemOut.textContent;
}

// ----------------- Weather / News / Time -----------------
async function refreshWeather() {
  try {
    const j = await fetchJSON(`${API_BASE}/weather`);
    // expected: { ok:true, line:"City · 52°F · clear sky · RH 83% · Wind 6 mph" }
    weatherLine.textContent = j.line || "Weather unavailable.";
  } catch (e) {
    weatherLine.textContent = "Weather error.";
  }
}

async function refreshNews() {
  try {
    const j = await fetchJSON(`${API_BASE}/news`);
    // expected: { ok:true, headlines:[...], provider:"..." }
    const heads = Array.isArray(j.headlines) ? j.headlines : [];
    if (!heads.length) {
      newsLine.textContent = "No headlines returned.";
    } else {
      newsLine.textContent = heads[0];
    }
  } catch (e) {
    newsLine.textContent = "News error.";
  }
}

function buildTimeTicker() {
  // Required cities/zones:
  const zones = [
    { label: "Local", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { label: "ET", tz: "America/New_York" },
    { label: "CT", tz: "America/Chicago" },
    { label: "MT", tz: "America/Denver" },
    { label: "PT", tz: "America/Los_Angeles" },
    { label: "UTC", tz: "UTC" },
    { label: "London", tz: "Europe/London" },
    { label: "Paris", tz: "Europe/Paris" },
    { label: "Dubai", tz: "Asia/Dubai" },
    { label: "Seoul", tz: "Asia/Seoul" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
    { label: "Guam", tz: "Pacific/Guam" },
    { label: "Manila", tz: "Asia/Manila" },
  ];

  const fmt = (tz) =>
    new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date());

  function render() {
    const parts = zones.map((z) => `${z.label} ${fmt(z.tz)}`);
    // repeat twice so ticker is continuous
    timeTicker.textContent = parts.join("  •  ") + "  •  " + parts.join("  •  ");
  }

  render();
  setInterval(render, 1000);
}

// ----------------- Chat -----------------
async function sendMessage() {
  const text = (chatIn.value || "").trim();
  if (!text) return;

  chatIn.value = "";
  logSystem(`Sending: ${text}`);

  try {
    // ✅ FIX: backend expects "message" (not "prompt")
    const payload = {
      message: text,
      user_id,
      session_id,
    };

    const j = await fetchJSON(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (j.upstream) upstreamTxt.textContent = j.upstream;
    if (j.provider || j.model) {
      upstreamTxt.textContent = `${j.provider || "?"}/${j.model || "?"}`;
    }

    const answer = j.answer || j.response || j.text || "(no answer)";
    logSystem(`ARC: ${answer}`);
  } catch (e) {
    logSystem(`Send failed: ${String(e.message || e)}`);
  }
}

sendBtn.addEventListener("click", sendMessage);
chatIn.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") sendMessage();
});

// ----------------- Globe -----------------
let globe = null;
let globeData = {
  points: [],
  arcs: [],
};

function initGlobe() {
  const el = $("globe");
  const w = el.clientWidth || 600;
  const h = el.clientHeight || 360;

  globe = Globe()(el)
    .width(w)
    .height(h)
    .backgroundColor("rgba(0,0,0,0)")
    .showAtmosphere(true)
    .atmosphereAltitude(0.16)
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
    .pointsData(globeData.points)
    .pointLat("lat")
    .pointLng("lng")
    .pointAltitude(0.02)
    .pointRadius(0.6)
    .pointColor(() => "rgba(0,220,255,0.9)")
    .arcsData(globeData.arcs)
    .arcStartLat("startLat")
    .arcStartLng("startLng")
    .arcEndLat("endLat")
    .arcEndLng("endLng")
    .arcAltitude("alt")
    .arcStroke(0.7)
    .arcColor(() => ["rgba(0,220,255,0.35)", "rgba(0,220,255,0.05)"])
    .arcDashLength(0.4)
    .arcDashGap(2)
    .arcDashAnimateTime(2400);

  // default: world view
  globe.pointOfView({ lat: 10, lng: 0, altitude: 2.1 }, 0);

  // light + performance
  globe.controls().enableDamping = true;
  globe.controls().dampingFactor = 0.08;
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.35;

  globeHint.textContent = "Globe ready. Requesting location…";

  // Reflow on resize/orientation
  window.addEventListener("resize", () => {
    if (!globe) return;
    globe.width(el.clientWidth);
    globe.height(el.clientHeight);
  });
}

function setPinnedLocation(lat, lng) {
  globeData.points = [{ lat, lng, name: "You" }];
  globeData.arcs = [
    { startLat: lat, startLng: lng, endLat: 10, endLng: 0, alt: 0.25 },
  ];
  globe.pointsData(globeData.points);
  globe.arcsData(globeData.arcs);

  globe.pointOfView({ lat, lng, altitude: 1.25 }, 900);
  globeHint.textContent = `Pinned: ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function requestGeo() {
  if (!navigator.geolocation) {
    globeHint.textContent = "Geolocation unavailable. Showing world view.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      setPinnedLocation(latitude, longitude);
    },
    () => {
      globeHint.textContent = "Location denied. Showing world view.";
    },
    { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
  );
}

// ----------------- Boot -----------------
(async function boot() {
  buildTimeTicker();
  initGlobe();
  requestGeo();

  await refreshWeather();
  await refreshNews();

  // refresh periodically
  setInterval(refreshWeather, 60 * 1000);
  setInterval(refreshNews, 90 * 1000);

  logSystem(`HUD ready. user_id=${user_id} session_id=${session_id}`);
})();