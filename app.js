// frontend/app.js
// Backend failover chain.
// Tip: you can set a custom list in your browser storage under `arc_backends`.
const DEFAULT_BACKENDS = [
  "https://arc-omega-backend.onrender.com", // Render
  // Add your Hugging Face Space backend URL here (same API as Render)
  // Example: "https://YOUR_SPACE.hf.space"
];

function getBackends() {
  try {
    const raw = localStorage.getItem("arc_backends");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return DEFAULT_BACKENDS;
}

let ACTIVE_API_BASE = localStorage.getItem("arc_active_backend") || getBackends()[0];

function setActiveBase(base) {
  ACTIVE_API_BASE = base;
  try { localStorage.setItem("arc_active_backend", base); } catch {}
}

// session id (persist per browser)
const SESSION_KEY = "arc_session_id";
function getSessionId() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = "s_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}
const SESSION_ID = getSessionId();

// Elements
const apiUrlText = document.getElementById("apiUrlText");
const upstreamText = document.getElementById("upstreamText");
const upstreamPill = document.getElementById("upstreamPill");

const terminal = document.getElementById("terminal");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");

const weatherText = document.getElementById("weatherText");
const newsTrack = document.getElementById("newsTrack");
const timeTrack = document.getElementById("timeTrack");

const newsTrack = document.getElementById("newsTrack");
const threatBoard = document.getElementById("threatBoard");
const timeFooter = document.getElementById("timeFooter");
const newsFooter = document.getElementById("newsFooter");


const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const filesList = document.getElementById("filesList");

// Voice UI
const btnVoiceHold = document.getElementById("btnVoiceHold");
const voiceStatus = document.getElementById("voiceStatus");
const voicePlayer = document.getElementById("voicePlayer");

const btnOpenCouncilLog = document.getElementById("btnOpenCouncilLog");
const councilLog = document.getElementById("councilLog");
const councilStatus = document.getElementById("councilStatus");

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
const btnRefreshServices = document.getElementById("btnRefreshServices");
const servicesBox = document.getElementById("servicesBox");

const toolsCatalog = document.getElementById("toolsCatalog");
const btnRefreshMissions = document.getElementById("btnRefreshMissions");
const missionsBox = document.getElementById("missionsBox");
const arcLogo = document.getElementById("arcLogo");

const btnRefreshTools = document.getElementById("btnRefreshTools");
const toolsStatus = document.getElementById("toolsStatus");
const toolTavilyQ = document.getElementById("toolTavilyQ");
const btnRunTavily = document.getElementById("btnRunTavily");
const toolWolframQ = document.getElementById("toolWolframQ");
const btnRunWolfram = document.getElementById("btnRunWolfram");
const toolTomTomQ = document.getElementById("toolTomTomQ");
const btnRunTomTom = document.getElementById("btnRunTomTom");
const toolRagieQ = document.getElementById("toolRagieQ");
const btnRunRagie = document.getElementById("btnRunRagie");
const toolPath = document.getElementById("toolPath");
const toolBody = document.getElementById("toolBody");
const btnRunCustomTool = document.getElementById("btnRunCustomTool");


if (apiUrlText) apiUrlText.textContent = ACTIVE_API_BASE;


function setArcState(state) {
  if (!arcLogo) return;
  arcLogo.classList.remove("state-blue","state-cyan","state-purple","state-red","state-green","state-orange");
  arcLogo.classList.add(`state-${state}`);
}


function log(line) {
  if (!terminal) return;
  terminal.textContent += `${line}\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

async function fetchWithFailover(path, opts) {
  const backends = getBackends();
  const ordered = [ACTIVE_API_BASE, ...backends.filter(b => b !== ACTIVE_API_BASE)];
  let lastErr;
  for (const base of ordered) {
    try {
      const r = await fetch(`${base}${path}`, { ...opts, cache: "no-store" });
      if (r.ok) {
        if (base !== ACTIVE_API_BASE) setActiveBase(base);
        return r;
      }
      const txt = await r.text();
      lastErr = new Error(`${base}${path} -> ${r.status} ${txt}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No backends available");
}


async function runToolCall(defn, inputValue, saveOutput=false){
  const method = defn.method || "GET";
  let path = defn.path;
  let options = { method, headers: {"Content-Type":"application/json"} };
  if(defn.input === "query"){
    const q = encodeURIComponent(inputValue || "");
    if(path.includes("?")) path = path + "&q=" + q;
    else path = path + "?q=" + q;
  } else if(defn.input === "json"){
    options.body = inputValue || "{}";
  } else if(defn.input === "query_body"){
    options.body = JSON.stringify({query: inputValue || ""});
  } else if(defn.input === "query"){
    // handled above
  } else if(defn.input === "none"){
    // no-op
  } else {
    // default to POST body query
    if(method.toUpperCase() !== "GET"){
      options.body = JSON.stringify({query: inputValue || ""});
    }
  }

  const res = await fetchWithFailover(path, options);
  const out = await res.json().catch(()=>({ok:false,error:"non-json response"}));
  logJson(out);

  if(saveOutput){
    try{
      const payload = { filename: `${defn.id}_${Date.now()}.txt`, content: JSON.stringify(out, null, 2) };
      const r2 = await fetchWithFailover("/files/generate/text", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const o2 = await r2.json();
      logJson({saved:true, file:o2});
    }catch(e){
      logLine("[tools] save failed: " + (e?.message || e));
    }
  }
}
async function apiGet(path) {
  const r = await fetchWithFailover(path, { method: "GET" });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

async function apiPost(path, body) {
  const r = await fetchWithFailover(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

/* Drawer + blackout */
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
btnRefreshServices?.addEventListener("click", refreshServices);
btnRefreshServices?.addEventListener("click", refreshServices);

/* Backend status polling */
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
  } catch {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}
refreshBackendStatus();
setInterval(refreshBackendStatus, 12000);

/* Services status */
async function refreshServices() {
  try {
    const h = await apiGet("/health");
    if (!servicesBox) return;
    const integ = h.integrations || {};
    const lines = [];
    lines.push(`MODE: ${(h.mode||'prod')}`);
    lines.push(`MONGO: ${h.mongo ? 'ok' : 'down'}`);
    for (const [name, st] of Object.entries(integ)) {
      const enabled = st.enabled ? 'on' : 'off';
      const open = st.circuit_open ? 'circuit:open' : 'circuit:ok';
      const lat = (st.latency_ms != null) ? `lat:${st.latency_ms}ms` : '';
      const err = st.last_error ? `err:${st.last_error}` : '';
      lines.push(`${name}: ${enabled} ${open} ${lat} ${err}`.trim());
    }
    servicesBox.textContent = lines.join("\n");
  } catch (e) {
    if (servicesBox) servicesBox.textContent = `Services unavailable: ${e}`;
  }
}
refreshServices();

/* Send message */
async function sendMessage() {
  const msg = (promptEl?.value || "").trim();
  if (!msg) return;

  promptEl.value = "";
  log(`> ${msg}`);

  try {
    // IMPORTANT: include session_id so council log binds correctly
    const out = await apiPost("/query", { message: msg, session_id: SESSION_ID });
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

/* Geolocation */
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

/* Weather (UI only, map + tool router will also use backend when needed) */
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
  } catch {
    weatherText.textContent = "Weather unavailable";
  }
}
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);

/* World Time ticker */
function buildWorldTimeLine() {
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
  if (!timeTrack) return;
  const line = buildWorldTimeLine();
  timeTrack.textContent = line + "   •   " + line;
}
refreshWorldTime();
setInterval(refreshWorldTime, 1000);

/* News ticker */
async function refreshThreatBoard() {
  if (!threatTrack) return;
  try {
    setArcState("cyan");
    const j = await apiGet(`/tools/threat_board?limit=25`);
    const items = (j.items || []).slice(0, 18);
    const line = items.map(x => `${x.title}`).join(" • ");
    threatTrack.textContent = line || "Threat board unavailable";
    setArcState(line ? "green" : "red");
  } catch (e) {
    threatTrack.textContent = "Threat board unavailable";
    setArcState("red");
  }
}

async function refreshNews() {
  try {
    const data = await apiGet("/tools/news");
    const headlines = data?.headlines || [];
    const clean = headlines.filter((h) => typeof h === "string" && h.trim().length);
    const base = clean.length ? clean.join("   •   ") : "No headlines right now";
    newsTrack.textContent = base + "   •   " + base;
  } catch {
    newsTrack.textContent = "News unavailable   •   News unavailable";
  }
}
refreshNews();
setInterval(refreshNews, 10 * 60 * 1000);

/* Files list + upload */
async async function refreshFilesList() {
  if (!filesList) return;
  try {
    const data = await apiGet("/files");
    if (!data.ok) {
      filesList.textContent = data.error || "Files unavailable";
      return;
    }
    const files = data.files || [];
    if (!files.length) {
      filesList.textContent = "No files yet";
      return;
    }
    filesList.innerHTML = files.map((f) => {
      const name = (f.name || "file").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `• <a href="${API_BASE}/files/${f.id}" target="_blank" rel="noopener noreferrer">${name}</a>
  <span class="subtle">(${f.size} bytes)</span>
  <button class="miniBtn" data-act="extract" data-id="${f.id}">Extract</button>
  <button class="miniBtn" data-act="analyze" data-id="${f.id}">Analyze</button>
  <button class="miniBtn" data-act="edit" data-id="${f.id}">Edit</button>`;
    }).join("<br/>");
  } catch {
    filesList.textContent = "Files unavailable";
  }
}

uploadBtn?.addEventListener("click", async () => {
  if (!fileInput?.files?.length) return;
  const file = fileInput.files[0];

  try {
    const form = new FormData();
    form.append("file", file);

    const r = await fetch(`${API_BASE}/files`, { method: "POST", body: form });
    const txt = await r.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!r.ok || !data.ok) {
      log(`upload failed: ${data.error || txt}`);
      return;
    }

    log(`uploaded: ${data.name} (${data.size} bytes)`);
    // ✅ clear file chooser
    fileInput.value = "";
    refreshFilesList();
  } catch (e) {
    log(`upload error: ${e.message || String(e)}`);
  }
});

refreshFilesList();

// File action buttons (extract/analyze/edit)
if (filesList) {
  filesList.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button[data-act]");
    if (!btn) return;
    ev.preventDefault();
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    try {
      if (act === "extract") {
        const r = await apiGet(`/files/${id}/extract`);
        logToTerminal(`[FILE] extract ${id}:\n` + (r.text || JSON.stringify(r, null, 2)));
      } else if (act === "analyze") {
        const prompt = window.prompt("Analyze prompt:", "Summarize key points.");
        if (!prompt) return;
        const r = await apiPost(`/files/${id}/analyze`, { prompt });
        logToTerminal(`[FILE] analyze ${id}:\n` + (r.text || JSON.stringify(r, null, 2)));
      } else if (act === "edit") {
        const instruction = window.prompt("Edit instruction:", "Rewrite for clarity.");
        if (!instruction) return;
        const r = await apiPost(`/files/${id}/edit`, { instruction });
        logToTerminal(`[FILE] edit ${id}:\n` + JSON.stringify(r, null, 2));
        refreshFilesList();
      }
    } catch (e) {
      logToTerminal("[FILE] action failed: " + (e?.message || e));
    }
  });
}
setInterval(refreshFilesList, 60 * 1000);

/* Council log (drawer) */
async function openCouncilLog() {
  if (!councilLog || !councilStatus) return;

  councilStatus.textContent = "Loading council session…";
  try {
    const data = await apiGet(`/council/last?session_id=${encodeURIComponent(SESSION_ID)}`);
    if (!data.ok) {
      councilStatus.textContent = data.error || "No council session found.";
      councilLog.style.display = "none";
      return;
    }

    councilStatus.textContent = `Council session: ${data.session_id} • ${new Date(data.ts).toLocaleString()}`;
    councilLog.style.display = "block";
    councilLog.textContent = data.log || "(empty)";
  } catch (e) {
    councilStatus.textContent = "No council session found yet for this session.";
    councilLog.style.display = "none";
  }
}
btnOpenCouncilLog?.addEventListener("click", openCouncilLog);

/* -------------------------
   GEO MAP (no uploaded map)
   Uses a free static map:
   https://staticmap.openstreetmap.de/
------------------------- */
const geoMapImg = document.getElementById("geoMapImg");
const mapPin = document.getElementById("mapPin");
const mapStatus = document.getElementById("mapStatus");
const nightOverlay = document.getElementById("nightOverlay");

function isLikelyNightLocal() {
  // simple local heuristic: darken from 18:30 to 06:30
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return (h >= 18.5 || h <= 6.5);
}

async function refreshGeoMap() {
  if (!geoMapImg || !mapPin || !mapStatus || !nightOverlay) return;

  const pos = await getPosition();
  if (!pos) {
    mapStatus.textContent = "Map unavailable (location blocked)";
    return;
  }

  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  // ✅ correct location pin (centered map)
  const zoom = 8; // good for Onslow/Jacksonville
  const w = 900;
  const h = 520;

  // Static map service (free, no key)
  // Marker uses lat,lon
  const url =
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${encodeURIComponent(lat + "," + lon)}` +
    `&zoom=${zoom}&size=${w}x${h}` +
    `&markers=${encodeURIComponent(lat + "," + lon + ",cyan-pushpin")}`;

  geoMapImg.src = url;
  mapStatus.textContent = `Map running • lat ${lat.toFixed(4)} lon ${lon.toFixed(4)}`;

  // night overlay
  nightOverlay.style.background = isLikelyNightLocal() ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.06)";

  // pin is already baked into image, but we keep a subtle UI pin anyway (center)
  mapPin.style.left = "50%";
  mapPin.style.top = "50%";
}

refreshGeoMap();
setInterval(refreshGeoMap, 5 * 60 * 1000);
// -------------------- Voice (push-to-talk) --------------------
let mediaRecorder = null;
let voiceChunks = [];
let isRecording = false;

async function startRecording() {
  if (isRecording) return;
  voiceStatus.textContent = "Requesting mic…";
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const options = {};
  // Safari/iOS often records as audio/mp4; MediaRecorder chooses best.
  mediaRecorder = new MediaRecorder(stream, options);
  voiceChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) voiceChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    try {
      voiceStatus.textContent = "Sending…";
      const blob = new Blob(voiceChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      await sendVoiceBlob(blob);
    } catch (e) {
      voiceStatus.textContent = "Voice error";
      logToTerminal("VOICE ERROR: " + (e?.message || e));
    } finally {
      isRecording = false;
      // stop tracks
      stream.getTracks().forEach(t => t.stop());
    }
  };

  mediaRecorder.start();
  isRecording = true;
  voiceStatus.textContent = "Recording…";
}

function stopRecording() {
  if (!mediaRecorder || !isRecording) return;
  voiceStatus.textContent = "Processing…";
  mediaRecorder.stop();
}

async function sendVoiceBlob(blob) {
  const fd = new FormData();
  fd.append("file", blob, "voice.webm");

  const url = `${API_BASE}/voice/chat?session_id=${encodeURIComponent(SESSION_ID)}&provider=auto`;
  const r = await fetch(url, { method: "POST", body: fd });
  const j = await r.json();
  if (!j.ok) {
    voiceStatus.textContent = "Voice failed";
    logToTerminal("VOICE FAILED: " + (j.error || "unknown"));
    return;
  }

  // Print transcript + reply
  logToTerminal("\n[VOICE] You: " + (j.transcript || ""));
  logToTerminal("[VOICE] ARC: " + (j.reply_text || ""));

  if (j.audio_file_id) {
    const audioUrl = `${API_BASE}/files/${encodeURIComponent(j.audio_file_id)}`;
    voicePlayer.src = audioUrl;
    voicePlayer.style.display = "block";
    // attempt autoplay; iOS may block unless user taps play
    try { await voicePlayer.play(); } catch (_) {}
    voiceStatus.textContent = "Ready (audio)";
  } else {
    voiceStatus.textContent = "Ready (text-only)";
    if (j.tts_error) logToTerminal("[VOICE] TTS degraded: " + j.tts_error);
  }
}

// Hold-to-talk: pointer events cover mouse + touch
if (btnVoiceHold) {
  btnVoiceHold.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    try { await startRecording(); } catch (err) {
      voiceStatus.textContent = "Mic denied";
      logToTerminal("MIC PERMISSION ERROR: " + (err?.message || err));
    }
  });
  const stopHandler = (e) => { e.preventDefault(); stopRecording(); };
  btnVoiceHold.addEventListener("pointerup", stopHandler);
  btnVoiceHold.addEventListener("pointercancel", stopHandler);
  btnVoiceHold.addEventListener("pointerleave", stopHandler);
}




// =========================
// Continuous conversation mode (hands-free)
// =========================
const btnVoiceStart = document.getElementById("btnVoiceStart");
const chkWakePhrase = document.getElementById("chkWakePhrase");
const btnVoiceDownloadLog = document.getElementById("btnVoiceDownloadLog");

// Briefing/Emergency
const btnMorningBrief = document.getElementById("btnMorningBrief");
const btnSendBrief = document.getElementById("btnSendBrief");
const briefStatus = document.getElementById("briefStatus");
const btnEmergency = document.getElementById("btnEmergency");
const btnEmergencyToggle = document.getElementById("btnEmergencyToggle");
const btnEmergencyClear = document.getElementById("btnEmergencyClear");
const emergencyStatus = document.getElementById("emergencyStatus");
const councilViz = document.getElementById("councilViz");
const threatTrack = document.getElementById("threatTrack");

let convoEnabled = false;
let convoSessionId = "voice_default";
let convoLog = []; // {role, text, ts}

function addConvoLog(role, text) {
  const entry = { role, text, ts: Date.now() };
  convoLog.push(entry);
  // also print to terminal
  const prefix = role === "user" ? "YOU" : "ARC";
  logToTerminal(`[VOICELOG] ${prefix}: ${text}`);
}

async function backendAppendVoiceLog(transcript, reply_text, audio_file_id) {
  try {
    await apiPost("/voice/logs", { session_id: convoSessionId, transcript, reply_text, audio_file_id });
  } catch (e) {
    // ignore
  }
}

function shouldRespond(transcript) {
  const needWake = !!(chkWakePhrase && chkWakePhrase.checked);
  if (!needWake) return true;
  const t = (transcript || "").trim().toLowerCase();
  return t.startsWith("arc") || t.startsWith("hey arc") || t.startsWith("okay arc") || t.startsWith("ok arc");
}

async function recordUtteranceWithVAD() {
  // Reuse getUserMedia stream
  if (!window.__arcMicStream) {
    window.__arcMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  const stream = window.__arcMicStream;

  // Recorder
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
               (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "");
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];

  // VAD using AnalyserNode
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctx = window.__arcAudioCtx || new AudioContext();
  window.__arcAudioCtx = ctx;
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);

  let heardSpeech = false;
  let lastLoudTs = Date.now();
  const startTs = Date.now();

  function rms() {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  const THRESH = 0.035;      // tweak if needed
  const SILENCE_MS = 1100;   // end-of-utterance silence
  const MIN_MS = 650;        // minimum utterance duration
  const MAX_MS = 12000;      // safety cap

  let intervalId;

  const done = (resolve, blob) => {
    try { clearInterval(intervalId); } catch {}
    try { src.disconnect(); } catch {}
    resolve(blob);
  };

  const blobPromise = new Promise((resolve) => {
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      done(resolve, blob);
    };

    rec.start(250);

    intervalId = setInterval(() => {
      const now = Date.now();
      const level = rms();

      if (level > THRESH) {
        heardSpeech = true;
        lastLoudTs = now;
      }

      const dur = now - startTs;
      const silentFor = now - lastLoudTs;

      if (heardSpeech && dur > MIN_MS && silentFor > SILENCE_MS) {
        try { rec.stop(); } catch {}
      } else if (dur > MAX_MS) {
        try { rec.stop(); } catch {}
      }
    }, 150);
  });

  // small UX update
  voiceStatus.textContent = "Listening…";
  return await blobPromise;
}

async function sendUtterance(blob) {
  // STT first
  const fd = new FormData();
  fd.append("file", blob, "utterance.webm");
  const sttResp = await fetch(`${API_BASE}/voice/stt`, { method: "POST", body: fd });
  const sttJson = await sttResp.json();
  if (!sttJson.ok) throw new Error(sttJson.error || "STT failed");
  const transcript = (sttJson.transcript || "").trim();
  if (!transcript) return { skipped: true };

  addConvoLog("user", transcript);

  if (!shouldRespond(transcript)) {
    // Don't run council; continue listening
    voiceStatus.textContent = 'Heard (wake phrase not detected)';
    await backendAppendVoiceLog(transcript, "", null);
    return { skipped: true, transcript };
  }

  // Run ARC query
  const q = await apiPost("/query", { message: transcript, session_id: convoSessionId });
  const replyText = (q.reply || q.text || q.output || "").toString().trim() || "(no reply)";
  addConvoLog("assistant", replyText);

  // TTS
  let audioFileId = null;
  try {
    const tts = await apiPost("/voice/tts", { text: replyText, filename: "arc_reply.mp3" });
    audioFileId = tts.file_id || tts.fileId || null;
  } catch (e) {
    logToTerminal("[VOICE] TTS failed (text-only): " + (e?.message || e));
  }

  await backendAppendVoiceLog(transcript, replyText, audioFileId);

  return { transcript, replyText, audioFileId };
}

async function playAudioByFileId(fileId) {
  if (!fileId) return;
  const url = `${API_BASE}/files/${fileId}`;
  voicePlayer.src = url;
  voicePlayer.style.display = "block";
  try {
    await voicePlayer.play();
  } catch (e) {
    // iOS may block autoplay; user can tap play
  }
  // wait for playback to end
  await new Promise((resolve) => {
    const done = () => { voicePlayer.removeEventListener("ended", done); resolve(); };
    voicePlayer.addEventListener("ended", done);
    // in case user doesn't play, resolve after 3s so we don't stall
    setTimeout(resolve, 3000);
  });
}

async function conversationLoop() {
  while (convoEnabled) {
    try {
      const blob = await recordUtteranceWithVAD();
      voiceStatus.textContent = "Processing…";
      const out = await sendUtterance(blob);
      if (out && out.audioFileId) {
        await playAudioByFileId(out.audioFileId);
      }
    } catch (e) {
      logToTerminal("[VOICE] error: " + (e?.message || e));
    }
    if (!convoEnabled) break;
    voiceStatus.textContent = "Listening…";
    await new Promise(r => setTimeout(r, 200));
  }
  voiceStatus.textContent = "Idle";
}

if (btnVoiceStart) {
  btnVoiceStart.addEventListener("click", async () => {
    if (!convoEnabled) {
      convoEnabled = true;
      btnVoiceStart.textContent = "Stop Conversation";
      logToTerminal("[VOICE] Conversation mode started");
      try {
        await conversationLoop();
      } catch {}
    } else {
      convoEnabled = false;
      btnVoiceStart.textContent = "Start Conversation";
      logToTerminal("[VOICE] Conversation mode stopped");
    }
  });
}

if (btnVoiceDownloadLog) {
  btnVoiceDownloadLog.addEventListener("click", async () => {
    // Build a simple text transcript and store it as a file via backend
    const lines = convoLog.map(e => {
      const who = e.role === "user" ? "YOU" : "ARC";
      const ts = new Date(e.ts).toLocaleString();
      return `[${ts}] ${who}: ${e.text}`;
    }).join("\n");
    try {
      const j = await apiPost("/files/generate/text", { filename: `voice_log_${convoSessionId}.txt`, content: lines });
      logToTerminal(`[VOICE] Log saved as file_id=${j.file_id || j.fileId || j.id}`);
    } catch (e) {
      logToTerminal("[VOICE] Failed to save log: " + (e?.message || e));
    }
  });
}



// ---------------- Map (Leaflet + Terminator) ----------------
async function initLeafletMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  const map = L.map(mapEl, { zoomControl: true, attributionControl: false }).setView([34.75, -77.42], 10); // Jacksonville-ish default
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  const marker = L.marker([34.75, -77.42]).addTo(map);
  marker.bindPopup("ARC location").openPopup();

  // Day/night terminator layer (best effort)
  let termLayer = null;
  function updateTerminator() {
    try {
      if (termLayer) map.removeLayer(termLayer);
      termLayer = L.terminator();
      termLayer.setStyle({ opacity: 0.35, fillOpacity: 0.25 });
      termLayer.addTo(map);
    } catch (e) {
      // ignore
    }
  }
  updateTerminator();
  setInterval(updateTerminator, 60 * 1000);

  // Use browser geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        marker.setLatLng([lat, lon]);
        marker.bindPopup(`You: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        map.setView([lat, lon], 12);
      },
      (err) => {
        logToTerminal("[MAP] Geolocation denied/unavailable: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }
}

// Initialize map after DOM ready
window.addEventListener("load", () => {
  initLeafletMap();
});



async function refreshTools() {
  if (!toolsStatus) return;
  try {
    const caps = await apiGet("/capabilities");
    const providers = caps.providers || {};
    const tools = caps.tools || {};
    const lines = [];
    lines.push("== Providers ==");
    for (const [k,v] of Object.entries(providers)) lines.push(`${k}: ${v ? "OK" : "OFF"}`);
    lines.push("");
    lines.push("== Tools ==");
    for (const [k,v] of Object.entries(tools)) lines.push(`${k}: ${v ? "OK" : "OFF"}`);
    toolsStatus.textContent = lines.join("\n");
  } catch (e) {
    toolsStatus.textContent = "Tools unavailable";
  }
}

async function runToolGet(path) {
  setArcState("cyan");
  try {
    const data = await apiGet(path);
    log(`[TOOL] GET ${path}`);
    log(JSON.stringify(data, null, 2));
    setArcState("green");
    return data;
  } catch (e) {
    log(`[TOOL] error: ${e}`);
    setArcState("red");
    throw e;
  }
}

async function runToolPost(path, bodyObj) {
  setArcState("cyan");
  try {
    const data = await apiPost(path, bodyObj);
    log(`[TOOL] POST ${path}`);
    log(JSON.stringify(data, null, 2));
    setArcState("green");
    return data;
  } catch (e) {
    log(`[TOOL] error: ${e}`);
    setArcState("red");
    throw e;
  }
}


setArcState("blue");
refreshTools();


// -------------------- Briefing / Emergency / Council Viz --------------------
async function getGeo() {
  return await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  });
}

async function refreshEmergencyStatus() {
  if (!emergencyStatus) return;
  try {
    const j = await apiGet(`/emergency/status?session_id=${encodeURIComponent(SESSION_ID)}`);
    emergencyStatus.textContent = j.active ? "ACTIVE" : "Inactive";
    if (j.active) setArcState("red");
  } catch {}
}

if (btnEmergency) {
  btnEmergency.addEventListener("click", async () => {
    // open drawer and highlight emergency section
    openDrawer();
    try { btnEmergencyToggle?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
  });
}

if (btnEmergencyToggle) {
  btnEmergencyToggle.addEventListener("click", async () => {
    try {
      setArcState("orange");
      const reason = prompt("Emergency reason (optional):") || "";
      const j = await apiPost("/emergency/activate", { session_id: SESSION_ID, reason });
      if (j.ok) {
        emergencyStatus.textContent = "ACTIVE";
        logToTerminal("[EMERGENCY] Activated");
        setArcState("red");
      } else {
        logToTerminal("[EMERGENCY] Failed: " + (j.error || "unknown"));
        setArcState("red");
      }
    } catch (e) {
      logToTerminal("[EMERGENCY] Error: " + (e?.message || e));
      setArcState("red");
    }
  });
}

if (btnEmergencyClear) {
  btnEmergencyClear.addEventListener("click", async () => {
    try {
      setArcState("orange");
      const j = await apiPost("/emergency/clear", { session_id: SESSION_ID });
      if (j.ok) {
        emergencyStatus.textContent = "Inactive";
        logToTerminal("[EMERGENCY] All clear");
        setArcState("green");
      } else {
        logToTerminal("[EMERGENCY] Failed: " + (j.error || "unknown"));
        setArcState("red");
      }
    } catch (e) {
      logToTerminal("[EMERGENCY] Error: " + (e?.message || e));
      setArcState("red");
    }
  });
}

if (btnMorningBrief) {
  btnMorningBrief.addEventListener("click", async () => {
    try {
      setArcState("cyan");
      briefStatus.textContent = "Generating…";
      const geo = await getGeo();
      const payload = { session_id: SESSION_ID, limit: 15 };
      if (geo) { payload.lat = geo.lat; payload.lon = geo.lon; }
      const j = await apiPost("/briefing/morning", payload);
      const lines = [];
      if (j.weather && j.weather.ok) lines.push(`Weather: ${j.weather.temp_f}°F wind ${j.weather.wind || ""}`);
      const hb = (j.headlines?.headlines || []).slice(0, 8);
      if (hb.length) lines.push("Headlines: " + hb.join(" | "));
      const tb = (j.threat_board?.items || []).slice(0, 8);
      if (tb.length) lines.push("Threat board: " + tb.map(x => x.title).join(" | "));
      const brief = lines.join("\n");
      logToTerminal("\n[MORNING BRIEF]\n" + brief + "\n");
      window.__lastBriefText = brief;
      briefStatus.textContent = "Ready";
      setArcState("green");
    } catch (e) {
      briefStatus.textContent = "Error";
      logToTerminal("[BRIEF] Error: " + (e?.message || e));
      setArcState("red");
    }
  });
}

if (btnSendBrief) {
  btnSendBrief.addEventListener("click", async () => {
    const text = (window.__lastBriefText || "").trim();
    if (!text) {
      alert("Generate a brief first.");
      return;
    }
    try {
      setArcState("orange");
      briefStatus.textContent = "Sending…";
      const j = await apiPost("/briefing/send", { session_id: SESSION_ID, text, via: ["discord","email","sms"] });
      logToTerminal("[BRIEF] Send results: " + JSON.stringify(j.results || j, null, 2));
      briefStatus.textContent = "Sent (check logs)";
      setArcState("green");
    } catch (e) {
      briefStatus.textContent = "Send failed";
      logToTerminal("[BRIEF] Send error: " + (e?.message || e));
      setArcState("red");
    }
  });
}

async function refreshCouncilViz() {
  if (!councilViz) return;
  try {
    const j = await apiGet(`/council/state?session_id=${encodeURIComponent(SESSION_ID)}`);
    const state = (j.state || "blue").toLowerCase();
    councilViz.classList.remove("blue","cyan","purple","red","green","orange");
    councilViz.classList.add(state);
  } catch {}
}

refreshCouncilViz();
refreshEmergencyStatus();
setInterval(refreshCouncilViz, 4000);
setInterval(refreshEmergencyStatus, 8000);
async async function refreshToolsCatalog(){
  if(!toolsCatalog) return;
  toolsCatalog.innerHTML = "<div class='subtle mono'>Loading tools…</div>";
  try{
    const r = await fetchWithFailover("/tools/registry");
    const j = await r.json();
    const tools = (j && j.tools) || [];
    toolsCatalog.innerHTML = "";
    tools.forEach(t=>{
      const row = document.createElement("div");
      row.className = "toolRow";
      const label = document.createElement("div");
      label.className = "subtle mono";
      label.style.minWidth="140px";
      label.textContent = t.label + (t.available ? "" : " (not configured)");
      const inp = document.createElement("input");
      inp.className="fileInput";
      inp.placeholder = (t.input==="query") ? "enter query" : (t.input==="json" ? "enter JSON body" : "");
      inp.style.display = (t.input==="none") ? "none" : "block";
      const save = document.createElement("input");
      save.type="checkbox";
      save.title="Save output as file";
      const run = document.createElement("button");
      run.className="btn toolMini";
      run.textContent="Run";
      run.disabled = !t.available;
      run.onclick = ()=>runToolCall(t, inp.value, save.checked);
      row.appendChild(label);
      row.appendChild(inp);
      row.appendChild(run);
      row.appendChild(save);
      toolsCatalog.appendChild(row);
    });
  }catch(e){
    toolsCatalog.innerHTML = "<div class='subtle mono'>Failed to load tools</div>";
    logLine("[tools] catalog error: " + (e?.message || e));
  }
}

async async function refreshMissions(){
  if(!missionsBox) return;
  missionsBox.innerHTML = "<div class='subtle mono'>Loading missions…</div>";
  try{
    const r = await fetchWithFailover("/missions/list");
    const j = await r.json();
    const missions = (j && j.missions) || [];
    missionsBox.innerHTML = "";
    missions.forEach(m=>{
      const row = document.createElement("div");
      row.className="toolRow";
      const label = document.createElement("div");
      label.className="subtle mono";
      label.style.minWidth="180px";
      label.textContent = m.label;
      const run = document.createElement("button");
      run.className="btn toolMini";
      run.textContent="Run";
      run.onclick = async ()=>{
        const r2 = await fetchWithFailover("/missions/run", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id:m.id})});
        const out = await r2.json();
        logJson(out);
      };
      row.appendChild(label);
      row.appendChild(run);
      missionsBox.appendChild(row);
    });
  }catch(e){
    missionsBox.innerHTML = "<div class='subtle mono'>Failed to load missions</div>";
    logLine("[missions] error: " + (e?.message || e));
  }

  if(btnRefreshMissions) btnRefreshMissions.addEventListener('click', refreshMissions);
  refreshToolsCatalog();
  refreshMissions();
}




// ---------------- News + Threat Board ----------------
async function updateBreakingNews() {
  try {
    const r = await apiGet("/tools/news");
    const headlines = (r?.headlines?.headlines) || (r?.headlines) || [];
    const items = Array.isArray(headlines) ? headlines : (headlines?.headlines || []);
    const texts = items.map(h => (typeof h === "string" ? h : (h.title || h.headline || ""))).filter(Boolean).slice(0, 12);
    const line = texts.length ? texts.join("  •  ") : "No headlines available.";
    if (newsTrack) newsTrack.textContent = line;
    if (newsFooter) newsFooter.textContent = line;
  } catch (e) {
    const msg = "News unavailable (backend offline).";
    if (newsTrack) newsTrack.textContent = msg;
    if (newsFooter) newsFooter.textContent = msg;
  }
}

async function updateThreatBoard() {
  try {
    const r = await apiGet("/tools/threat_board");
    const items = r?.items || [];
    const lines = items.slice(0, 25).map(it => {
      const src = it.source ? `[${it.source}] ` : "";
      return `${src}${it.title || it.headline || it.text || ""}`.trim();
    }).filter(Boolean);
    if (threatBoard) threatBoard.textContent = lines.length ? lines.join("\n\n") : "No items.";
  } catch (e) {
    if (threatBoard) threatBoard.textContent = "Threat board unavailable (backend offline).";
  }
}

function updateFooterTime() {
  if (!timeFooter) return;
  // reuse the world time values if available
  timeFooter.textContent = timeTrack ? timeTrack.textContent : "";
}

// Schedule updates
setInterval(updateBreakingNews, 60 * 1000);
setInterval(updateThreatBoard, 5 * 60 * 1000);
setInterval(updateFooterTime, 15 * 1000);

// Initial
updateBreakingNews();
updateThreatBoard();
updateFooterTime();
