async function refreshBackendStatus() {
  try {
    // 1) server alive?
    const ping = await apiGet("/ping");
    if (!ping.ok) throw new Error("ping not ok");

    // 2) do we have at least one working provider key?
    const cand = await apiGet("/candidates");
    const providers = cand.providers || {};
    const anyKey =
      providers.openai?.key_present ||
      providers.openrouter?.key_present ||
      providers.groq?.key_present ||
      providers.huggingface?.key_present;

    upstreamText.textContent = anyKey ? "ok" : "keys missing";
    upstreamPill.classList.remove("bad");
    upstreamPill.classList.add(anyKey ? "ok" : "bad");
  } catch (e) {
    upstreamText.textContent = "down";
    upstreamPill.classList.remove("ok");
    upstreamPill.classList.add("bad");
  }
}