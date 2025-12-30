// hud.js (DROP-IN)
const API_BASE = "https://arc-omega-api.dcain1.workers.dev"; // your worker

const pillApi = document.getElementById("pillApi");
const pillHf = document.getElementById("pillHf");
const promptEl = document.getElementById("prompt");
const out = document.getElementById("out");
const sendBtn = document.getElementById("send");

async function loadTest() {
  try {
    const r = await fetch(`${API_BASE}/test`, { method: "GET" });
    const data = await r.json();
    pillApi.textContent = `API: ${API_BASE}`;
    pillHf.textContent = `HF: ${data.hf_space || "(unknown)"}`;
  } catch (e) {
    pillApi.textContent = `API: ${API_BASE}`;
    pillHf.textContent = `HF: (test failed)`;
  }
}

async function sendPrompt() {
  const prompt = (promptEl.value || "").trim();
  if (!prompt) return;

  out.textContent = "(sending...)";
  sendBtn.disabled = true;

  try {
    const r = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, user_id: "web" }),
    });

    const text = await r.text();
    if (!r.ok) {
      out.innerHTML = `Error ${r.status}: <span class="err">${text}</span>`;
      sendBtn.disabled = false;
      return;
    }

    // show pretty JSON if possible
    try {
      out.textContent = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      out.textContent = text;
    }
  } catch (e) {
    out.innerHTML = `<span class="err">NETWORK ERROR:</span> ${String(e)}`;
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendPrompt);
loadTest();