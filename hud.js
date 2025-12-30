const FRONTEND = "arc-omega-frontend.pages.dev";
const API_BASE = "https://arc-omega-api.dcain1.workers.dev";
const HF = "https://dsc2336-arc-omega-backend.hf.space";

document.getElementById("front").textContent = FRONTEND;
document.getElementById("api").textContent = API_BASE;
document.getElementById("hf").textContent = HF;

const out = document.getElementById("out");
const btn = document.getElementById("send");
const promptEl = document.getElementById("prompt");

btn.addEventListener("click", async () => {
  out.textContent = "Sending...";
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: (promptEl.value || "").trim(), user_id: "web" }),
    });

    const txt = await res.text();
    out.textContent = `HTTP ${res.status}\n\n${txt}`;
  } catch (e) {
    out.textContent = `NETWORK ERROR: ${String(e)}`;
  } finally {
    btn.disabled = false;
  }
});