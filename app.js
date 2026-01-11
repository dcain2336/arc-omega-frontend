(() => {
    // ARC OMEGA Frontend v14 (OpenCode Enabled)
    const DEFAULT_ORIGIN = "[https://arc-omega-api.dcain1.workers.dev](https://arc-omega-api.dcain1.workers.dev)";
    const LS = "arc_worker_origin_v13";
    const $ = id => document.getElementById(id);
    const term = $("terminal");
    const diag = $("diag");

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
    
    function origin() { return (localStorage.getItem(LS) || DEFAULT_ORIGIN).replace(/\/$/, ""); }
    function api() { return origin() + "/api"; }

    async function fetchJSON(url, opts = {}, ms = 14000) {
        const c = new AbortController();
        const id = setTimeout(() => c.abort("timeout"), ms);
        try {
            const res = await fetch(url, { ...opts, signal: c.signal });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            return { ok: res.ok, status: res.status, headers: res.headers, data };
        } finally { clearTimeout(id); }
    }

    function setUp(headers) { $("metaApi").textContent = api(); }

    async function query() {
        const msg = $("prompt").value.trim();
        if (!msg) return;
        log("YOU: " + msg);
        const r = await fetchJSON(api() + "/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });
        if (!r.ok) { log(`QUERY ERROR: ${r.status}`); return; }
        log("ARC: " + (r.data.reply || JSON.stringify(r.data)));
    }

    // --- OPENCODE FUNCTION ---
    async function runOpenCode() {
        const code = $("codeInput").value;
        if(!code.trim()) { $("codeOutput").textContent="No code entered."; return; }
        
        $("codeOutput").textContent="Running...";
        const r = await fetchJSON(api() + "/tools/opencode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: code })
        });
        
        if(!r.ok) {
            $("codeOutput").textContent = `Error ${r.status}: ${JSON.stringify(r.data)}`;
            return;
        }
        
        const out = r.data.stdout || "";
        const err = r.data.stderr || "";
        const res = (out + "\n" + (err ? "ERR:\n" + err : "")).trim() || "[No output]";
        $("codeOutput").textContent = res;
        log(`[OpenCode] Execution complete.`);
    }

    async function news() {
        const r = await fetchJSON(api() + "/tools/news");
        if (!r.ok) { $("newsTicker").textContent = "News: unavailable"; return; }
        const heads = r.data.headlines || [];
        let i = 0;
        $("newsTicker").textContent = "News: " + (heads[0] || "—");
        setInterval(() => {
            i = (i + 1) % Math.max(1, heads.length);
            $("newsTicker").textContent = "News: " + (heads[i] || "—");
        }, 8000);
    }

    async function weather(lat, lon) {
        const r = await fetchJSON(api() + `/tools/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        if (!r.ok) { $("weather").textContent = "Weather unavailable"; return; }
        $("weather").textContent = `${r.data.temp_f ?? "—"}°F • ${r.data.summary ?? ""}`;
        $("weatherMeta").textContent = `Wind: ${r.data.wind_mph ?? "—"} mph • Humidity: ${r.data.humidity ?? "—"}%`;
    }

    async function threat() {
        const r = await fetchJSON(api() + "/tools/threat_board?limit=10");
        if (!r.ok) return;
        const items = r.data.items || [];
        $("threat").textContent = items.map(x => `• ${x.title}`).join("\n") || "No items.";
    }

    async function diagnostics() {
        diag.textContent = "";
        dlog("Checking connection...");
        const r = await fetchJSON(api() + "/ping", {}, 5000);
        dlog(`API Ping: ${r.status} ${r.ok ? "OK" : "FAIL"}`);
        if(r.ok) dlog(`Version: ${r.data.version}`);
    }

    // MAP & TIME
    function timeTicker() {
        setInterval(() => {
            const now = new Date();
            $("timeTicker").textContent = "Time: " + now.toLocaleTimeString() + " | UTC: " + now.toISOString().slice(11,19);
        }, 1000);
    }

    function initMap() {
        const map = L.map("map").setView([34.75, -77.43], 10); // Default to Jacksonville NC
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude: lat, longitude: lon } = pos.coords;
                $("metaLatLon").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
                map.setView([lat, lon], 12);
                L.marker([lat, lon]).addTo(map).bindPopup("User Loc").openPopup();
                weather(lat, lon);
            });
        }
    }

    function drawer(open) {
        const d = $("drawer");
        d.classList.toggle("open", open);
        d.setAttribute("aria-hidden", open ? "false" : "true");
    }

    document.addEventListener("DOMContentLoaded", () => {
        $("metaApi").textContent = api();
        $("apiBaseInput").value = origin();
        timeTicker();
        initMap();
        news().catch(()=>{});
        threat().catch(()=>{});
        
        $("sendBtn").addEventListener("click", () => query().catch(e => log(String(e))));
        $("prompt").addEventListener("keydown", e => { if (e.key === "Enter") query().catch(()=>{}); });
        
        // OpenCode Listeners
        $("btnRunCode").addEventListener("click", () => runOpenCode().catch(e => log("Code Error: "+e)));
        $("btnClearCode").addEventListener("click", () => { $("codeInput").value=""; $("codeOutput").textContent=""; });

        $("btnSitrep").addEventListener("click", () => {
            $("prompt").value = "Generate Morning SITREP";
            query().catch(e => log(String(e)));
        });

        $("btnPing").addEventListener("click", () => diagnostics().catch(()=>{}));
        $("btnClear").addEventListener("click", () => { term.textContent = ""; });
        $("btnDrawer").addEventListener("click", () => drawer(true));
        $("btnCloseDrawer").addEventListener("click", () => drawer(false));
        $("btnDiag").addEventListener("click", () => diagnostics().catch(()=>{}));
        $("btnSaveApi").addEventListener("click", () => {
            const v = $("apiBaseInput").value.trim();
            if (v) localStorage.setItem(LS, v.replace(/\/$/, ""));
            $("metaApi").textContent = api();
            diagnostics().catch(()=>{});
        });
        
        $("banner").style.display = "block";
        setTimeout(() => $("banner").style.display = "none", 3000);
        log("HUD v14 Initialized.");
    });
})();
