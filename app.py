import streamlit as st
import google.generativeai as genai
from tavily import TavilyClient
import smtplib
from email.mime.text import MIMEText
import datetime
import pytz
import edge_tts
import asyncio
import io
import base64
from streamlit_mic_recorder import mic_recorder
from streamlit_js_eval import get_geolocation
import wolframalpha
from github import Github 
from db_handler import DatabaseHandler
from fpdf import FPDF
from PIL import Image
import speech_recognition as sr
import time

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C.", page_icon="⚛️", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (JARVIS THEME) ---
st.markdown("""
<style>
    /* Deep Space Black Background */
    .stApp { background-color: #000000; color: #E0F7FA; font-family: 'Segoe UI', sans-serif; }
    
    /* Input Fields - Clean & Minimal */
    .stTextInput input { 
        background-color: #111; 
        color: #00FFFF; 
        border: 1px solid #333; 
        border-radius: 10px;
    }
    
    /* Buttons - Subtle Blue Glow */
    .stButton>button { 
        background-color: #0a0a0a; 
        color: #00FFFF; 
        border: 1px solid #00FFFF; 
        border-radius: 5px; 
        transition: 0.3s; 
    }
    .stButton>button:hover { 
        background-color: #00FFFF; 
        color: #000; 
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.4); 
    }
    
    /* Emergency Button */
    .emergency-btn>button { color: #FF4444 !important; border-color: #FF4444 !important; }
    
    /* Metrics */
    div[data-testid="stMetricValue"] { color: #00FFFF; font-size: 16px; font-weight: 300; }
    div[data-testid="stMetricLabel"] { color: #555; font-size: 10px; }
    
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE ---
if "emergency_mode" not in st.session_state: st.session_state["emergency_mode"] = False
if "history" not in st.session_state: st.session_state.history = []
if "key_index" not in st.session_state: st.session_state["key_index"] = 0
if "pending_upgrade" not in st.session_state: st.session_state["pending_upgrade"] = None

# --- KEYRING & CONNECTION ---
def get_active_key():
    keys = st.secrets["GOOGLE_KEYS"]
    return keys[st.session_state["key_index"] % len(keys)]

def rotate_key():
    st.session_state["key_index"] += 1
    new_key = get_active_key()
    genai.configure(api_key=new_key)
    st.toast(f"⚡ Rerouting Neural Pathways... (Node {st.session_state['key_index']+1})")
    return new_key

try:
    genai.configure(api_key=get_active_key())
    # Hard-coded to the model we know works for you
    model = genai.GenerativeModel("models/gemini-2.0-flash-exp")
    
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    
    # Database Connection (Safe Failover)
    try:
        db = DatabaseHandler(st.secrets["MONGO_URI"])
        FACTS_CONTEXT = db.get_facts()
    except:
        db = None
        FACTS_CONTEXT = "[Memory Database Offline]"
        
    if "WOLFRAM_ID" in st.secrets: wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"])
except Exception as e: st.error(f"Boot Sequence Failed: {e}"); st.stop()

# --- CORE FUNCTIONS (MOVED UP TO FIX NAME ERROR) ---

def get_user_location():
    try:
        loc = get_geolocation()
        if loc: return loc['coords']['latitude'], loc['coords']['longitude']
    except: pass
    return None, None

def perform_search(query, lat, lon):
    try:
        if lat and lon: query += f" near {lat}, {lon}"
        response = tavily.search(query=query, max_results=3)
        return "\n".join([f"- {r['title']}: {r['content']}" for r in response.get('results', [])])
    except: return "[Network Uplink Failed]"

def send_alert(message):
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(st.secrets["EMAIL_USER"], st.secrets["EMAIL_PASS"])
            msg = MIMEText(message); msg["Subject"] = "A.R.C. ALERT"
            msg["From"] = st.secrets["EMAIL_USER"]; msg["To"] = st.secrets["PHONE_GATEWAY"]
            server.sendmail(st.secrets["EMAIL_USER"], st.secrets["PHONE_GATEWAY"], msg.as_string())
        return "SENT"
    except: return "FAIL"

def self_upgrade_logic(request):
    """The Autonomous Learning Engine"""
    try:
        g = Github(st.secrets["GITHUB_TOKEN"])
        repo = g.get_repo(st.secrets["REPO_NAME"])
        contents = repo.get_contents("app.py")
        current_code = contents.decoded_content.decode()
        
        prompt = f"""
        SYSTEM: You are the Architect.
        TASK: Rewrite the 'app.py' code to implement this user request: "{request}"
        CONSTRAINT: Return ONLY the full python code. No markdown.
        CURRENT CODE:
        {current_code}
        """
        response = model.generate_content(prompt)
        new_code = response.text.replace("```python", "").replace("```", "").strip()
        
        repo.update_file(contents.path, f"Auto-Upgrade: {request}", new_code, contents.sha)
        return True
    except Exception as e: return False

def transcribe_audio(audio_bytes):
    try:
        r = sr.Recognizer()
        with io.BytesIO(audio_bytes) as source:
            with open("temp.wav", "wb") as f: f.write(source.read())
        with sr.AudioFile("temp.wav") as s:
            return r.recognize_google(r.record(s))
    except: return None

async def generate_voice(text, voice_style):
    try:
        voices = {"Jarvis": "en-US-ChristopherNeural", "Cortana": "en-US-AriaNeural"}
        clean = text.replace("*", "").split("SENTINEL LOG:")[0]
        communicate = edge_tts.Communicate(clean, voices.get(voice_style, "en-US-ChristopherNeural"))
        audio_fp = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio": audio_fp.write(chunk["data"])
        audio_fp.seek(0)
        b64 = base64.b64encode(audio_fp.read()).decode()
        return f'<audio autoplay="true" style="display:none;"><source src="data:audio/mp3;base64,{b64}" type="audio/mp3"></audio>'
    except: return None

# --- INTERFACE START ---
lat, lon = get_user_location()
status_color = "#FF0000" if st.session_state["emergency_mode"] else "#00FFFF"

# HEADER
c1, c2 = st.columns([8, 1])
with c1:
    st.markdown(f"""
    <h1 style="color: {status_color}; margin: 0; padding: 0;">A.R.C.</h1>
    <p style="color: #666; font-size: 12px; margin: 0;">AUTONOMOUS RESPONSE COORDINATOR ● ONLINE</p>
    """, unsafe_allow_html=True)
with c2:
    if st.button("🚨", help="Emergency Protocol"):
        st.session_state["emergency_mode"] = not st.session_state["emergency_mode"]
        st.rerun()

# METRICS BAR
m1, m2, m3, m4 = st.columns(4)
utc = datetime.datetime.now(pytz.utc)
est = utc.astimezone(pytz.timezone('US/Eastern'))
oki = utc.astimezone(pytz.timezone('Japan'))
m1.metric("TIME (EST)", est.strftime("%H:%M"))
m2.metric("TIME (OKI)", oki.strftime("%H:%M"))
m3.metric("LOC", f"{lat:.2f}, {lon:.2f}" if lat else "SEARCHING")
m4.metric("MEM", "ACTIVE" if db else "OFFLINE")

st.divider()

# MAIN DISPLAY
if not st.session_state.history:
    greeting = "A.R.C. Online. Systems nominal. How may I assist you, Sir?" if not st.session_state["emergency_mode"] else "CRISIS MODE ENGAGED. AWAITING DIRECTIVES."
    st.session_state.history = [{"role": "model", "parts": [greeting]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        # Hide the raw tool codes from the user view
        clean_text = msg["parts"][0].split("[TOOL_")[0]
        st.markdown(clean_text)
        if len(msg["parts"]) > 1: st.image(msg["parts"][1], width=250)

# AUTO-LEARNING PROMPT (If ARC suggested an upgrade)
if st.session_state["pending_upgrade"]:
    with st.chat_message("assistant"):
        st.info(f"✨ **Optimization Suggestion:** {st.session_state['pending_upgrade']}")
        if st.button("Authorize Upgrade"):
            with st.spinner("Rewriting Neural Code..."):
                if self_upgrade_logic(st.session_state["pending_upgrade"]):
                    st.session_state["pending_upgrade"] = None
                    st.success("System Upgraded. Rebooting...")
                    time.sleep(2)
                    st.rerun()

# INPUT
c_mic, c_text = st.columns([1, 8])
with c_mic: voice_data = mic_recorder(start_prompt="🎤", stop_prompt="🛑", key="rec")
with c_text: text_input = st.chat_input("Directives...")

user_msg = None
if voice_data and voice_data['bytes']:
    user_msg = transcribe_audio(voice_data['bytes'])
if text_input: user_msg = text_input

if user_msg:
    st.chat_message("user").markdown(user_msg)
    st.session_state.history.append({"role": "user", "parts": [user_msg]})
    
    # DYNAMIC PERSONA
    if st.session_state["emergency_mode"]:
        sys = f"CRITICAL PROTOCOL. BE CONCISE. IGNORE NICETIES. PRIORITIZE SURVIVAL. MEMORY: {FACTS_CONTEXT}"
    else:
        sys = f"""
        You are A.R.C. (Autonomous Response Coordinator).
        PERSONA: Efficient, loyal, highly intelligent Chief of Staff (Jarvis/Alfred style).
        
        **INTERNAL PROCESSING (THE COUNCIL):**
        Do not show the user the debate. Run it internally using these sub-committees:
        1. STRATEGY (Leadership, Planning)
        2. TECH (Engineering, Coding, EOD)
        3. BIO (Medical, Psych, Agrarian)
        
        **OUTPUT RULES:**
        - Give the FINAL VERDICT only.
        - If you need external data, use [TOOL_SEARCH: query].
        - If you see a way to improve this app code, end your reply with: [TOOL_SUGGEST: description of feature].
        - If the user is in danger, use [TOOL_ALERT: msg].
        
        **MEMORY:** {FACTS_CONTEXT}
        """

    with st.status("Processing...", expanded=False):
        try:
            chat = model.start_chat(history=[])
            response = chat.send_message([sys, f"USER: {user_msg} LOC: {lat},{lon}"])
            text = response.text
            
            # TOOL HANDLING
            if "[TOOL_SEARCH:" in text:
                q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
                data = perform_search(q, lat, lon)
                response = chat.send_message(f"SEARCH RESULTS: {data}. Now summarize for the user.")
                text = response.text
            
            if "[TOOL_ALERT:" in text:
                msg = text.split("[TOOL_ALERT:")[1].split("]")[0]
                send_alert(msg)
            
            if "[TOOL_SUGGEST:" in text:
                suggestion = text.split("[TOOL_SUGGEST:")[1].split("]")[0]
                st.session_state["pending_upgrade"] = suggestion
                text = text.replace(f"[TOOL_SUGGEST:{suggestion}]", "")
                
        except Exception as e:
            if "429" in str(e): rotate_key(); st.rerun()
            text = f"Standby. Rerouting... ({e})"

    with st.chat_message("assistant"): st.markdown(text)
    st.session_state.history.append({"role": "model", "parts": [text]})
    
    if not st.session_state["emergency_mode"]:
        # Auto-play audio (hidden player)
        audio_html = asyncio.run(generate_voice(text, "Jarvis"))
        if audio_html: st.components.v1.html(audio_html, height=0)
