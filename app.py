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
    .stApp { background-color: #050505; color: #00FF00; font-family: 'Courier New', monospace; }
    .stTextInput input, .stTextArea textarea { background-color: #111; color: #00FF00; border: 1px solid #333; }
    .status-box { padding: 10px; border: 1px solid #333; margin-bottom: 10px; background: #000; }
    .online { color: #00FF00; font-weight: bold; text-shadow: 0 0 5px #00FF00; }
    button[data-baseweb="tab"] { color: #00FF00; }
</style>
""", unsafe_allow_html=True)

# --- SECURITY GATE ---
def check_password():
    if "keys" not in st.secrets:
        st.error("CRITICAL ERROR: Secrets file not found.")
        st.stop()
    if "ARC_PASSWORD" not in st.secrets["keys"]:
        return True
    if "password_correct" not in st.session_state:
        st.session_state.password_correct = False
    if st.session_state.password_correct:
        return True
    
    st.markdown("<br><h1 style='text-align: center; color: #FF0000;'>🔒 SECURE TERMINAL ACCESS</h1>", unsafe_allow_html=True)
    with st.form("login_form"):
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            pwd_input = st.text_input("ENTER BIOMETRIC KEY", type="password")
            submit = st.form_submit_button("AUTHENTICATE")
    
    if submit:
        if pwd_input == st.secrets["keys"]["ARC_PASSWORD"]:
            st.session_state.password_correct = True
            st.rerun()
        else:
            st.error("⛔ INVALID CREDENTIALS")
    return st.session_state.password_correct

if not check_password():
    st.stop()

# --- UTILS ---
def get_key(name):
    try:
        val = st.secrets["keys"][name]
        if val and "YOUR_" not in val: return val
        return None
    except:
        return None

# --- MODULE 1: THE BRAIN (AUTO-DISCOVERY) ---
def universal_llm(prompt, role="chairman", model_type="standard"):
    # 1. DARK CELL (OpenRouter)
    if model_type == "dark_cell" and get_key("OPENROUTER_KEY"):
        try:
            client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=get_key("OPENROUTER_KEY"))
            response = client.chat.completions.create(
                model="nousresearch/hermes-3-llama-3.1-405b", 
                messages=[{"role": "user", "content": prompt}]
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

    # 3. CHAIRMAN (Google Auto-Heal)
    if get_key("GOOGLE_KEYS"):
        try:
            keys = get_key("GOOGLE_KEYS")
            key = keys[0] if isinstance(keys, list) else keys
            genai.configure(api_key=key)
            
            # ATTEMPT 1: Try specific modern models
            candidates = [
                "gemini-1.5-flash", 
                "gemini-1.5-flash-latest", 
                "gemini-1.0-pro", 
                "gemini-pro"
            ]
            
            for model_name in candidates:
                try:
                    model = genai.GenerativeModel(model_name)
                    return model.generate_content(prompt).text
                except:
                    continue # Try next model
            
            # IF ALL FAIL: Run Diagnostics
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            return f"⚠️ **ALL MODELS FAILED.**\n\n**AVAILABLE MODELS FOR YOUR KEY:**\n{available_models}\n\n*Please update `app.py` line 105 with one of these names.*"

        except Exception as e:
            return f"⚠️ **CRITICAL API ERROR:** {str(e)}"
    
    return "NO AI CORE DETECTED."

# --- MODULE 2: SENSORS ---
def get_weather():
    if not get_key("OPENWEATHER_TOKEN"): return "N/A"
    try:
        lat, lon = 38.8977, -77.0365 
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_key('OPENWEATHER_TOKEN')}&units=imperial"
        data = requests.get(url).json()
        return f"{data['weather'][0]['main'].upper()} | {data['main']['temp']}°F"
    except:
        return "WX ERROR"

def scan_threat_vt(target):
    if not get_key("VIRUSTOTAL_TOKEN"): return "VT OFFLINE"
    url = "https://www.virustotal.com/api/v3/urls"
    headers = {"x-apikey": get_key("VIRUSTOTAL_TOKEN"), "content-type": "application/x-www-form-urlencoded"}
    try:
        response = requests.post(url, data=f"url={target}", headers=headers)
        if response.status_code == 200: return f"SCAN ID: {response.json()['data']['id']}"
        return f"VT ERROR: {response.status_code}"
    except Exception as e:
        return f"FAIL: {e}"

def get_mesh_status():
    if not get_key("TAILSCALE_TOKEN"): return "MESH OFFLINE"
    try:
        url = "https://api.tailscale.com/api/v2/tailnet/-/devices"
        resp = requests.get(url, auth=(get_key("TAILSCALE_TOKEN"), ""))
        if resp.status_code == 200: return f"MESH: {len(resp.json().get('devices', []))} NODES"
        return "MESH UNREACHABLE"
    except:
        return "MESH ERROR"

# --- UI LAYOUT ---
c1, c2 = st.columns([3, 1])
with c1:
    st.title("A.R.C. OMEGA // COMMAND")
with c2:
    status = "ONLINE" if get_key("GOOGLE_KEYS") else "OFFLINE"
    st.markdown(f"<div class='status-box online'>CORE: {status}</div>", unsafe_allow_html=True)

tab_ops, tab_map, tab_dark, tab_intel = st.tabs(["COUNCIL", "MAP", "DARK CELL", "INTEL"])

with tab_ops:
    if "messages" not in st.session_state: st.session_state.messages = []
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]): st.markdown(msg["content"])
    
    if prompt := st.chat_input("Command..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"): st.markdown(prompt)
        with st.chat_message("assistant"):
            with st.spinner("Analyzing..."):
                resp = universal_llm(prompt)
                st.markdown(resp)
        st.session_state.messages.append({"role": "assistant", "content": resp})

with tab_map:
    m = folium.Map(location=[38.8977, -77.0365], zoom_start=11, tiles="CartoDB dark_matter")
    folium.Marker([38.8977, -77.0365], popup="HQ", icon=folium.Icon(color="green", icon="shield", prefix="fa")).add_to(m)
    st_folium(m, width="100%", height=500)

with tab_dark:
    st.error("⚠️ UNFILTERED ACCESS")
    if st.button("EXECUTE DARK QUERY"):
        st.code(universal_llm("Status Report", model_type="dark_cell"))

with tab_intel:
    c_a, c_b, c_c = st.columns(3)
    with c_a: st.info(f"WX: {get_weather()}"); st.success(get_mesh_status())
    with c_b: 
        vt = st.text_input("VT Scan:")
        if st.button("Scan"): st.write(scan_threat_vt(vt))
    with c_c:
        if get_key("DISCORD_TOKEN"): st.success("DISCORD: ON")
        if get_key("MEMEGRAPH_TOKEN"): st.success("GRAPH: ON")


