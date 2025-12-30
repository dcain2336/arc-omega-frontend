// ========= CONFIG =========
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

// Optional “some protection” without a domain:
// Put the SAME value in your Worker secret ARC_SHARED_KEY.
// NOTE: Because this is frontend JS, it’s not “perfectly secret”
// (anyone can view source). It still blocks random hits.
const ARC_SHARED_KEY = ""; // <-- set this to your shared key (or leave blank to disable)

// ========= UI =========
const promptEl = document.getElementById("prompt");
const sendBtn  = document.getElementById("sendBtn");
const outEl    = document.getElementById("out");
const msgErr   = document.getElementById("msgErr");
const msgOk    = document.getElementById("msgOk");
const apiPill  = document.getElementById("apiPill");
const hfPill   = document.getElementById("hfPill");

function showErr(t){
  msgOk.style.display = "none";
  msgErr.style.display = "block";
  msgErr.textContent = t;
}
function showOk(t){
  msgErr.style.display = "none";
  msgOk.style.display = "block";
  msgOk.textContent = t;
}
function clearMsg(){
  msgErr.style.display = "none";
  msgOk.style.display = "none";
}

async function jsonFetch(path, body){
  const headers = { "Content-Type": "application/json" };
  if (ARC_SHARED_KEY) headers["x-arc-key"] = ARC_SHARED_KEY;

  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

// Show the worker config
(async () => {
  try {
    const r = await fetch(API_BASE + "/test");
    const t = await r.text();
    let j = {};
    try { j = JSON.parse(t); } catch {}
    apiPill.textContent = `API: ${API_BASE}`;
    hfPill.textContent  = `HF: ${j.hf_space || "(unknown)"}`;
  } catch {
    apiPill.textContent = `API: ${API_BASE}`;
    hfPill.textContent  = `HF: (unreachable)`;
  }
})();

sendBtn.addEventListener("click", async () => {
  clearMsg();
  const prompt = (promptEl.value || "").trim();
  if (!prompt) return;

  sendBtn.disabled = true;
  outEl.textContent = "Sending...";

  try {
    const res = await jsonFetch("/query", { prompt, user_id: "web" });

    if (!res.ok){
      showErr(`Error ${res.status}: ${JSON.stringify(res.data, null, 2)}`);
      outEl.textContent = "(request failed)";
      return;
    }

    showOk("OK");
    outEl.textContent = JSON.stringify(res.data, null, 2);
  } catch (e){
    showErr("NETWORK ERROR");
    outEl.textContent = "(network error)";
  } finally {
    sendBtn.disabled = false;
  }
});