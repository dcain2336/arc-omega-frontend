const API_BASE = "https://arc-omega-api.dcain1.workers.dev";

const elPrompt = document.getElementById("prompt");
const elOut = document.getElementById("out");
const elBtn = document.getElementById("sendBtn");
const elHf = document.getElementById("hfPill");

function show(text) {
  elOut.textContent = text;
}

async function api(path, body) {
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { ok: r.ok, status: r.status, data };
}

// check worker -> hf wiring
(async () => {
  try {
    const r = await fetch(API_BASE + "/test");
    const j = await r.json();
    elHf.textContent = `HF: ${j.hf_space || "(unknown)"}`;
  } catch (e) {
    elHf.textContent = "HF: (test failed)";
  }
})();

elBtn.addEventListener("click", async () => {
  const prompt = (elPrompt.value || "").trim();
  if (!prompt) return;

  elBtn.disabled = true;
  show("Sending…");

  try {
    const res = await api("/query", { prompt, user_id: "web" });

    if (!res.ok) {
      show(`Error ${res.status}:\n` + JSON.stringify(res.data, null, 2));
      return;
    }

    // display response
    if (res.data && typeof res.data === "object") {
      show(JSON.stringify(res.data, null, 2));
    } else {
      show(String(res.data));
    }
  } catch (err) {
    show("NETWORK ERROR:\n" + String(err));
  } finally {
    elBtn.disabled = false;
  }
});