(() => {
    // ARC OMEGA Frontend v15 (Hydra Protocol)
    const DEFAULT_ORIGIN = "[https://arc-omega-api.dcain1.workers.dev](https://arc-omega-api.dcain1.workers.dev)";
    const LS = "arc_worker_origin_v15";
    const $ = id => document.getElementById(id);
    const term = $("terminal");
    
    // LOGGER: Enhanced to show Source
    function log(m, source="SYS") {
        const ts = new Date().toISOString().slice(11, 19);
        if(term) {
            term.textContent += `[${ts}][${source}] ${m}\n`;
            term.scrollTop = term.scrollHeight;
        }
    }

    // ROBUST FETCHER: Handles JSON parsing errors
    async function fetchJSON(url, opts = {}, ms = 15000) {
        const c = new AbortController();
        const id = setTimeout(() => c.abort("timeout"), ms);
        try {
            const res = await fetch(url, { ...opts, signal: c.signal });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            return { ok: res.ok, status: res.status, headers: res.headers, data };
        } catch (e) {
             return { ok: false, status: 0, data: { error: e.message } };
        } finally { clearTimeout(id); }
    }

    function api() { 
        return (localStorage.getItem(LS) || DEFAULT_ORIGIN).replace(/\/$/, "") + "/api"; 
    }

    // --- CORE LOGIC ---
    
    async function query() {
        const inp = $("prompt");
        const msg = inp.value.trim();
        if (!msg) return;
        
        log(msg, "YOU");
        inp.value = ""; // clear immediately
        
        // UI FEEDBACK: Show we are working
        const btn = $("sendBtn");
        const ogText = btn.textContent;
        btn.textContent = "...";
        
        const r = await fetchJSON(api() + "/query", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });
        
        btn.textContent = ogText;

        if (!r.ok) { 
            log(`Comms Failure (${r.status}): ${r.data.error || "Unknown"}`, "ERR"); 
            return; 
        }

        // Show which model the Swarm chose
        const model = r.data.model || "Unknown";
        log(r.data.reply, `ARC:${model}`);
    }

    // --- ISOLATED SUBSYSTEMS ---
    // Each system is independent. Failure in one does not stop the others.

    async function initWeather(lat, lon) {
        try {
            const r = await fetchJSON(api() + `/tools/weather?lat=${lat}&lon=${lon}`);
            if(!r.ok) throw new Error("API Error");
            $("weather").textContent = `${r.data.temp_f ?? "--"}°F`;
            $("weatherMeta").textContent = `Wind: ${r.data.wind_mph ?? "--"}mph`;
        } catch(e) {
            $("weather").textContent = "N/A"; // Graceful UI
            console.warn("Weather subsystem failed", e);
        }
    }

    async function initNews() {
        try {
            const r = await fetchJSON(api() + "/tools/news");
            if(!r.ok) throw new Error("API Error");
            const heads = r.data.headlines || ["No intel."];
            let i = 0;
            const tick = () => {
                $("newsTicker").textContent = "Intel: " + (heads[i] || "End of feed");
                i = (i+1) % heads.length;
            };
            tick();
            setInterval(tick, 8000);
        } catch(e) {
            $("newsTicker").textContent = "Intel Feed: Offline";
        }
    }

    function initMap() {
        // Redundant checks for Leaflet
        if (typeof L === 'undefined') {
            if($("map")) $("map").innerHTML = "<div style='padding:20px;color:#444'>Map Module Offline</div>";
            return;
        }
        try {
            const map = L.map("map").setView([34.75, -77.43], 10);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
            
            // Try to get real location, fallback to J-ville silently
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const { latitude, longitude } = pos.coords;
                    map.setView([latitude, longitude], 12);
                    L.marker([latitude, longitude]).addTo(map);
                    $("metaLatLon").textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    initWeather(latitude, longitude);
                },
                () => {
                    log("GPS unavailable. Using default AO.", "SYS");
                    initWeather(34.75, -77.43);
                }
            );
        } catch (e) {
            log("Map render failed. Continuing...", "SYS");
        }
    }

    // --- STARTUP SEQUENCE ---
    document.addEventListener("DOMContentLoaded", () => {
        // 1. Establish Time (Local-only, can't fail)
        setInterval(() => {
            const now = new Date();
            $("timeTicker").textContent = `LOC: ${now.toLocaleTimeString()} | UTC: ${now.toISOString().slice(11,19)}`;
        }, 1000);

        // 2. Attach Listeners (Safe)
        $("sendBtn").addEventListener("click", () => query().catch(e=>log(e)));
        $("prompt").addEventListener("keydown", e => { if(e.key==="Enter") query().catch(()=>{}); });
        
        $("btnSitrep").addEventListener("click", () => {
            $("prompt").value = "SITREP";
            query().catch(e=>log(e));
        });
        
        // 3. Launch Subsystems (Async & Independent)
        // We use a slight delay to let the UI paint first
        setTimeout(() => {
            initMap(); // Includes Weather trigger
            initNews();
            
            // Check connectivity
            fetchJSON(api() + "/ping", {}, 3000).then(r => {
                if(r.ok) log(`System Online (v${r.data.version || 15})`, "NET");
                else log("Backend Unreachable - Check Connection", "WRN");
            });
        }, 100);
    });

})();
