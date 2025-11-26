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
import pandas as pd

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C.", page_icon="⚛️", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (HIGH CONTRAST JARVIS THEME) ---
st.markdown("""
<style>
    /* Background & Main Text */
    .stApp { background-color: #000000; color: #E0F7FA; font-family: 'Segoe UI', sans-serif; }
    p, li, span { color: #E0F7FA !important; } /* Force readable text */
    
    /* Input Fields */
    .stTextInput input { 
        background-color: #111; 
        color: #00FFFF; 
        border: 1px solid #00FFFF; 
        border-radius: 5px;
    }
    
    /* Buttons */
    .stButton>button { 
        background-color: #0a0a0a; 
        color: #00FFFF; 
        border: 1px solid #00FFFF; 
        border-radius: 0px; 
        font-weight: bold;
        transition: 0.3s; 
    }
    .stButton>button:hover { 
        background-color: #00FFFF; 
        color: #000; 
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.6); 
    }
    
    /* Emergency Button Override */
    .emergency-btn>button { color: #FF0000 !important; border-color: #FF0000 !important; }
    .emergency-btn>button:hover { background-color: #FF0000 !important; color: #000 !important; }
    
    /* All Clear Button Override */
    .clear-btn>button { color: #00FF00 !important; border-color: #00FF00 !important; }
    
    /* Metrics */
    div[data-testid="stMetricValue"] { color: #00FFFF; font-size: 18px; font-weight: 400; text-shadow: 0 0 5px #00FFFF; }
    div[data-testid="stMetricLabel"] { color: #AAAAAA !important; font-size: 12px; font-weight: bold; }
    
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE ---
if "emergency_mode" not in st.session_state: st.session_state["emergency_mode"] = False
if "history" not in st.session_state: st.session_state.history = []
if "key_index" not in st.session_state: st.session_state["key_index"] = 0
if "pending_upgrade" not in st.session_state: st.session_state["pending_upgrade"] = None

# --- SECURITY (RESTORED) ---
def send_alert(message):
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(st.secrets["EMAIL_USER"], st.secrets["EMAIL_PASS"])
            msg = MIMEText(message); msg["Subject"] = "A.R.C. SECURITY"
            msg["From"] = st.secrets["EMAIL_USER"]; msg["To"] = st.secrets["PHONE_GATEWAY"]
            server.sendmail(st.secrets["EMAIL_USER"], st.secrets["PHONE_GATEWAY"], msg.as_string())
        return "SENT"
    except: return "FAIL"

def check_password():
    if "password_correct" not in st.session_state: st.session_state["password_correct"] = False
    
    def password_entered():
        if "password" in st.session_state:
            if st.session_state["password"] == st.secrets["PASSWORD"]:
                st.session_state["password_correct"] = True
            else:
                st.session_state["password_correct"] = False
                try: ip = st.context.headers.get("X-Forwarded-For", "Hidden IP")
                except: ip = "Unknown"
                send_alert(f"⚠️ UNAUTHORIZED ACCESS ATTEMPT. IP: {ip}")
                st.error("ACCESS DENIED. SECURITY TEAM NOTIFIED.")
                
    if not st.session_state["password_correct"]:
        st.markdown("<h1 style='text-align: center; color: #00FFFF;'>A.R.C. LOCK SCREEN</h1>", unsafe_allow_html=True)
        st.text_input("BIOMETRIC PASSCODE:", type="password", on_change=password_entered, key="password")
        return False
    return True

if not check_password(): st.stop()

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
    # Hard-coded stable model
    model = genai.GenerativeModel("models/gemini-2.0-flash-exp")
    
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    
    try:
        db = DatabaseHandler(st.secrets["MONGO_URI"])
        FACTS_CONTEXT = db.get_facts()
    except:
        db = None
        FACTS_CONTEXT = "[Memory Database Offline]"
        
    if "WOLFRAM_ID" in st.secrets: wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"])
except Exception as e: st.error(f"Boot Sequence Failed: {e}"); st.stop()

# --- CORE FUNCTIONS ---
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

def self_upgrade_logic(request):
    try:
        g = Github(st.secrets["GITHUB_TOKEN"])
        repo = g.get_repo(st.secrets["REPO_NAME"])
        contents = repo.get_contents("app.py")
        current_code = contents.decoded_content.decode()
        prompt = f"ACT AS: Architect. TASK: Rewrite 'app.py' to: {request}. RETURN ONLY CODE."
        response = model.generate_content(prompt)
        new_code = response.text.replace("```python", "").replace("```", "").strip()
        repo.update_file(contents.path, f"Auto-Upgrade: {request}", new_code, contents.sha)
        return True
    except: return False

def transcribe_audio(audio_bytes):
    try:
        r = sr.Recognizer()
        with io.BytesIO(audio_bytes) as source:
            with open("temp.wav", "wb") as f: f.write(source.read())
        with sr.AudioFile("temp.wav") as s:
            return r.recognize_google(r.record(s))
    except Exception as e: 
        print(f"Audio Error: {e}")
        return None

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

def create_pdf(history):
    pdf = FPDF(); pdf.add_page(); pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="A.R.C. MISSION REPORT", ln=1, align='C')
    for msg in history:
        role = "ARC" if msg["role"] == "model" else "USER"
        text = str(msg["parts"][0]).encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 10, txt=f"{role}: {text}"); pdf.ln(2)
    return pdf.output(dest='S').encode('latin-1')

# --- INTERFACE START ---
lat, lon = get_user_location()
status_color = "#FF0000" if st.session_state["emergency_mode"] else "#00FFFF"

# HEADER
c1, c2 = st.columns([8, 2])
with c1:
    st.markdown(f"""
    <h1 style="color: {status_color}; margin: 0; padding: 0; font-family: 'Courier New';">A.R.C.</h1>
    <p style="color: {status_color}; font-size: 12px; margin: 0;">AUTONOMOUS RESPONSE COORDINATOR ● ONLINE</p>
    """, unsafe_allow_html=True)
with c2:
    # TOGGLE BUTTON
    if st.session_state["emergency_mode"]:
        st.markdown('<div class="clear-btn">', unsafe_allow_html=True)
        if st.button("🟢 ALL CLEAR", key="clear_btn"): 
            st.session_state["emergency_mode"] = False
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div class="emergency-btn">', unsafe_allow_html=True)
        if st.button("🚨 EMERGENCY", key="em_btn"): 
            st.session_state["emergency_mode"] = True
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

# METRICS
m1, m2, m3, m4 = st.columns(4)
utc = datetime.datetime.now(pytz.utc)
est = utc.astimezone(pytz.timezone('US/Eastern'))
oki = utc.astimezone(pytz.timezone('Japan'))
m1.metric("TIME (EST)", est.strftime("%H:%M"))
m2.metric("TIME (OKI)", oki.strftime("%H:%M"))
m3.metric("LOC", f"{lat:.2f}, {lon:.2f}" if lat else "ACQUIRING")
m4.metric("MEM", "ACTIVE" if db else "OFFLINE")

# SATELLITE MAP
with st.expander("🗺️ SATELLITE UPLINK"):
    if lat and lon:
        st.map(pd.DataFrame({'lat': [lat], 'lon': [lon]}), zoom=12)
    else:
        st.info("Waiting for GPS Lock...")

st.divider()

# ACTION DECK
ac1, ac2, ac3 = st.columns(3)
with ac1: 
    if st.button("🕶️ BLACKOUT"): st.session_state.history = []; st.rerun()
with ac2:
    if st.button("🖨️ PDF REP"):
        if st.session_state.history:
            st.download_button("DOWNLOAD REPORT", create_pdf(st.session_state.history), "rep.pdf", "application/pdf")
with ac3:
    with st.popover("📂 UPLOAD INTEL"):
        uploaded_img = st.file_uploader("Visual Analysis", type=['png', 'jpg', 'jpeg'])

# MAIN CHAT
if not st.session_state.history:
    greeting = "A.R.C. Online. Systems nominal. Directives?" if not st.session_state["emergency_mode"] else "CRISIS MODE ENGAGED. STATE EMERGENCY."
    st.session_state.history = [{"role": "model", "parts": [greeting]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        clean_text = str(msg["parts"][0]).split("[TOOL_")[0]
        st.markdown(clean_text)
        if len(msg["parts"]) > 1: st.image(msg["parts"][1], width=250)

# UPGRADE PROMPT
if st.session_state["pending_upgrade"]:
    with st.chat_message("assistant"):
        st.info(f"✨ **Suggestion:** {st.session_state['pending_upgrade']}")
        if st.button("Authorize"):
            with st.spinner("Coding..."):
                if self_upgrade_logic(st.session_state["pending_upgrade"]):
                    st.session_state["pending_upgrade"] = None
                    st.success("Done. Rebooting..."); time.sleep(2); st.rerun()

# INPUT
c_mic, c_text = st.columns([1, 8])
with c_mic: voice_data = mic_recorder(start_prompt="🎤", stop_prompt="🛑", key="rec")
with c_text: text_input = st.chat_input("Command...")

user_msg = None
if voice_data and voice_data['bytes']:
    with st.spinner("Processing Audio..."):
        user_msg = transcribe_audio(voice_data['bytes'])
        if not user_msg: st.error("Audio unintelligible. Try again.")
if text_input: user_msg = text_input

if user_msg or uploaded_img:
    if user_msg: 
        st.chat_message("user").markdown(user_msg)
        content_payload = [user_msg]
    else:
        content_payload = ["Analyze this image."]
        
    if uploaded_img:
        img = Image.open(uploaded_img)
        st.chat_message("user").image(img, width=200)
        content_payload.append(img)
    
    st.session_state.history.append({"role": "user", "parts": [user_msg if user_msg else "[IMAGE]"]})
    
    # DYNAMIC PERSONA
    if st.session_state["emergency_mode"]:
        sys = f"CRITICAL PROTOCOL. BE CONCISE. IGNORE NICETIES. PRIORITIZE SURVIVAL. MEMORY: {FACTS_CONTEXT}"
    else:
        sys = f"""
        You are A.R.C. (Autonomous Response Coordinator).
        PERSONA: Efficient, loyal, highly intelligent Chief of Staff (Jarvis/Alfred style).
        
        **INTERNAL PROCESSING (THE COUNCIL):**
        Run debate internally with: 1. STRATEGY 2. TECH 3. BIO.
        
        **OUTPUT RULES:**
        - Give the FINAL VERDICT only.
        - Use [TOOL_SEARCH: query] for data.
        - Use [TOOL_ALERT: msg] for danger.
        - Use [TOOL_SUGGEST: idea] to upgrade code.
        
        **MEMORY:** {FACTS_CONTEXT}
        """

    with st.status("Computing...", expanded=False):
        try:
            chat = model.start_chat(history=[])
            response = chat.send_message([sys, f"USER: {user_msg} LOC: {lat},{lon}"] + (content_payload[1:] if len(content_payload)>1 else []))
            text = response.text
            
            if "[TOOL_SEARCH:" in text:
                q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
                data = perform_search(q, lat, lon)
                response = chat.send_message(f"SEARCH RESULTS: {data}. Summarize.")
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
        audio_html = asyncio.run(generate_voice(text, "Jarvis"))
        if audio_html: st.components.v1.html(audio_html, height=0)
