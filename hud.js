const API = "https://arc-omega-api.dcain1.workers.dev";

async function arcQuery(prompt) {
  const res = await fetch(`${API}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_id: "admin_01" }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  }
  return data;
}

// Example hook-up: you must match these IDs to your HTML
const input = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const out = document.getElementById("out");

sendBtn?.addEventListener("click", async () => {
  const prompt = (input?.value || "").trim();
  if (!prompt) return;

  sendBtn.disabled = true;
  try {
    const r = await arcQuery(prompt);
    // expects { response: "...", ... }
    out.textContent = r.response || JSON.stringify(r, null, 2);
  } catch (e) {
    out.textContent = `ERROR: ${e.message}`;
  } finally {
    sendBtn.disabled = false;
  }
});