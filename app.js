// app.js

// ✅ Set this to your API base.
// If you want to swap between Render/Workers automatically later, we can do that.
const API_BASE = (localStorage.getItem("ARC_API_BASE") || "https://arc-omega-api.dcain1.workers.dev").replace(/\/+$/, "");

document.getElementById("apiBaseLabel").textContent = API_BASE;

const weatherLine = document.getElementById("weatherLine");
const newsLine = document.getElementById("newsLine");
const timeTicker = document.getElementById("timeTicker");

const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const sysLine = document.getElementById("sysLine");

const globeHint = document.getElementById("globeHint");
const recenterBtn = document.getElementById("recenterBtn");

function el(tag, cls, text){
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}

function addMsg(role, text){
  const div = el("div", `msg ${role}`, text);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function fetchJson(path){
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return await r.json();
}

async function postJson(path, body){
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// -------------------------
// Widgets: Weather / News / Time
// -------------------------

async function refreshWeather(){
  try{
    // If your API exposes /weather already, great.
    // If not, adapt this path to your existing endpoint.
    const data = await fetchJson("/weather");
    // Expecting something like: { ok:true, name, temp_f, desc, rh, wind_mph }
    if (data && data.ok){
      weatherLine.textContent = `${data.name} · ${data.temp_f}°F · ${data.desc} · RH ${data.rh}% · Wind ${data.wind_mph} mph`;
    }else{
      weatherLine.textContent = data?.error || "Weather unavailable";
    }
  }catch(e){
    weatherLine.textContent = `Weather error (${e.message})`;
  }
}

async function refreshNews(){
  try{
    const data = await fetchJson("/news");
    // Expect: { ok:true, headlines:[...] }
    if (data && data.ok && Array.isArray(data.headlines)){
      const headlines = data.headlines.filter(Boolean);
      newsLine.textContent = headlines.length ? headlines.slice(0, 3).join(" · ") : "No headlines returned.";
    }else{
      newsLine.textContent = data?.error || "No headlines returned.";
    }
  }catch(e){
    newsLine.textContent = `News error (${e.message})`;
  }
}

async function refreshTime(){
  try{
    const data = await fetchJson("/time");
    // Expect: { ok:true, items:[{label,time}] } OR anything similar
    if (data && data.ok && Array.isArray(data.items)){
      const text = data.items.map(x => `${x.label} ${x.time}`).join(" · ");
      timeTicker.textContent = text;
      // duplicate to reduce blank gaps in ticker
      timeTicker.textContent = `${text} · ${text}`;
    }else if (data && data.ok && typeof data.text === "string"){
      timeTicker.textContent = `${data.text} · ${data.text}`;
    }else{
      timeTicker.textContent = "Time unavailable";
    }
  }catch(e){
    timeTicker.textContent = `Time error (${e.message})`;
  }
}

// -------------------------
// Chat
// -------------------------

async function sendChat(){
  const text = (chatInput.value || "").trim();
  if (!text) return;

  sysLine.textContent = "";
  addMsg("user", text);
  chatInput.value = "";

  try{
    // ✅ Your api.py expects "message", NOT "prompt"
    const payload = {
      message: text,
      session_id: localStorage.getItem("ARC_SESSION") || "default",
    };

    const data = await postJson("/query", payload);

    if (data && data.ok && data.text){
      addMsg("bot", data.text);
      sysLine.textContent = `Provider: ${data.provider || "-"} · Model: ${data.model || "-"}`;
    }else{
      addMsg("bot", data?.error || "No response.");
      sysLine.textContent = "Send failed (unknown)";
    }
  }catch(e){
    addMsg("bot", `Send failed: ${e.message}`);
    sysLine.textContent = `send error: ${e.message}`;
  }
}

sendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// -------------------------
// Globe
// -------------------------

let globe;
let lastLatLng = null;

function initGlobe(){
  const container = document.getElementById("globe");

  // If Globe is blocked, show fallback message
  if (typeof Globe === "undefined"){
    globeHint.textContent = "Globe failed to load (CDN blocked).";
    return;
  }

  globe = Globe()(container)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
    .pointOfView({ lat: 20, lng: 0, altitude: 2.2 })
    .pointsData([])
    .pointAltitude(0.02)
    .pointRadius(0.4)
    .pointColor(() => "rgba(33,212,255,0.85)");

  globeHint.textContent = "Requesting location…";

  // Resize handling
  const ro = new ResizeObserver(() => {
    try { globe.width(container.clientWidth); globe.height(container.clientHeight); } catch {}
  });
  ro.observe(container);

  requestLocation();
}

function setMarker(lat, lng){
  lastLatLng = { lat, lng };

  if (!globe) return;
  globe.pointsData([{ lat, lng }]);

  globe.pointOfView(
    { lat, lng, altitude: 1.35 },
    900
  );

  globeHint.textContent = `Pinned near: ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function requestLocation(){
  if (!navigator.geolocation){
    globeHint.textContent = "Geolocation unavailable — showing world view.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setMarker(lat, lng);
    },
    () => {
      globeHint.textContent = "Location denied — showing world view.";
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
  );
}

recenterBtn.addEventListener("click", () => {
  if (lastLatLng) setMarker(lastLatLng.lat, lastLatLng.lng);
  else requestLocation();
});

// -------------------------
// Boot + refresh loop
// -------------------------

async function boot(){
  addMsg("bot", "ARC online. Send a message when ready.");
  initGlobe();

  // First load
  refreshWeather();
  refreshNews();
  refreshTime();

  // Update cadence
  setInterval(refreshWeather, 60 * 1000);
  setInterval(refreshNews, 90 * 1000);
  setInterval(refreshTime, 10 * 1000);
}

boot();
