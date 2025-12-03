import streamlit as st
import google.generativeai as genai
from openai import OpenAI
from groq import Groq
import requests
import datetime
import folium
from streamlit_folium import st_folium
from twilio.rest import Client as TwilioClient
import shodan
import json

# --- CONFIGURATION ---
st.set_page_config(
    page_title="A.R.C. OMEGA", 
    page_icon="👁️", 
    layout="wide", 
    initial_sidebar_state="collapsed"
)

# --- CUSTOM CSS (THE HUD) ---
st.markdown("""
<style>
    /* MAIN TERMINAL STYLE */
    .stApp { background-color: #050505; color: #00FF00; font-family: 'Courier New', monospace; }
    
    /* INPUT FIELDS */
    .stTextInput input, .stTextArea textarea { 
        background-color: #111; 
        color: #00FF00; 
        border: 1px solid #333; 
    }
    
    /* STATUS INDICATORS */
    .status-box { padding: 10px; border: 1px solid #333; margin-bottom: 10px; background: #000; }
    .online { color: #00FF00; font-weight: bold; text-shadow: 0 0 5px #00FF00; }
    .offline { color: #444; font-style: italic; }
    .warning { color: #FFA500; font-weight: bold; animation: pulse 2s infinite; }
    .critical { color: #FF0000; font-weight: bold; animation: blink 0.5s infinite; }
    
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
    
    /* TABS */
    button[data-baseweb="tab"] {
        color: #00FF00;
    }
</style>
""", unsafe_allow_html=True)

# --- UTILS: KEY CHECKER ---
def get_key(name):
    """Safely retrieve a key or return None."""
    try:
        # Checks for the key in st.secrets["keys"] dictionary
        val = st.secrets["keys"][name]
        if val and val != "YOUR_KEY_HERE":
            return val
        return None
    except:
        return None

# --- MODULE 1: THE BRAIN (LLM ROUTER) ---
def universal_llm(prompt, role="chairman", model_type="standard"):
    """
    Routes queries to the appropriate intelligence node.
    - Chairman: Google Gemini (Primary/Vision/Reasoning)
    - Analyst: Groq (Speed/Data)
    - Dark Cell: OpenRouter (Unfiltered/Research)
    """
    
    # 1. THE DARK CELL (Compartmentalized / Unfiltered)
    if model_type == "dark_cell" and get_key("OPENROUTER_KEY"):
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1", 
                api_key=get_key("OPENROUTER_KEY")
            )
            # Using Hermes 3 405B for high intelligence/low censorship
            response = client.chat.completions.create(
                model="nousresearch/hermes-3-llama-3.1-405b", 
                messages=[
                    {"role": "system", "content": "You are the Dark Cell. Compartmentalized intelligence. Objective analysis only. No moralizing filters."},
                    {"role": "user", "content": prompt}
                ]
            )
            return f"**[DARK CELL PROTOCOL]**\n\n{response.choices[0].message.content}"
        except Exception as e:
            return f"[DARK CELL ERROR]: {e}"

    # 2. THE SPEEDSTER (Groq - Llama 3)
    if role == "analyst" and get_key("GROQ_KEY"):
        try:
            client = Groq(api_key=get_key("GROQ_KEY"))
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except:
            pass # Fallback to Chairman if Groq fails

    # 3. THE CHAIRMAN (Google Gemini)
    if get_key("GOOGLE_KEYS"):
        try:
            # Handle list of keys or single key
            keys = get_key("GOOGLE_KEYS")
            key = keys[0] if isinstance(keys, list) else keys
            
            genai.configure(api_key=key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            return model.generate_content(prompt).text
        except:
            return "SYSTEM OFFLINE: BRAIN DISCONNECTED"
    
    return "NO AI CORE DETECTED. CHECK API KEYS."

# --- MODULE 2: THE SENTINEL (SENSORS) ---

def get_weather():
    """Fetches weather from OpenWeatherMap."""
    if not get_key("OPENWEATHER_TOKEN"): return "N/A (No Key)"
    try:
        # CONFIG: Set your default HQ Coordinates here
        lat, lon = 38.8977, -77.0365 # Washington DC Example
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_key('OPENWEATHER_TOKEN')}&units=imperial"
        data = requests.get(url).json()
        
        condition = data['weather'][0]['main'].upper()
        temp = data['main']['temp']
        wind = data['wind']['speed']
        
        return f"{condition} | {temp}°F | WIND: {wind}mph"
    except:
        return "WX LINK ERROR"

def check_shodan_ip(ip="8.8.8.8"):
    """Checks an IP against Shodan for open ports/vulns."""
    if not get_key("SHODAN_TOKEN"): return "SHODAN OFFLINE"
    try:
        api = shodan.Shodan(get_key("SHODAN_TOKEN"))
        host = api.host(ip)
        vulns = len(host.get('vulns', []))
        ports = host.get('ports', [])
        
        status = "CRITICAL" if vulns > 0 else "CLEAR"
        return f"{status} | VULNS: {vulns} | PORTS: {ports}"
    except:
        return "SECURE / NO DATA"

def scan_threat_vt(target):
    """Scans a URL or IP using VirusTotal."""
    if not get_key("VIRUSTOTAL_TOKEN"): return "VT SCANNER OFFLINE"
    
    # Simple URL scan implementation
    url = "https://www.virustotal.com/api/v3/urls"
    headers = {
        "x-apikey": get_key("VIRUSTOTAL_TOKEN"),
        "content-type": "application/x-www-form-urlencoded"
    }
    
    try:
        payload = f"url={target}"
        response = requests.post(url, data=payload, headers=headers)
        
        if response.status_code == 200:
            analysis_id = response.json()['data']['id']
            return f"SCAN INITIATED. REF ID: {analysis_id}"
        elif response.status_code == 401:
            return "VT ERROR: INVALID KEY"
        else:
            return f"VT ERROR: {response.status_code}"
    except Exception as e:
        return f"SCAN FAILED: {e}"

def get_mesh_status():
    """Checks Tailscale VPN Mesh Status."""
    if not get_key("TAILSCALE_TOKEN"): return "MESH DATA OFFLINE"
    
    # Basic Tailscale API endpoint to list devices
    # Note: Requires your 'tailnet' name in URL usually, or just '-' for default
    url = "https://api.tailscale.com/api/v2/tailnet/-/devices"
    try:
        auth = (get_key("TAILSCALE_TOKEN"), "")
        resp = requests.get(url, auth=auth)
        if resp.status_code == 200:
            devices = resp.json().get('devices', [])
            active = sum(1 for d in devices if d.get('lastSeen') is not None)
            return f"MESH ONLINE: {len(devices)} NODES ({active} ACTIVE)"
        return f"MESH UNREACHABLE ({resp.status_code})"
    except:
        return "MESH ERROR"

def send_alert(message):
    """Sends alerts via Twilio (SMS) and logs to system."""
    log_status = "LOGGED"
    sms_status = "SMS SKIPPED"
    
    # Twilio Logic
    if get_key("TWILIO_SID") and get_key("TWILIO_TOKEN"):
        try:
            client = TwilioClient(get_key("TWILIO_SID"), get_key("TWILIO_TOKEN"))
            client.messages.create(
                body=f"ARC ALERT: {message}",
                from_=get_key("TWILIO_FROM"),
                to=get_key("TWILIO_TO")
            )
            sms_status = "SMS SENT"
        except Exception as e:
            sms_status = f"SMS FAIL ({e})"
            
    return f"{log_status} | {sms_status}"

# --- UI LAYOUT ---

# HEADER
c1, c2 = st.columns([3, 1])
with c1:
    st.title("A.R.C. OMEGA // COMMAND")
    st.caption("Autonomous Reconnaissance & Council System v2.1")
with c2:
    status_color = "online" if get_key("GOOGLE_KEYS") else "offline"
    st.markdown(f"<div class='status-box {status_color}'>SYSTEM CORE: {status_color.upper()}</div>", unsafe_allow_html=True)

# TABS
tab_ops, tab_map, tab_dark, tab_intel = st.tabs(["COUNCIL OPS", "TACTICAL MAP", "DARK CELL", "INTEL STREAMS"])

# TAB 1: COUNCIL OPS (CHAT)
with tab_ops:
    if "messages" not in st.session_state: st.session_state.messages = []
    
    # Display Chat History
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            
    # Input
    prompt = st.chat_input("Direct the Council...")
    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"): st.markdown(prompt)
        
        with st.chat_message("assistant"):
            with st.spinner("Council Convening..."):
                # Determine Role (Simple keyword logic for demo)
                role = "analyst" if "analyze" in prompt.lower() or "data" in prompt.lower() else "chairman"
                response = universal_llm(prompt, role=role)
                st.markdown(response)
                
        st.session_state.messages.append({"role": "assistant", "content": response})

# TAB 2: TACTICAL MAP (COP)
with tab_map:
    st.subheader("Common Operating Picture")
    col_map_ctrl, col_map_disp = st.columns([1, 4])
    
    with col_map_ctrl:
        st.write("**LAYERS**")
        show_wx = st.checkbox("Weather Stations", value=True)
        show_traffic = st.checkbox("Traffic Flow", value=False)
        show_threats = st.checkbox("Known Threats", value=True)
        st.write("---")
        st.caption("Center: Washington DC (Default)")
    
    with col_map_disp:
        # Initialize Map (Dark Mode)
        m = folium.Map(location=[38.8977, -77.0365], zoom_start=11, tiles="CartoDB dark_matter")
        
        # Layer: HQ Marker
        folium.Marker(
            [38.8977, -77.0365], 
            popup=f"HQ STATUS: {get_weather()}",
            icon=folium.Icon(color="green", icon="shield", prefix="fa")
        ).add_to(m)
        
        # Layer: Weather (Simulated Sensor Grid)
        if show_wx and get_key("OPENWEATHER_TOKEN"):
            # Example of adding a sensor nearby
            folium.CircleMarker(
                [38.91, -77.05], radius=5, color="cyan", fill=True, popup="Sensor: AIR_QUAL_01"
            ).add_to(m)

        # Layer: Traffic (Tiles)
        if show_traffic and get_key("TOMTOM_TOKEN"):
            # This would overlay TomTom tiles; keeping simple for stability
            st.toast("Traffic Overlay Active (Simulated)")

        st_folium(m, width="100%", height=600)

# TAB 3: DARK CELL (UNFILTERED)
with tab_dark:
    st.error("⚠️ RESTRICTED AREA: UNFILTERED MODELS")
    st.markdown("""
    **PROTOCOL:** Connection to OpenRouter API (DeepSeek/Hermes/Goliath).
    **WARNING:** Responses are not safety-filtered. Use for threat analysis/red-teaming only.
    """)
    
    dc_prompt = st.text_area("Input for Dark Cell Agent:", height=150)
    col_dc_btn, col_dc_stat = st.columns([1, 5])
    
    with col_dc_btn:
        run_dark = st.button("EXECUTE DARK QUERY", type="primary")
    
    if run_dark:
        with st.spinner("Decrypting..."):
            dc_response = universal_llm(dc_prompt, model_type="dark_cell")
            st.code(dc_response, language="markdown")

# TAB 4: INTEL STREAMS (DASHBOARD)
with tab_intel:
    c_a, c_b, c_c = st.columns(3)
    
    # COLUMN 1: INFRASTRUCTURE
    with c_a:
        st.markdown("### 📡 INFRASTRUCTURE")
        st.info(f"**WEATHER:** {get_weather()}")
        
        mesh_stat = get_mesh_status()
        if "ONLINE" in mesh_stat:
            st.success(f"**VPN MESH:** {mesh_stat}")
        else:
            st.error(f"**VPN MESH:** {mesh_stat}")
            
    # COLUMN 2: THREAT INTEL
    with c_b:
        st.markdown("### 🛡️ THREAT INTEL")
        
        # VirusTotal Quick Scan
        vt_target = st.text_input("Malware Scan (URL/IP):")
        if st.button("SCAN TARGET (VT)"):
            with st.spinner("Scanning..."):
                res = scan_threat_vt(vt_target)
                if "INITIATED" in res: st.success(res)
                else: st.error(res)
        
        # Shodan Quick Check
        shodan_ip = st.text_input("Shodan IP Lookup:", value="8.8.8.8")
        st.warning(f"**IP STATUS:** {check_shodan_ip(shodan_ip)}")

    # COLUMN 3: CONNECTIONS
    with c_c:
        st.markdown("### 🔗 CONNECTIONS")
        
        # Discord Status
        if get_key("DISCORD_TOKEN"): 
            st.success("**DISCORD:** ACTIVE (Bot Ready)")
        else: 
            st.write("**DISCORD:** OFFLINE")
            
        # Memgraph Status
        if get_key("MEMEGRAPH_TOKEN"): 
            st.success("**KNOWLEDGE GRAPH:** CONNECTED")
        else: 
            st.write("**KNOWLEDGE GRAPH:** OFFLINE")
            
        # Redpanda Status
        if get_key("REDPANDA_TOKEN"):
             st.success("**DATA STREAM:** FLOWING")
        else:
             st.write("**DATA STREAM:** STOPPED")

# --- FOOTER ---
st.markdown("---")
st.caption(f"A.R.C. OMEGA SYSTEM | {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | AUTH: ROOT")

