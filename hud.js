const API = "https://arc-omega-api.dcain1.workers.dev"; // your worker
const form = document.getElementById("gate");
const pw = document.getElementById("pw");
const msg = document.getElementById("msg");

function showError(text){
  msg.textContent = text;
  msg.classList.add("show");
  // red flash border
  form.style.borderColor = "rgba(255,59,59,.8)";
  setTimeout(()=> form.style.borderColor = "rgba(0,229,255,.25)", 650);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.classList.remove("show");

  const password = (pw.value || "").trim();
  if (!password) return;

  try{
    const res = await fetch(`${API}/auth`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ password }),
    });

    if (res.ok){
      // success: fade out then redirect to command center (you’ll build next)
      document.body.style.transition = "opacity 220ms ease";
      document.body.style.opacity = "0";
      setTimeout(()=> window.location.href = "/command.html", 230);
      return;
    }

    // failed
    showError("ACCESS DENIED. SECURITY NOTIFIED.");
    pw.value = "";
    pw.focus();
  }catch(err){
    showError("NETWORK ERROR");
  }
});