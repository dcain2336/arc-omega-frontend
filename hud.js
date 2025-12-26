setInterval(() => {
  document.getElementById("telemetry").innerText =
    "Heartbeat: " + new Date().toLocaleTimeString();
}, 1000);
