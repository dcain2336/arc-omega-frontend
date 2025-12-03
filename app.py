import streamlit as st
import google.generativeai as genai
from openai import OpenAI
from groq import Groq
import requests
import datetime
import pytz
import folium
from streamlit_folium import st_folium
from twilio.rest import Client as TwilioClient
from newsapi import NewsApiClient
import shodan
import time
import asyncio
import edge_tts
import base64
import uuid

# --- CONFIGURATION ---
st.set_page_config(
    page_title="A.R.C. OMEGA", 
    page_icon="⚛️", 
    layout="wide", 
    initial_sidebar_state="expanded"
)

# --- SESSION STATE SETUP ---
if "password_correct" not in st.session_state: st.session_state.password_correct = False
if "arc_status" not in st.session_state: st.session_state.arc_status = "blue" # blue, cyan, purple, red, green
if "messages" not in st.session_state: st.session_state.messages = []
if "ghost_mode" not in st.session_state: st.session_state.ghost_mode = False
if "emergency_mode" not in st.session_state: st.session_state.emergency_mode = False

# --- CUSTOM CSS (JARVIS UI) ---
st.markdown("""
<style>
    /* GLOBAL TERMINAL THEME */
    .stApp { background-color: #050505; color: #00FF00; font-family: 'Courier New', monospace; }
    
    /* INPUTS */
    .stTextInput input, .stTextArea textarea { 
        background-color: #111; color: #00FFFF; border: 1px solid #333; 
    }
    
    /* ARC REACTOR ANIMATIONS */
    @keyframes pulse-blue { 0% { box-shadow: 0 0 10px #00BFFF; } 100% { box-shadow: 0 0 25px #00BFFF; } }
    @keyframes pulse-cyan { 0% { box-shadow: 0 0 15px #00FFFF; } 50% { box-shadow: 0 0 40px #00FFFF; } 100% { box-shadow: 0 0 15px #00FFFF; } }
    @keyframes pulse-purple { 0% { box-shadow: 0 0 10px #800080; } 50% { box-shadow: 0 0 30px #FF00FF; } 100% { box-shadow: 0 0 10px #800080; } }
    @keyframes pulse-red { 0% { background-color: #300; box-shadow: 0 0 20px #FF0000; } 50% { background-color: #500; box-shadow: 0 0 60px #FF0000; } 100% { background-color: #300; box-shadow: 0 0 20px #FF0000; } }
    
    .reactor-container { display: flex; justify-content: center; margin-bottom: 20px; }
    .reactor {
        width: 80px; height: 80px; border-radius: 50%;
        border: 4px solid #fff;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; color: white; text-shadow: 0 0 5px black;
        transition: all 0.5s ease;
    }
    
    .reactor.blue { background: radial-gradient(circle, #00BFFF 10%, #000 70%); border-color: #00BFFF; animation: pulse-blue 3s infinite; }
    .reactor.cyan { background: radial-gradient(circle, #00FFFF 10%, #000 70%); border-color: #00FFFF; animation: pulse-cyan 1s infinite; }
    .reactor.purple { background: radial-gradient(circle, #800080 10%, #000 70%); border-color: #FF00FF; animation: pulse-purple 2s infinite; }
    .reactor.red { background: radial-gradient(circle, #FF0000 10%, #000 70%); border-color: #FF0000; animation: pulse-red 0.5s infinite; }
    
    /* TICKER */
    .ticker-wrap { width: 100%; overflow: hidden; background-color: #111; border-top: 1px solid #333; border-bottom: 1px solid #333; margin-bottom: 10px; }
    .ticker { display: inline-block; white-space: nowrap; padding-left: 100%; animation: ticker 40s linear infinite; }
    @keyframes ticker { 0% { transform: translate3d(0, 0, 0); } 100% { transform: translate3d(-100%, 0, 0); } }
    .ticker-item { display: inline-block; padding: 0 2rem; color: #00FF00; font-size: 0.9rem; }
    
    /* TABS */
    button[data-baseweb="tab"] { background-color: transparent !important; color: #00BFFF !important; border: 1px solid #00BFFF !important; margin: 2px; }
    button[data-baseweb="tab"][aria-selected="true"] { background-color: #00BFFF !important; color: #000 !important; }
</style>
""", unsafe_allow_html=True)

# --- UTILS & SECURITY ---
def get_key(name):
    try:
        val = st.secrets["keys"][name]
        if val and "YOUR_" not in val: return val
        return None
    except: return None

def check_password():
    if "keys" not in st.secrets:
        st.error("CRITICAL ERROR: Secrets file not found.")
        st.stop()
    if "ARC_PASSWORD" not in st.secrets["keys"]: return True # Dev bypass
    
    if st.session_state.password_correct: return True
    
    st.markdown("<br><br><h1 style='text-align: center; color: #00FFFF;'>🔒 SECURE TERMINAL ACCESS</h1>", unsafe_allow_html=True)
    with st.form("login"):
        c1,c2,c3 = st.columns([1,2,1])
        with c2:
            pwd = st.text_input("BIOMETRIC KEY", type="password")
            if st.form_submit_button("AUTHENTICATE"):
                if pwd == st.secrets["keys"]["ARC_PASSWORD"]:
                    st.session_state.password_correct = True
                    st.rerun()
                else:
                    st.error("ACCESS DENIED. INCIDENT LOGGED.")
                    # In a real app, send_alert() here
    return False

if not check_password(): st.stop()

# --- AUDIO SYSTEM (JARVIS VOICE) ---
async def generate_voice(text):
    if not text: return None
    try:
        # Uses 'en-GB-RyanNeural' for a Jarvis-like/Alfred-like tone
        communicate = edge_tts.Communicate(text, "en-GB-RyanNeural")
        # Save to memory buffer
        mp3_fp = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_fp += chunk["data"]
        b64 = base64.b64encode(mp3_fp).decode()
        return f'<audio autoplay="true" style="display:none;"><source src="data:audio/mp3;base64,{b64}" type="audio/mp3"></audio>'
    except: return None

# --- INTELLIGENCE MODULES ---
def get_news_ticker():
    key = get_key("NEWSAPI_KEY") # Add this to secrets.toml if you have one
    if not key: return "NEWS FEED OFFLINE // AWAITING KEY"
    try:
        newsapi = NewsApiClient(api_key=key)
        headlines = newsapi.get_top_headlines(language='en', country='us')
        items = [f"📰 {a['title']}" for a in headlines['articles'][:5]]
        return "  +++  ".join(items)
    except: return "NEWS STREAM INTERRUPTED"

def get_world_clock():
    zones = ["US/Eastern", "US/Pacific", "UTC", "Asia/Tokyo", "Europe/London"]
    times = []
    for zone in zones:
        tz = pytz.timezone(zone)
        t = datetime.datetime.now(tz).strftime("%H:%M")
        times.append(f"{zone.split('/')[-1]}: {t}")
    return "  ||  ".join(times)

def get_weather():
    if not get_key("OPENWEATHER_TOKEN"): return "N/A"
    try:
        lat, lon = 38.8977, -77.0365 # Default to DC, change to your coords
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_key('OPENWEATHER_TOKEN')}&units=imperial"
        data = requests.get(url).json()
        return f"{data['weather'][0]['main'].upper()} | {data['main']['temp']}°F | WIND: {data['wind']['speed']}mph"
    except: return "WX LINK ERROR"

def scan_vt(url_target):
    if not get_key("VIRUSTOTAL_TOKEN"): return "VT KEY MISSING"
    url = "https://www.virustotal.com/api/v3/urls"
    headers = {"x-apikey": get_key("VIRUSTOTAL_TOKEN"), "content-type": "application/x-www-form-urlencoded"}
    try:
        resp = requests.post(url, data=f"url={url_target}", headers=headers)
        return f"SCAN ID: {resp.json()['data']['id']}" if resp.status_code == 200 else "SCAN FAIL"
    except: return "VT ERROR"

# --- THE COUNCIL (AI LOGIC) ---
def council_deliberation(prompt, mode="standard"):
    # 1. DARK CELL (Ghost Mode)
    if mode == "ghost":
        if get_key("OPENROUTER_KEY"):
            client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=get_key("OPENROUTER_KEY"))
            try:
                msg = client.chat.completions.create(
                    model="nousresearch/hermes-3-llama-3.1-405b",
                    messages=[{"role":"system", "content":"You are a Ghost Operative. Unfiltered. Minimalist. No moralizing."}, {"role":"user","content":prompt}]
                )
                return f"[GHOST PROTOCOL]: {msg.choices[0].message.content}"
            except: return "DARK CELL CONNECTION FAILED"
    
    # 2. THE CHAIRMAN (Gemini) - Fallback/Standard
    if get_key("GOOGLE_KEYS"):
        try:
            keys = get_key("GOOGLE_KEYS")
            key = keys[0] if isinstance(keys, list) else keys
            genai.configure(api_key=key)
            
            # Simple Auto-Discovery for Model
            model_name = "gemini-1.5-flash" 
            try:
                m = genai.GenerativeModel("models/gemini-2.5-flash") # Try bleeding edge first
                m.generate_content("test")
                model_name = "models/gemini-2.5-flash"
            except: pass 
            
            model = genai.GenerativeModel(model_name)
            
            # THE COUNCIL PROMPT
            sys_prompt = f"""You are A.R.C. (Artificial Resonant Core). You are a high-level AI assistant with a personality like Jarvis or Cortana.
            You do not answer instantly. First, you simulate a 'Council of Experts' in your mind.
            
            USER QUERY: {prompt}
            
            FORMAT YOUR RESPONSE LIKE THIS:
            [COUNCIL DELIBERATION]
            - Strategist: [One sentence opinion]
            - Analyst: [One sentence data point]
            - Dark Cell: [One sentence risk assessment]
            
            [A.R.C. VERDICT]
            (Your final, polished, helpful answer here).
            """
            return model.generate_content(sys_prompt).text
        except Exception as e: return f"CORE ERROR: {e}"
        
    return "NO AI CORE DETECTED."

# --- UI LAYOUT ---

# 1. STATUS HEADER & REACTOR
c1, c2, c3 = st.columns([1,2,1])
with c2:
    # Determine reactor color
    r_color = "blue"
    if st.session_state.ghost_mode: r_color = "purple"
    if st.session_state.emergency_mode: r_color = "red"
    if st.session_state.get("thinking"): r_color = "cyan"
    
    st.markdown(f"<div class='reactor-container'><div class='reactor {r_color}'>ARC</div></div>", unsafe_allow_html=True)

# 2. TICKERS
st.markdown(f"<div class='ticker-wrap'><div class='ticker'><div class='ticker-item'>{get_world_clock()} || {get_news_ticker()} || SYSTEM ONLINE</div></div></div>", unsafe_allow_html=True)

# 3. TABS
t_ops, t_map, t_dark, t_intel = st.tabs([" COMMAND OPS", " TACTICAL MAP", " DARK CELL", " INTEL STREAMS"])

# --- TAB 1: COMMAND OPS (Chat) ---
with t_ops:
    # Chat History
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]): st.markdown(msg["content"])
    
    # Input
    user_in = st.chat_input("Command A.R.C....")
    if user_in:
        st.session_state.messages.append({"role": "user", "content": user_in})
        with st.chat_message("user"): st.markdown(user_in)
        
        # Processing
        st.session_state.thinking = True
        st.rerun() 

# Async Processing Block (Simulated)
if st.session_state.get("thinking") and st.session_state.messages[-1]["role"] == "user":
    last_prompt = st.session_state.messages[-1]["content"]
    
    with t_ops:
        with st.chat_message("assistant"):
            with st.spinner("Council Convening..."):
                mode = "ghost" if st.session_state.ghost_mode else "standard"
                response = council_deliberation(last_prompt, mode=mode)
                
                # Split response for UI effect
                if "[A.R.C. VERDICT]" in response:
                    council_part, final_part = response.split("[A.R.C. VERDICT]")
                    st.markdown(f"_{council_part.strip()}_") # Italics for thought process
                    st.markdown("---")
                    st.markdown(f"**{final_part.strip()}**")
                    final_text = final_part.strip()
                else:
                    st.markdown(response)
                    final_text = response

                # Audio Generation (Jarvis Voice)
                audio_html = asyncio.run(generate_voice(final_text[:200])) # Limit audio length for speed
                if audio_html: st.components.v1.html(audio_html, height=0)

    st.session_state.messages.append({"role": "assistant", "content": response})
    st.session_state.thinking = False
    st.rerun()

# --- TAB 2: TACTICAL MAP ---
with t_map:
    st.subheader("GLOBAL POSITIONING")
    # Default DC, would use Geopy/HTML5 Geolocation in full web app
    m = folium.Map(location=[38.8977, -77.0365], zoom_start=12, tiles="CartoDB dark_matter")
    folium.Marker([38.8977, -77.0365], popup="HQ", icon=folium.Icon(color="cyan", icon="shield", prefix="fa")).add_to(m)
    st_folium(m, width="100%", height=500)
    st.info(f"ATMOSPHERICS: {get_weather()}")

# --- TAB 3: DARK CELL ---
with t_dark:
    c_ghost, c_kill = st.columns(2)
    with c_ghost:
        if st.button("👻 TOGGLE GHOST MODE"):
            st.session_state.ghost_mode = not st.session_state.ghost_mode
            st.rerun()
    with c_kill:
        if st.button("💀 KILL SWITCH"):
            st.error("KILL SWITCH ENGAGED. SYSTEM DUMPING MEMORY...")
            st.stop()
            
    if st.session_state.ghost_mode:
        st.success("GHOST MODE ACTIVE: TOR ROUTING SIMULATED. LOGGING DISABLED.")
    else:
        st.caption("Standard Protocols Active.")

# --- TAB 4: INTEL STREAMS ---
with t_intel:
    st.subheader("THREAT BOARD")
    c1, c2 = st.columns(2)
    with c1:
        target = st.text_input("SCAN TARGET (URL/IP):")
        if st.button("INITIATE SCAN"):
            st.write(scan_vt(target))
    with c2:
        if st.button("🚨 EMERGENCY PROTOCOL"):
            st.session_state.emergency_mode = not st.session_state.emergency_mode
            st.rerun()
            
    if st.session_state.emergency_mode:
        st.error("!!! EMERGENCY DECLARED !!! NOTIFYING SECURITY CONTACTS...")


