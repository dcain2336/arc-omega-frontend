(() => {
    // ARC OMEGA Frontend v13.1 (Patched)
    const DEFAULT_ORIGIN = "https://arc-omega-api.dcain1.workers.dev";
    const LS = "arc_worker_origin_v13";
    const $ = id => document.getElementById(id);
    const term = $("terminal");
    const diag = $("diag");

    // --- Logging Utilities ---
    function log(m) {
        const ts = new Date().toISOString().slice(11, 19);
        term.textContent += `[${ts}] ${m}\n`;
        term.scrollTop = term.scrollHeight;
    }

    function dlog(m) {
        const ts = new Date().toISOString().slice(11, 19);
        diag.textContent += `[${ts}] ${m}\n`;
        diag.scrollTop = diag.scrollHeight;
    }

    window.addEventListener("error", e => log(`JS ERROR: ${e.message}`));
    window.addEventListener("unhandledrejection", e => log(`PROMISE: ${String(e.reason || e)}`));

    // --- API & Network Helpers ---
    function origin() {
        return (localStorage.getItem(LS) || DEFAULT_ORIGIN).replace(/\/$/, "");
    }

    function api() {
        return origin() + "/api";
    }

    async function fetchJSON(url, opts = {}, ms = 14000) {
        const c = new AbortController();
        const id = setTimeout(() => c.abort("timeout"), ms);
        try {
            const res = await fetch(url, { ...opts,
                signal: c.signal
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = {
                    raw: text
                };
            }
            return {
                ok: res.ok,
                status: res.status,
                headers: res.headers,
                data
            };
        } finally {
            clearTimeout(id);
        }
    }

    function setUp(headers) {
        $("metaUpstream").textContent = headers.get("x-arc-upstream") || "—";
    }

    // --- Core Functions ---
    async function ping() {
        const r = await fetchJSON(api() + "/ping");
        $("metaApi").textContent = api();
        setUp(r.headers);
        log(`PING ${r.status}: ${JSON.stringify(r.data)}`);
    }

    async function caps() {
        const r = await fetchJSON(api() + "/capabilities");
        setUp(r.headers);
        log(`CAPS ${r.status}`);
        log(JSON.stringify(r.data, null, 2));
    }

    async function query() {
        const msg = $("prompt").value.trim();
        if (!msg) return;
        log("YOU: " + msg);
        const r = await fetchJSON(api() + "/query", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: msg
            })
        });
        setUp(r.headers);
        if (!r.ok) {
            log(`QUERY ${r.status}: ${JSON.stringify(r.data)}`);
            return;
        }
        log("ARC: " + (r.data.reply || r.data.text || JSON.stringify(r.data)));
    }

    // --- Tools (FIXED ROUTING HERE) ---
    async function news() {
        // FIX: Changed from origin() to api() to route through worker proxy
        const r = await fetchJSON(api() + "/tools/news");
        if (!r.ok) {
            $("newsTicker").textContent = "News: unavailable";
            return;
        }
        const heads = r.data.headlines || [];
        let i = 0;
        $("newsTicker").textContent = "News: " + (heads[0] || "—");
        setInterval(() => {
            i = (i + 1) % Math.max(1, heads.length);
            $("newsTicker").textContent = "News: " + (heads[i] || "—");
        }, 8000);
    }

    async function weather(lat, lon) {
        // FIX: Changed from origin() to api() to route through worker proxy
        const r = await fetchJSON(api() + `/tools/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        if (!r.ok) {
            $("weather").textContent = "Weather unavailable";
            return;
        }
        $("weather").textContent = `${r.data.temp_f ?? "—"}°F • ${r.data.summary ?? ""}`;
        $("weatherMeta").textContent = `Provider: ${r.data.provider || "—"} • Wind: ${r.data.wind_mph ?? "—"} mph • Humidity: ${r.data.humidity ?? "—"}%`;
    }

    async function threat() {
        const r = await fetchJSON(api() + "/tools/threat_board?limit=10");
        if (!r.ok) {
            $("threat").textContent = "Threat board unavailable";
            return;
        }
        const items = r.data.items || [];
        $("threat").textContent = items.map(x => `• ${x.title}`).join("\n") || "No items.";
    }

    // --- UI/UX ---
    function timeTicker() {
        const cities = [
            ["PT", "America/Los_Angeles"],
            ["MT", "America/Denver"],
            ["CT", "America/Chicago"],
            ["ET", "America/New_York"],
            ["UTC", "UTC"],
            ["Okinawa", "Asia/Tokyo"],
            ["Korea", "Asia/Seoul"],
            ["Philippines", "Asia/Manila"]
        ];
        setInterval(() => {
            const parts = cities.map(([l, tz]) => {
                const dt = new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                    timeZone: tz
                }).format(new Date());
                return `${l} ${dt}`;
            });
            $("timeTicker").textContent = "Time: " + parts.join(" | ");
        }, 1000);
    }

    function initMap() {
        const map = L.map("map").setView([35.2, -77.9], 7);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }).addTo(map);
        if (!navigator.geolocation) {
            log("Geolocation not available.");
            return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude,
                lon = pos.coords.longitude;
            $("metaLatLon").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            map.setView([lat, lon], 12);
            L.marker([lat, lon]).addTo(map).bindPopup("You are here").openPopup();
            weather(lat, lon).catch(() => {});
        }, err => {
            log("Geolocation: " + err.message);
            $("weather").textContent = "Location permission needed for weather.";
        }, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000
        });
    }

    async function diagnostics() {
        diag.textContent = "";
        dlog("Worker origin: " + origin());
        dlog("API base: " + api());
        for (const [n, u] of [
                ["Worker /health", origin() + "/health"],
                ["Worker /test", origin() + "/test"],
                ["API /ping", api() + "/ping"],
                ["API /capabilities", api() + "/capabilities"],
                ["API threat", api() + "/tools/threat_board?limit=3"]
            ]) {
            const r = await fetchJSON(u, {}, 12000);
            dlog(`${n} -> ${r.status}`);
            if (!r.ok) dlog("  body: " + JSON.stringify(r.data).slice(0, 200));
        }
        dlog("Done.");
    }

    function drawer(open) {
        const d = $("drawer");
        d.classList.toggle("open", open);
        d.setAttribute("aria-hidden", open ? "false" : "true");
    }

    // --- Initialization ---
    document.addEventListener("DOMContentLoaded", () => {
        $("metaApi").textContent = api();
        $("apiBaseInput").value = origin();
        timeTicker();
        initMap();
        news().catch(() => {});
        threat().catch(() => {});
        diagnostics().catch(() => {});
        $("sendBtn").addEventListener("click", () => query().catch(e => log(String(e))));
        $("prompt").addEventListener("keydown", e => {
            if (e.key === "Enter") query().catch(() => {});
        });
        $("btnPing").addEventListener("click", () => ping().catch(() => {}));
        $("btnCapabilities").addEventListener("click", () => caps().catch(() => {}));
        $("btnClear").addEventListener("click", () => {
            term.textContent = "";
        });
        $("btnDrawer").addEventListener("click", () => drawer(true));
        $("btnCloseDrawer").addEventListener("click", () => drawer(false));
        $("btnDiag").addEventListener("click", () => diagnostics().catch(() => {}));
        $("btnSaveApi").addEventListener("click", () => {
            const v = $("apiBaseInput").value.trim();
            if (v) localStorage.setItem(LS, v.replace(/\/$/, ""));
            $("metaApi").textContent = api();
            log("Saved worker origin: " + origin());
            diagnostics().catch(() => {});
        });
        $("btnNews").addEventListener("click", () => news().catch(() => {}));
        $("btnEmergency").addEventListener("click", () => {
            log("Emergency mode placeholder.");
            $("arcCore").style.boxShadow = "0 0 24px rgba(255,59,59,.45), inset 0 0 14px rgba(255,59,59,.25)";
            setTimeout(() => {
                $("arcCore").style.boxShadow = "0 0 18px rgba(0,246,255,.35), inset 0 0 12px rgba(0,246,255,.25)";
            }, 900);
        });
        log("HUD ready.");
    });
})();
