// ========= CONFIG =========
const API_BASE = "https://arc-omega-backend.onrender.com"; // <- change if needed
const TIME_TICKER_PX_PER_SEC = 85; // <- speed knob (higher = faster)
const NEWS_MAX = 6;

// For Open-Meteo: if geolocation fails, use Camp Lejeune-ish
const FALLBACK_COORDS = { lat: 34.75, lon: -77.43, label: "Onslow County" };

// ========= DOM =========
const apiBaseText = document.getElementById("apiBaseText");
const upstreamText = document.getElementById("upstreamText");
const consoleOut = document.getElementById("consoleOut");
const promptIn = document.getElementById("promptIn");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");
const weatherSource = document.getElementById("weatherSource");

const newsText = document.getElementById("newsText");
const newsSource = document.getElementById("newsSource");

const timeTicker = document.getElementById("timeTicker");

apiBaseText.textContent = API_BASE;

// ========= UTIL =========
function log(line) {
  consoleOut.textContent += (consoleOut.textContent ? "\n" : "") + line;
  consoleOut.scrollTop = consoleOut.scrollHeight;
}

async function safeFetchJson(url, opts) {
  const res = await fetch(url, { ...opts, mode: "cors" });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    const msg = data?.detail || data?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

// ========= UPSTREAM HEALTH =========
async function checkUpstream() {
  try {
    const data = await safeFetchJson(`${API_BASE}/ping`);
    upstreamText.textContent = "ok";
    log(`> Ping\n${API_BASE}/ping -> ${JSON.stringify(data)}`);
  } catch (e) {
    upstreamText.textContent = "down";
    log(`> Ping\n${API_BASE}/ping -> ERROR: ${e.message}`);
  }
}

// ========= COMMAND CENTER =========
async function sendToArc() {
  const msg = (promptIn.value || "").trim();
  if (!msg) return;

  promptIn.value = "";
  log(`\n> User\n${msg}`);

  try {
    const payload = { message: msg, session_id: "web", provider: null, model: null };
    const data = await safeFetchJson(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (data?.ok) {
      log(`\n> ARC (${data.provider}/${data.model})\n${data.text}`);
    } else {
      log(`\n> ARC ERROR\n${data?.error || "unknown error"}`);
    }
  } catch (e) {
    log(`\n> Send error\n${e.message}`);
  }
}

sendBtn.addEventListener("click", sendToArc);
promptIn.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendToArc();
});

// ========= WEATHER (Open-Meteo) =========
async function getCoords() {
  // Browser geolocation
  const geo = await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your area" }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
    );
  });
  return geo || FALLBACK_COORDS;
}

async function loadWeather() {
  try {
    const { lat, lon, label } = await getCoords();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,wind_speed_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const data = await safeFetchJson(url);

    const t = data?.current?.temperature_2m;
    const w = data?.current?.wind_speed_10m;

    weatherText.textContent = `${label} · ${t ?? "?"}°F · Wind ${w ?? "?"} mph`;
    weatherSource.textContent = `Source: Open-Meteo (browser geolocation)`;
  } catch (e) {
    weatherText.textContent = "Weather error";
    weatherSource.textContent = e.message;
  }
}

// ========= NEWS (GDELT 2.1) =========
function cleanTitle(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function loadNews() {
  try {
    // Simple public endpoint; no key required
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=sourceCountry:US&mode=ArtList&format=json&maxrecords=${NEWS_MAX}`;
    const data = await safeFetchJson(url);

    const arts = data?.articles || [];
    if (!arts.length) {
      newsText.textContent = "No headlines returned.";
      newsSource.textContent = "Source: GDELT 2.1 (public)";
      return;
    }

    // Build a readable list
    const lines = arts.slice(0, NEWS_MAX).map((a) => {
      const title = cleanTitle(a?.title) || cleanTitle(a?.seendate) || "Untitled";
      const src = cleanTitle(a?.sourceCountry) || cleanTitle(a?.sourceCollection) || "";
      return `• ${title}${src ? ` (${src})` : ""}`;
    });

    newsText.textContent = lines.join("\n");
    newsSource.textContent = "Source: GDELT 2.1 (public)";
  } catch (e) {
    newsText.textContent = "News error";
    newsSource.textContent = e.message;
  }
}

// ========= WORLD TIME TICKER (client-side) =========
const ZONES = [
  { label: "Local", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "ET", tz: "America/New_York" },
  { label: "CT", tz: "America/Chicago" },
  { label: "MT", tz: "America/Denver" },
  { label: "PT", tz: "America/Los_Angeles" },
  { label: "UTC", tz: "UTC" },
  { label: "London", tz: "Europe/London" },
  { label: "Paris", tz: "Europe/Paris" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Manila", tz: "Asia/Manila" },
  { label: "Guam", tz: "Pacific/Guam" },
  { label: "Seoul", tz: "Asia/Seoul" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
];

function fmtTime(tz) {
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: tz
    }).format(new Date());
  } catch {
    return "--:--:--";
  }
}

function setTickerText() {
  const parts = ZONES.map(z => `${z.label} ${fmtTime(z.tz)}`);
  timeTicker.textContent = parts.join("  •  ");
}

// animate ticker by CSS transform; recompute duration based on content width
function startTicker() {
  const el = timeTicker;
  let raf = null;

  function layout() {
    // reset transform
    el.style.transform = "translateX(0)";
    const parent = el.parentElement;
    if (!parent) return;

    const parentW = parent.getBoundingClientRect().width;
    const textW = el.getBoundingClientRect().width;

    // If text isn't wider than container, just center it
    if (textW <= parentW) {
      el.style.paddingLeft = "0";
      el.style.display = "block";
      el.style.textAlign = "center";
      el.style.transform = "none";
      return;
    }

    el.style.display = "inline-block";
    el.style.textAlign = "left";
    el.style.paddingLeft = "100%";

    const distance = textW + parentW;
    const seconds = Math.max(8, distance / TIME_TICKER_PX_PER_SEC);

    el.animate(
      [
        { transform: `translateX(0)` },
        { transform: `translateX(-${distance}px)` },
      ],
      { duration: seconds * 1000, iterations: Infinity }
    );
  }

  // initial and on resize
  layout();
  window.addEventListener("resize", () => {
    // cancel previous animations by cloning node
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    // rebind id reference
    const newEl = document.getElementById("timeTicker");
    setTickerText();
    newEl.animate([], { duration: 1 }); // noop
    // re-run ticker
    setTimeout(() => location.reload(), 0); // simplest reliable reset
  });
}

// ========= GLOBE (robust + fallback) =========
async function loadGlobe() {
  const wrap = document.getElementById("globeWrap");
  const fallback = document.getElementById("globeFallback");

  try {
    // Basic WebGL support check
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) throw new Error("WebGL not available");

    // Load Three.js from CDN (HTTPS)
    const [{ default: THREE }, { OrbitControls }] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"),
      import("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"),
    ]);

    // Texture from a stable HTTPS source
    const textureUrl = "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 4.5;

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 2, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const geom = new THREE.SphereGeometry(1, 64, 64);
    const tex = await new THREE.TextureLoader().loadAsync(textureUrl);
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    const earth = new THREE.Mesh(geom, mat);
    scene.add(earth);

    fallback.remove();

    function onResize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    function tick() {
      earth.rotation.y += 0.0012;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();
  } catch (e) {
    // Fallback: show a nice static image if anything fails
    fallback.textContent = "Globe unavailable (tap refresh). Showing fallback.";
    fallback.style.padding = "12px";

    const img = new Image();
    img.alt = "Earth";
    img.src = "https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    wrap.appendChild(img);
  }
}

// ========= BOOT =========
(async function boot() {
  await checkUpstream();
  await loadWeather();
  await loadNews();
  setTickerText();
  setInterval(setTickerText, 1000);
  startTicker();
  loadGlobe();
})();