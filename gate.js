// gate.js  (Option B: Cloudflare Access ONLY)
// No custom email/code flow here. Cloudflare handles OTP + session.
// Your job: send user to the app. If not authenticated, Cloudflare redirects.

(function () {
  const btn = document.querySelector(".gate-btn");
  const msg = document.getElementById("msg");

  function setMsg(text) {
    if (!msg) return;
    msg.textContent = text;
    msg.style.opacity = "1";
  }

  async function checkSession() {
    // If Cloudflare Access is protecting this site, an unauth user will be redirected
    // before this JS runs. So if we’re running, you’re usually already authenticated.
    // Still, we can do a lightweight fetch to confirm the page is reachable.
    try {
      const res = await fetch("/", { method: "GET", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function go() {
    setMsg("");
    // Optional: quick sanity check
    const ok = await checkSession();
    if (!ok) {
      setMsg("Network error. Try again.");
      return;
    }

    // Send to your actual app page:
    // change this if your real app is index.html or /hud.html etc.
    window.location.href = "/command.html";
  }

  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      go();
    });
  } else {
    // If no button exists, just auto-forward after a short beat.
    setTimeout(go, 150);
  }
})();