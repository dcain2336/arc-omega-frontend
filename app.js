(() => {
    // ARC OMEGA Frontend v15.1 (Fault Tolerant)
    const DEFAULT_ORIGIN = "https://arc-omega-api.dcain1.workers.dev";
    const LS = "arc_worker_origin_v15";
    const $ = id => document.getElementById(id);
    const term = $("terminal");
    
    // --- UTILS ---
    function log(m, source="SYS") {
        const ts = new Date().toISOString().slice(11, 19);
        if(term) {
            term.textContent += `[${ts}][${source}] ${m}\n`;
            term.scrollTop = term.scrollHeight;
        }
        console.log(`[${source}] ${m}`);
    }

    function api() { 
        // fallback to default if LS is empty
        let val = localStorage.getItem(LS);
        if(!val) val = DEFAULT_ORIGIN;
        return val.replace(/\/$/, "") + "/api"; 
    }

    async function fetchJSON(url, opts = {}, ms = 10000) {
        const c = new AbortController();
        const id = setTimeout(() => c.abort(), ms);
        try {
            const res = await fetch(url, { ...opts, signal: c.signal });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            return { ok: res.ok, status: res.status, data };
        } catch (e) {
             return { ok: false, status: 0, data: { error: e.message } };
        } finally { clearTimeout(id); }
    }

    // --- CORE ---
    async function query() {
        const inp = $("prompt");
        const msg = inp.value.trim();
        if (!msg) return;
        
        log(msg, "YOU");
        inp.value = ""; 
        
        const r = await fetchJSON(api() + "/query", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });

        if (!r.ok) { 
            // 405 SPECIFIC ERROR HANDLING
            if(r.status === 405) log("Error 405: Worker/Backend protocol mismatch (Check HTTPS)", "ERR");
            else log(`Error ${r.status}: ${r.data.error || "Unknown"}`, "ERR");
            return; 
        }

        log(r.data.reply, "ARC");
    }

    // --- BUTTON BINDER (Granular Safety) ---
    function safeBind(id, event, func) {
        const el = $(id);
        if(el) {
            el.addEventListener(event, func);
        } else {
            console.warn(`Button ${id} missing in HTML.`);
        }
    }

    // --- INIT ---
    document.addEventListener("DOMContentLoaded", () => {
        // 1. Set API Visual
        const apiUrl = api();
        if($("metaApi")) $("metaApi").textContent = apiUrl;
        
        // 2. Bind Controls (Safe Mode)
        safeBind("sendBtn", "click", () => query().catch(e=>log(e)));
        safeBind("prompt", "keydown", e => { if(e.key==="Enter") query().catch(()=>{}); });
        
        safeBind("btnSitrep", "click", () => {
            $("prompt").value = "SITREP";
            query().catch(e=>log(e));
        });

        safeBind("btnPing", "click", async () => {
            log("Pinging...", "NET");
            const r = await fetchJSON(api() + "/ping");
            if(r.ok) log(`Pong! Backend v${r.data.version}`, "NET");
            else log(`Ping Failed: ${r.status}`, "ERR");
        });

        safeBind("btnClear", "click", () => { if(term) term.textContent = ""; });
        
        // Drawer Controls
        safeBind("btnDrawer", "click", () => $("drawer").classList.add("open"));
        safeBind("btnCloseDrawer", "click", () => $("drawer").classList.remove("open"));
        
        // API Saver
        if($("apiBaseInput")) $("apiBaseInput").value = apiUrl.replace("/api", "");
        safeBind("btnSaveApi", "click", () => {
            const v = $("apiBaseInput").value.trim();
            if(v) {
                localStorage.setItem(LS, v.replace(/\/$/, ""));
                if($("metaApi")) $("metaApi").textContent = api();
                log("API Origin Saved.", "SYS");
            }
        });

        // 3. Auto-Start Systems
        setTimeout(() => {
            // Clock
            setInterval(() => {
                const now = new Date();
                if($("timeTicker")) $("timeTicker").textContent = `LOC: ${now.toLocaleTimeString()}`;
            }, 1000);

            // Weather/Map (Isolated)
            if(typeof L !== 'undefined') {
                try {
                    const map = L.map("map").setView([34.75, -77.43], 10);
                    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18}).addTo(map);
                } catch(e) { console.log("Map Error", e); }
            }
            
            // Check Network
            fetchJSON(api() + "/ping", {}, 5000).then(r => {
                if(r.ok) log("System Online (v15.1)", "NET");
                else log("Backend Offline or Address Wrong", "WRN");
            });

        }, 500);
    });
})();
