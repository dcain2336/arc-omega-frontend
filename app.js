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

if (apiUrlText) apiUrlText.textContent = ACTIVE_API_BASE;

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
async function refreshFilesList() {
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
      return `• <a href="${API_BASE}/files/${f.id}" target="_blank" rel="noopener noreferrer">${name}</a> (${f.size} bytes)`;
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

