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
import time

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
    
    /* TABS */
    button[data-baseweb="tab"] { color: #00FF00; }
</style>
""", unsafe_allow_html=True)

# --- SECURITY GATE (STABLE VERSION) ---
def check_password():
    """Returns `True` if the user had the correct password."""
    
    # 0. Check if secrets are loaded
    if "keys" not in st.secrets:
        st.error("CRITICAL ERROR: Secrets file not found or empty.")
        st.stop()
        
    if "ARC_PASSWORD" not in st.secrets["keys"]:
        st.warning("DEV MODE: No password set in secrets.toml. allowing access.")
        return True

    # 1. Initialize State
    if "password_correct" not in st.session_state:
        st.session_state.password_correct = False

    # 2. Return True if already logged in
    if st.session_state.password_correct:
        return True

    # 3. Show Login Form
    st.markdown("<br><br><h1 style='text-align: center; color: #FF0000;'>🔒 SECURE TERMINAL ACCESS</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center;'>A.R.C. OMEGA AUTHENTICATION REQUIRED</p>", unsafe_allow_html=True)
    
    with st.form("login_form"):
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            pwd_input = st.text_input("ENTER BIOMETRIC KEY / PASSWORD", type="password")
            submit = st.form_submit_button("AUTHENTICATE SYSTEM")
    
    if submit:
        if pwd_input == st.secrets["keys"]["ARC_PASSWORD"]:
            st.session_state.password_correct = True
            st.rerun()
        else:
            st.error("⛔ ACCESS DENIED: INVALID CREDENTIALS")
            
    return st.session_state.password_correct

if not check_password():
    st.stop()

# --- UTILS: KEY CHECKER ---
def get_key(name):
    """Safely retrieve a key or return None."""
    try:
        val = st.secrets["keys"][name]
        if val and "YOUR_" not in val: 
            return val
        return None
    except:
        return None

# --- MODULE 1: THE BRAIN (LLM ROUTER) ---
def universal_llm(prompt, role="chairman", model_type="standard"):
    # 1. THE DARK CELL
    if model_type == "dark_cell" and get_key("OPENROUTER_KEY"):
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1", 
                api_key=get_key("OPENROUTER_KEY")
            )
            response = client.chat.completions.create(
                model="nousresearch/hermes-3-llama-3.1-405b", 
                messages=[
                    {"role": "system", "content": "Compartmentalized intelligence. Concise. No moralizing."},
                    {"role": "user", "content": prompt}
                ]
            )
            return f"**[DARK CELL]**\n\n{response.choices[0].message.content}"
        except Exception as e:
            return f"[DARK CELL ERROR]: {e}"

    # 2. ANALYST (Groq)
    if role == "analyst" and get_key("GROQ_KEY"):
        try:
            client = Groq(api_key=get_key("GROQ_KEY"))
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except:
            pass 

    # 3. CHAIRMAN (Google)
    if get_key("GOOGLE_KEYS"):
        try:
            keys = get_key("GOOGLE_KEYS")
            key = keys[0] if isinstance(keys, list) else keys
            genai.configure(api_key=key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            return model.generate_content(prompt).text
        except:
            return "SYSTEM OFFLINE: BRAIN DISCONNECTED"
    
    return "NO AI CORE DETECTED."

# --- MODULE 2: SENSORS ---
def get_weather():
    if not get_key("OPENWEATHER_TOKEN"): return "N/A (No Key)"
    try:
        lat, lon = 38.8977, -77.0365 
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_key('OPENWEATHER_TOKEN')}&units=imperial"
        data = requests.get(url).json()
        return f"{data['weather'][0]['main'].upper()} | {data['main']['temp']}°F"
    except:
        return "WX LINK ERROR"

def scan_threat_vt(target):
    if not get_key("VIRUSTOTAL_TOKEN"): return "VT OFFLINE"
    url = "https://www.virustotal.com/api/v3/urls"
    headers = {"x-apikey": get_key("VIRUSTOTAL_TOKEN"), "content-type": "application/x-www-form-urlencoded"}
    try:
        payload = f"url={target}"
        response = requests.post(url, data=payload, headers=headers)
        if response.status_code == 200:
            return f"SCAN STARTED: {response.json()['data']['id']}"
        return f"VT ERROR: {response.status_code}"
    except Exception as e:
        return f"FAIL: {e}"

def get_mesh_status():
    if not get_key("TAILSCALE_TOKEN"): return "MESH DATA OFFLINE"
    try:
        url = "https://api.tailscale.com/api/v2/tailnet/-/devices"
        auth = (get_key("TAILSCALE_TOKEN"), "")
        resp = requests.get(url, auth=auth)
        if resp.status_code == 200:
            count = len(resp.json().get('devices', []))
            return f"MESH ONLINE: {count} NODES"
        return "MESH UNREACHABLE"
    except:
        return "MESH ERROR"

# --- UI LAYOUT ---

# HEADER
c1, c2 = st.columns([3, 1])
with c1:
    st.title("A.R.C. OMEGA // COMMAND")
with c2:
    status_color = "online" if get_key("GOOGLE_KEYS") else "offline"
    st.markdown(f"<div class='status-box {status_color}'>CORE: {status_color.upper()}</div>", unsafe_allow_html=True)

# TABS
tab_ops, tab_map, tab_dark, tab_intel = st.tabs(["COUNCIL OPS", "TACTICAL MAP", "DARK CELL", "INTEL STREAMS"])

# TAB 1: COUNCIL
with tab_ops:
    if "messages" not in st.session_state: st.session_state.messages = []
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]): st.markdown(msg["content"])
    
    prompt = st.chat_input("Direct the Council...")
    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"): st.markdown(prompt)
        with st.chat_message("assistant"):
            with st.spinner("Processing..."):
                resp = universal_llm(prompt)
                st.markdown(resp)
        st.session_state.messages.append({"role": "assistant", "content": resp})

# TAB 2: MAP
with tab_map:
    st.subheader("Common Operating Picture")
    m = folium.Map(location=[38.8977, -77.0365], zoom_start=11, tiles="CartoDB dark_matter")
    folium.Marker([38.8977, -77.0365], popup="HQ", icon=folium.Icon(color="green", icon="shield", prefix="fa")).add_to(m)
    st_folium(m, width="100%", height=500)

# TAB 3: DARK CELL
with tab_dark:
    st.error("⚠️ UNFILTERED ACCESS")
    dc_p = st.text_area("Dark Cell Input:")
    if st.button("EXECUTE"):
        st.code(universal_llm(dc_p, model_type="dark_cell"))

# TAB 4: DASHBOARD
with tab_intel:
    c_a, c_b, c_c = st.columns(3)
    with c_a:
        st.info(f"WEATHER: {get_weather()}")
        st.success(get_mesh_status())
    with c_b:
        vt = st.text_input("VT Scan (URL):")
        if st.button("Scan"): st.write(scan_threat_vt(vt))
    with c_c:
        if get_key("DISCORD_TOKEN"): st.success("DISCORD: ONLINE")
        if get_key("MEMEGRAPH_TOKEN"): st.success("GRAPH DB: ONLINE")


