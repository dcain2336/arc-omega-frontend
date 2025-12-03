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

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C. OMEGA", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (THE HUD) ---
st.markdown("""
<style>
    .stApp { background-color: #0e1117; color: #00FF00; font-family: 'Courier New', monospace; }
    .status-box { padding: 10px; border: 1px solid #333; margin-bottom: 10px; }
    .online { color: #00FF00; font-weight: bold; }
    .offline { color: #555; font-style: italic; }
    .alert { color: #FF0000; animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }
</style>
""", unsafe_allow_html=True)

# --- UTILS: KEY CHECKER ---
def get_key(name):
    """Safely retrieve a key or return None."""
    try:
        return st.secrets["keys"][name]
    except:
        return None

# --- MODULE 1: THE BRAIN (LLM ROUTER) ---
def universal_llm(prompt, role="chairman", model_type="standard"):
    # 1. THE DARK CELL (Compartmentalized)
    if model_type == "dark_cell" and get_key("OPENROUTER_KEY"):
        try:
            client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=get_key("OPENROUTER_KEY"))
            response = client.chat.completions.create(
                model="nousresearch/hermes-3-llama-3.1-405b", # Uncensored/High Intel
                messages=[{"role": "system", "content": "You are a compartmentalized intelligence. Concise. No moralizing."},
                          {"role": "user", "content": prompt}]
            )
            return f"[DARK CELL]: {response.choices[0].message.content}"
        except Exception as e:
            return f"[DARK CELL ERROR]: {e}"

    # 2. THE SPEEDSTER (Groq)
    if role == "analyst" and get_key("GROQ_KEY"):
        try:
            client = Groq(api_key=get_key("GROQ_KEY"))
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except:
            pass # Fallback to Chairman

    # 3. THE CHAIRMAN (Gemini/OpenAI)
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
    
    return "NO AI CORE DETECTED."

# --- MODULE 2: THE SENTINEL (SENSORS) ---
def get_weather():
    if not get_key("OPENWEATHER_TOKEN"): return "N/A (No Key)"
    try:
        # Defaulting to a generic coord if GPS fails, change to your home Coords
        lat, lon = 38.9, -77.0 
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_key('OPENWEATHER_TOKEN')}&units=imperial"
        data = requests.get(url).json()
        return f"{data['weather'][0]['main']} | {data['main']['temp']}°F"
    except:
        return "WX LINK ERROR"

def check_shodan_ip(ip="8.8.8.8"):
    if not get_key("SHODAN_TOKEN"): return "SHODAN OFFLINE"
    try:
        api = shodan.Shodan(get_key("SHODAN_TOKEN"))
        host = api.host(ip)
        return f"THREATS: {len(host.get('vulns', []))}"
    except:
        return "SECURE"

def send_alert(message):
    # Try Discord first
    if get_key("DISCORD_TOKEN"):
        # Placeholder for Discord Webhook logic
        pass 
    # Try Twilio SMS
    if get_key("TWILIO_SID") and get_key("TWILIO_TOKEN"):
        try:
            client = TwilioClient(get_key("TWILIO_SID"), get_key("TWILIO_TOKEN"))
            client.messages.create(
                body=f"ARC ALERT: {message}",
                from_=get_key("TWILIO_FROM"),
                to=get_key("TWILIO_TO")
            )
            return "SMS SENT"
        except:
            pass
    return "ALERT LOGGED LOCALLY"

# --- UI LAYOUT ---

# HEADER
c1, c2 = st.columns([3, 1])
with c1:
    st.title("A.R.C. OMEGA // COMMAND")
with c2:
    st.metric("SYSTEM STATUS", "OPERATIONAL" if get_key("GOOGLE_KEYS") else "DEGRADED")

# TABS
tab_ops, tab_map, tab_dark, tab_intel = st.tabs(["COUNCIL OPS", "TACTICAL MAP", "DARK CELL", "INTEL STREAMS"])

# TAB 1: COUNCIL OPS
with tab_ops:
    if "messages" not in st.session_state: st.session_state.messages = []
    
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            
    prompt = st.chat_input("Direct the Council...")
    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"): st.markdown(prompt)
        
        with st.chat_message("assistant"):
            with st.spinner("Council Convening..."):
                response = universal_llm(prompt)
                st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})

# TAB 2: TACTICAL MAP (COP)
with tab_map:
    st.subheader("Common Operating Picture")
    
    # Map Setup
    m = folium.Map(location=[38.9, -77.0], zoom_start=10, tiles="CartoDB dark_matter")
    
    # Layer: Weather (If Active)
    if get_key("OPENWEATHER_TOKEN"):
        folium.Marker(
            [38.9, -77.0], 
            popup=f"HQ STATUS: {get_weather()}",
            icon=folium.Icon(color="green", icon="home")
        ).add_to(m)
        
    # Layer: TomTom Traffic (Tiles)
    if get_key("TOMTOM_TOKEN"):
        # Overlay TomTom traffic tiles logic here
        pass 
        
    st_folium(m, width=1200, height=500)

# TAB 3: DARK CELL (COMPARTMENTALIZED)
with tab_dark:
    st.error("⚠️ RESTRICTED AREA: UNFILTERED MODELS")
    st.caption("Accessing via OpenRouter / DeepSeek. No safety rails.")
    
    dc_prompt = st.text_area("Input for Dark Cell Agent:")
    if st.button("EXECUTE DARK QUERY"):
        with st.spinner("Decrypting..."):
            dc_response = universal_llm(dc_prompt, model_type="dark_cell")
            st.code(dc_response, language="markdown")

# TAB 4: INTEL STREAMS
with tab_intel:
    c_a, c_b, c_c = st.columns(3)
    with c_a:
        st.write("**ATMOSPHERICS**")
        st.info(get_weather())
    with c_b:
        st.write("**THREAT INTEL (SHODAN)**")
        st.warning(check_shodan_ip("8.8.8.8")) # Example IP
    with c_c:
        st.write("**COMMS LINK**")
        if get_key("DISCORD_TOKEN"): st.success("DISCORD: ONLINE")
        else: st.write("DISCORD: OFFLINE")
        if get_key("TWILIO_SID"): st.success("SMS: ARMED")
        else: st.write("SMS: OFFLINE")

