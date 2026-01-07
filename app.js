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

// News marquee
const newsInner = document.getElementById("newsInner");

// Time ticker
const timePill = document.getElementById("timePill");

// Files
const filePick = document.getElementById("filePick");
const btnUpload = document.getElementById("btnUpload");
const btnRefreshFiles = document.getElementById("btnRefreshFiles");
const filesList = document.getElementById("filesList");

// Drawer / overlay / blackout
const btnMenu = document.getElementById("btnMenu");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const btnBlackout = document.getElementById("btnBlackout");
const blackout = document.getElementById("blackout");

const btnRefreshBackend = document.getElementById("btnRefreshBackend");
const btnRefreshWeather = document.getElementById("btnRefreshWeather");
const btnRefreshNews = document.getElementById("btnRefreshNews");

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
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return data;
}

/* --------------------
   Drawer + blackout UI
-------------------- */
function openDrawer() {
  drawer?.classList.add("open");
  drawerOverlay?.classList.remove("hidden");
}
function closeDrawer() {
  drawer?.classList.remove("open");
  drawerOverlay?.classList.add("hidden");
}
btnMenu?.addEventListener("click", openDrawer);
btnCloseDrawer?.addEventListener("click", closeDrawer);
drawerOverlay?.addEventListener("click", closeDrawer);

btnBlackout?.addEventListener("click", () => blackout?.classList.remove("hidden"));
blackout?.addEventListener("click", () => blackout?.classList.add("hidden"));

btnRefreshBackend?.addEventListener("click", () => refreshBackendStatus(true));
btnRefreshWeather?.addEventListener("click", refreshWeather);
btnRefreshNews?.addEventListener("click", refreshNews);
btnRefreshFiles?.addEventListener("click", refreshFiles);

/* --------------------
   Local time ticker
-------------------- */
function pad2(n){ return String(n).padStart(2,"0"); }
function tickTime(){
  const d = new Date();
  const s = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  if (timePill) timePill.textContent = s;
}
tickTime();
setInterval(tickTime, 250);

/* --------------------
   Backend status polling (throttled)
-------------------- */
let lastBackendRefresh = 0;

async function refreshBackendStatus(force = false) {
  const now = Date.now();
  if (!force && now - lastBackendRefresh < 8000) return;
  lastBackendRefresh = now;

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
setInterval(refreshBackendStatus, 12000);

/* --------------------
   Send message
-------------------- */
async function sendMessage() {
  const msg = (promptEl.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    const out = await apiPost("/query", { message: msg });
    if (!out.ok) {
      log(`! error: ${out.error || "unknown"}`);
      return;
    }
    log(out.text || "(no text)");
  } catch (e) {
    log(`send error: ${e.message || String(e)}`);
  }
}

sendBtn?.addEventListener("click", sendMessage);
promptEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

/* --------------------
   Browser geolocation helper
-------------------- */
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

/* --------------------
   Weather (Open-Meteo) using browser geolocation
-------------------- */
async function refreshWeather() {
  try {
    const pos = await getPosition();
    if (!pos) {
      weatherText.textContent = "Weather unavailable (no location / blocked)";
      return;
    }

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

    const tempF = (cw.temperature * 9 / 5) + 32;
    weatherText.textContent = `Your area • ${tempF.toFixed(1)}°F • Wind ${cw.windspeed.toFixed(1)} mph`;
  } catch (e) {
    weatherText.textContent = "Weather unavailable (no location / blocked)";
  }
}

refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* --------------------
   News ticker (smooth scrolling, no flashing)
-------------------- */
let _lastNewsLine = "";

async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];

    const base = headlines.length
      ? " • " + headlines.join(" • ") + " • "
      : "No headlines right now • ";

    // duplicate for clean -50% translate
    const line = base + base;

    if (line !== _lastNewsLine) {
      _lastNewsLine = line;
      if (newsInner) newsInner.textContent = line;
    }
  } catch (e) {
    const base = "News unavailable • ";
    const line = base + base + base + base;
    if (line !== _lastNewsLine) {
      _lastNewsLine = line;
      if (newsInner) newsInner.textContent = line + line;
    }
  }
}

refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* --------------------
   Files (Mongo GridFS via backend)
-------------------- */
async function refreshFiles() {
  try {
    const data = await apiGet("/files");
    if (!data.ok) {
      filesList.textContent = `Files unavailable: ${data.error || "unknown"}`;
      return;
    }

    const items = data.files || [];
    if (!items.length) {
      filesList.textContent = "No files yet";
      return;
    }

    filesList.innerHTML = items.map(f => {
      const id = encodeURIComponent(f.id);
      const name = (f.name || "file").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `• <a href="${API_BASE}/files/${id}" target="_blank" rel="noopener">${name}</a> (${f.size} bytes)`;
    }).join("<br/>");
  } catch (e) {
    filesList.textContent = "File list unavailable";
  }
}

async function uploadFile() {
  const file = filePick?.files?.[0];
  if (!file) return;

  try {
    const form = new FormData();
    form.append("file", file);

    const r = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
    if (!r.ok || !data.ok) throw new Error(data.error || txt);

    log(`uploaded: ${data.name} (${data.size} bytes)`);
    await refreshFiles();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
}

btnUpload?.addEventListener("click", uploadFile);
refreshFiles();

/* --------------------
   Globe with texture + terminator
-------------------- */
const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const ctx = canvas?.getContext("2d");

let animId = null;
let lastLayoutW = 0;
let lastLayoutH = 0;

let userLat = null;
let userLon = null;

// Texture
const tex = new Image();
tex.crossOrigin = "anonymous";
tex.src = "./assets/world-map-blue.png";
let texReady = false;
let texData = null;

tex.onload = () => {
  texReady = true;
  // cache pixel data for fast sampling
  const oc = document.createElement("canvas");
  oc.width = tex.width;
  oc.height = tex.height;
  const octx = oc.getContext("2d");
  octx.drawImage(tex, 0, 0);
  texData = octx.getImageData(0, 0, tex.width, tex.height).data;
};

function setCanvasSize() {
  if (!canvas || !ctx) return;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (w === lastLayoutW && h === lastLayoutH && canvas.width > 0) return;

  lastLayoutW = w;
  lastLayoutH = h;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lonLatToSphereXYZ(lonDeg, latDeg, rotDeg) {
  const lon = (lonDeg - rotDeg) * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;

  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);

  return { x, y, z };
}

function solarSubpointUTC(d) {
  const ms = d.getTime();
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;

  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180);

  const eps = 23.439 - 0.0000004 * n;
  const delta = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lambda * Math.PI / 180));

  const timeUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subLon = (180 - timeUTC * 15) % 360;
  const subLat = delta * 180 / Math.PI;

  return { lat: subLat, lon: subLon };
}

// Sample the texture by lon/lat -> pixel
function sampleTexRGBA(lonDeg, latDeg){
  if (!texReady || !texData) return [0,0,0,0];

  // equirectangular map: lon -180..180 => x 0..W
  // lat 90..-90 => y 0..H
  const W = tex.width;
  const H = tex.height;

  let x = ( (lonDeg + 180) / 360 ) * (W - 1);
  let y = ( (90 - latDeg) / 180 ) * (H - 1);

  x = Math.max(0, Math.min(W - 1, x));
  y = Math.max(0, Math.min(H - 1, y));

  const ix = (x|0);
  const iy = (y|0);
  const idx = (iy * W + ix) * 4;

  return [
    texData[idx],
    texData[idx+1],
    texData[idx+2],
    texData[idx+3]
  ];
}

function drawGlobe(t) {
  if (!canvas || !ctx) return;

  setCanvasSize();

  const w = lastLayoutW || canvas.getBoundingClientRect().width;
  const h = lastLayoutH || canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  // background glow
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.2);
  grad.addColorStop(0, "rgba(45,212,191,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // sphere outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(45,212,191,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // rotation
  const rotDeg = (t * 6) % 360;

  // Clip to sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Draw texture by sampling visible hemisphere
  // step controls quality/speed (2 is good on mobile)
  const step = 2;

  if (texReady && texData) {
    for (let py = -r; py <= r; py += step) {
      for (let px = -r; px <= r; px += step) {
        const nx = px / r;
        const ny = -py / r;
        const rr = nx*nx + ny*ny;
        if (rr > 1) continue;

        // orthographic inverse: z = sqrt(1-x^2-y^2)
        const nz = Math.sqrt(1 - rr);

        // convert xyz back to lon/lat (in rotated space)
        // We built xyz such that z is "toward viewer". Inverse rotation:
        // lon' = atan2(x, z), lat = asin(y)
        const lonPrime = Math.atan2(nx, nz) * 180/Math.PI;
        const lat = Math.asin(ny) * 180/Math.PI;

        // Apply globe rotation: lon = lon' + rotDeg
        let lon = lonPrime + rotDeg;
        if (lon > 180) lon -= 360;
        if (lon < -180) lon += 360;

        const [R,G,B,A] = sampleTexRGBA(lon, lat);
        if (A === 0) continue;

        ctx.fillStyle = `rgba(${R},${G},${B},${(A/255)})`;
        ctx.fillRect(cx + px, cy + py, step, step);
      }
    }
  } else {
    // fallback sphere fill if texture isn't ready
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(cx - r, cy - r, r*2, r*2);
  }

  // Day/Night shading
  const now = new Date();
  const sun = solarSubpointUTC(now);
  const sunP = lonLatToSphereXYZ(sun.lon, sun.lat, rotDeg);
  const sunDir = { x: sunP.x, y: sunP.y, z: sunP.z };

  ctx.fillStyle = "rgba(0,0,0,0.34)";
  for (let py = -r; py <= r; py += 3) {
    for (let px = -r; px <= r; px += 3) {
      const nx = px / r;
      const ny = -py / r;
      const rr = nx*nx + ny*ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);

      // dot(view_xyz, sunDir) < 0 => night
      const dot = nx*sunDir.x + ny*sunDir.y + nz*sunDir.z;
      if (dot >= 0) continue;

      ctx.fillRect(cx + px, cy + py, 3, 3);
    }
  }

  // user pin
  if (userLat != null && userLon != null) {
    const u = lonLatToSphereXYZ(userLon, userLat, rotDeg);
    if (u.z > 0) {
      const ux = cx + u.x * r;
      const uy = cy - u.y * r;

      ctx.beginPath();
      ctx.arc(ux, uy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251,113,133,0.95)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ux, uy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,113,133,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function startGlobe() {
  if (!canvas || !ctx) {
    if (statusEl) statusEl.textContent = "Globe unavailable (canvas missing)";
    return;
  }

  if (statusEl) statusEl.textContent = "Globe running";
  let start = performance.now();

  function loop(now) {
    const t = (now - start) / 1000;
    drawGlobe(t);
    animId = requestAnimationFrame(loop);
  }

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  setCanvasSize();
  setTimeout(setCanvasSize, 250);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  } else {
    startGlobe();
  }
});

// Get user location once (best-effort)
(async () => {
  const pos = await getPosition();
  if (pos) {
    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    if (statusEl) statusEl.textContent = "Globe running (location pinned)";
  } else {
    if (statusEl) statusEl.textContent = "Globe running (location blocked)";
  }
  setTimeout(() => {
    setCanvasSize();
    startGlobe();
  }, 120);
})();

setTimeout(() => {
  setCanvasSize();
  startGlobe();
}, 200);