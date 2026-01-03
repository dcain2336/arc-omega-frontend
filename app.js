// =====================
// CONFIG
// =====================

// Put your preferred backends first. Frontend will try them in order.
// If a base returns non-OK, it moves to the next.
const API_BASES = [
  "https://arc-omega-api.dcain1.workers.dev",      // Worker (preferred if stable)
  "https://arc-omega-backend.onrender.com"         // Render fallback
];

// If you want the ticker slightly faster/slower without touching CSS,
// you can override duration here (in seconds). null => use CSS.
const TICKER_SECONDS_OVERRIDE = 30; // try 28-38 range; set null to disable override.

// =====================
// Helpers
// =====================
const $ = (id) => document.getElementById(id);

function log(line) {
  const el = $("consoleOut");
  el.textContent = (el.textContent ? el.textContent + "\n" : "") + line;
}

async function fetchFirstOk(path, opts = {}) {
  let lastErr = null;
  for (const base of API_BASES) {
    try {
      const url = base.replace(/\/$/, "") + path;
      const res = await fetch(url, opts);
      if (!res.ok) {
        lastErr = `${base}${path} -> HTTP ${res.status}`;
        continue;
      }
      $("apiBaseLabel").textContent = base;
      return { base, res, json: await res.json() };
    } catch (e) {
      lastErr = `${base}${path} -> ${String(e)}`;
    }
  }
  throw new Error(lastErr || "all API bases failed");
}

function pad2(n){ return String(n).padStart(2, "0"); }

// =====================
// Time ticker (NO API)
// =====================
const TIME_ZONES = [
  { label: "Local", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "ET",    tz: "America/New_York" },
  { label: "CT",    tz: "America/Chicago" },
  { label: "MT",    tz: "America/Denver" },
  { label: "PT",    tz: "America/Los_Angeles" },
  { label: "UTC",   tz: "UTC" },
  { label: "London",tz: "Europe/London" },
  { label: "Paris", tz: "Europe/Paris" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Manila",tz: "Asia/Manila" },
  { label: "Guam",  tz: "Pacific/Guam" },
  { label: "Seoul", tz: "Asia/Seoul" },
  { label: "Tokyo", tz: "Asia/Tokyo" }
];

function formatTime(tz) {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz
  });
  return fmt.format(d);
}

function updateTicker() {
  const parts = TIME_ZONES.map(z => `${z.label} ${formatTime(z.tz)}`);
  $("timeTicker").textContent = parts.join("  •  ");
}

// =====================
// Weather (Open-Meteo + reverse geocode)
// =====================
async function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  // Nominatim (free). Be polite.
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;
  const j = await res.json();
  const a = j.address || {};
  return a.neighbourhood || a.suburb || a.city_district || a.village || a.town || a.city || a.county || a.state || null;
}

async function loadWeather() {
  try {
    const loc = await getBrowserLocation();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const j = await res.json();

    const cur = j.current || {};
    const temp = (cur.temperature_2m ?? "—");
    const wind = (cur.wind_speed_10m ?? "—");

    const place = await reverseGeocode(loc.lat, loc.lon);
    const placeLabel = place ? `${place} · ` : "";

    $("weatherLine").textContent = `${placeLabel}${temp}°F · Wind ${wind} mph`;
    $("weatherMeta").textContent = `Source: Open-Meteo (browser geolocation)`;
  } catch (e) {
    $("weatherLine").textContent = "Weather error";
    $("weatherMeta").textContent = String(e);
  }
}

// =====================
// News (GDELT 2.1, no key)
// =====================
async function loadNews() {
  try {
    // Major geopolitics-ish query. You can tweak terms.
    const query = encodeURIComponent(
      '(war OR conflict OR missile OR sanctions OR coup OR "state of emergency" OR earthquake OR hurricane OR "major incident")'
    );

    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}` +
      `&mode=ArtList&format=json&maxrecords=8&sort=HybridRel`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);
    const j = await res.json();

    const arts = (j.articles || []).slice(0, 5);
    if (!arts.length) {
      $("newsLine").textContent = "No headlines returned.";
      $("newsMeta").textContent = "Source: GDELT";
      return;
    }

    // Build a single-line ticker-ish display
    const titles = arts.map(a => a.title).filter(Boolean);
    $("newsLine").textContent = titles.join("  •  ");
    $("newsMeta").textContent = "Source: GDELT 2.1 (public)";
  } catch (e) {
    $("newsLine").textContent = "News error";
    $("newsMeta").textContent = String(e);
  }
}

// =====================
// Globe
// =====================
async function initGlobe() {
  const mount = $("globeMount");

  const world = Globe()(mount)
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
    .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
    .atmosphereColor("#00a6b4")
    .atmosphereAltitude(0.18);

  // try to pin to browser location
  try {
    const loc = await getBrowserLocation();
    world
      .pointsData([{ lat: loc.lat, lng: loc.lon, size: 0.6, color: "#35d07f" }])
      .pointAltitude("size")
      .pointColor("color");

    world.pointOfView({ lat: loc.lat, lng: loc.lon, altitude: 1.9 }, 1200);
    $("globeMeta").textContent = "Pinned to your location (browser geolocation).";
  } catch {
    world.pointOfView({ lat: 15, lng: 120, altitude: 2.2 }, 1200);
    $("globeMeta").textContent = "World view (no location permission).";
  }

  // Resize handling
  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    world.width(w);
    world.height(h);
  }
  window.addEventListener("resize", resize);
  resize();
}

// =====================
// Command Center: Ping + Send
// =====================
async function doPing() {
  try {
    log("> Ping");
    const { base, json } = await fetchFirstOk("/ping", { method: "GET" });
    $("upstreamLabel").textContent = "ok";
    log(`${base}/ping -> ${JSON.stringify(json)}`);
  } catch (e) {
    $("upstreamLabel").textContent = "error";
    log(`send error: ${String(e)}`);
  }
}

async function doSend() {
  const msg = ($("chatIn").value || "").trim();
  if (!msg) return;

  try {
    log(`> ${msg}`);

    const body = JSON.stringify({
      message: msg,
      session_id: "web"
    });

    const { base, json } = await fetchFirstOk("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    if (json && json.text) {
      log(json.text);
    } else {
      log(`${base}/query -> ${JSON.stringify(json)}`);
    }
  } catch (e) {
    log(`send error: ${String(e)}`);
  }
}

// =====================
// Boot
// =====================
(function main() {
  if (TICKER_SECONDS_OVERRIDE !== null) {
    // override ticker animation duration at runtime
    $("timeTicker").style.animationDuration = `${TICKER_SECONDS_OVERRIDE}s`;
  }

  updateTicker();
  setInterval(updateTicker, 1000);

  loadWeather();
  // refresh weather/news periodically (resilient + light)
  setInterval(loadWeather, 10 * 60 * 1000); // 10 min

  loadNews();
  setInterval(loadNews, 12 * 60 * 1000); // 12 min

  initGlobe();

  $("sendBtn").addEventListener("click", doSend);
  $("chatIn").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
  });

  doPing();
})();