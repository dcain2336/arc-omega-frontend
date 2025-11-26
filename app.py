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
from db_handler import DatabaseHandler
from fpdf import FPDF
import pandas as pd
import speech_recognition as sr
from PIL import Image
import random

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C. Mainframe", page_icon="⚛️", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (THEMED) ---
st.markdown("""
<style>
    .stApp { background-color: #050505; color: #00FFFF; font-family: 'Courier New', monospace; }
    .stTextInput input { background-color: #111; color: #00FFFF; border: 1px solid #00FFFF; }
    .stButton>button { background-color: #000; color: #00FFFF; border: 2px solid #00FFFF; width: 100%; transition: 0.3s; }
    .stButton>button:hover { background-color: #00FFFF; color: #000; box-shadow: 0 0 15px #00FFFF; }
    .emergency-btn>button { color: #FF0000 !important; border-color: #FF0000 !important; }
    div[data-testid="stMetricValue"] { color: #00FFFF; text-shadow: 0 0 5px #00FFFF; }
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE ---
if "emergency_mode" not in st.session_state: st.session_state["emergency_mode"] = False
if "history" not in st.session_state: st.session_state.history = []
if "key_index" not in st.session_state: st.session_state["key_index"] = 0

# --- KEYRING MANAGER (LOAD BALANCER) ---
def get_active_key():
    keys = st.secrets["GOOGLE_KEYS"]
    return keys[st.session_state["key_index"] % len(keys)]

def rotate_key():
    st.session_state["key_index"] += 1
    new_key = get_active_key()
    genai.configure(api_key=new_key)
    st.toast(f"⚠️ Quota Hit. Switching to Key #{st.session_state['key_index'] + 1}")
    return new_key

# --- CONNECT BRAIN (With Vision) ---
try:
    # Initial Config
    genai.configure(api_key=get_active_key())
    
    # Vision-Capable Model Selection
    targets = ["models/gemini-2.0-flash", "models/gemini-2.0-flash-lite", "models/gemini-flash-latest"]
    active_model = None
    for t in targets:
        try:
            m = genai.GenerativeModel(t)
            m.generate_content("ping")
            active_model = m
            break
        except: continue
    
    model = active_model if active_model else genai.GenerativeModel("models/gemini-2.0-flash-exp")
    
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"]) if "WOLFRAM_ID" in st.secrets else None
    db = DatabaseHandler(st.secrets["MONGO_URI"])
    FACTS_CONTEXT = db.get_facts()
except Exception as e:
    st.error(f"BOOT ERROR: {e}")
    st.stop()

# --- HELPER FUNCTIONS ---
def get_user_location():
    loc = get_geolocation()
    if loc: return loc['coords']['latitude'], loc['coords']['longitude']
    return None, None

def transcribe_audio(audio_bytes):
    try:
        r = sr.Recognizer()
        with io.BytesIO(audio_bytes) as source:
            with open("temp.wav", "wb") as f: f.write(source.read())
        with sr.AudioFile("temp.wav") as s:
            return r.recognize_google(r.record(s))
    except: return None

async def generate_neural_voice(text, voice_style):
    try:
        voices = {"Jarvis": "en-US-ChristopherNeural", "Cortana": "en-US-AriaNeural"}
        clean = text.replace("*", "").replace("#", "").split("SENTINEL LOG:")[0]
        communicate = edge_tts.Communicate(clean, voices.get(voice_style, "en-US-ChristopherNeural"))
        audio_fp = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio": audio_fp.write(chunk["data"])
        audio_fp.seek(0)
        b64 = base64.b64encode(audio_fp.read()).decode()
        return f'<audio autoplay="true" controls><source src="data:audio/mp3;base64,{b64}" type="audio/mp3"></audio>'
    except: return None

def perform_search(query, lat, lon):
    try:
        if lat and lon: query += f" near {lat}, {lon}"
        return "\n".join([f"- {r['title']}: {r['content']}" for r in tavily.search(query=query, max_results=3).get('results', [])])
    except: return "[Search Failed]"

def send_alert(message):
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(st.secrets["EMAIL_USER"], st.secrets["EMAIL_PASS"])
            msg = MIMEText(message); msg["Subject"] = "A.R.C. ALERT"
            msg["From"] = st.secrets["EMAIL_USER"]; msg["To"] = st.secrets["PHONE_GATEWAY"]
            server.sendmail(st.secrets["EMAIL_USER"], st.secrets["PHONE_GATEWAY"], msg.as_string())
        return "SIGNAL SENT"
    except: return "COMM FAIL"

def create_pdf(history):
    pdf = FPDF(); pdf.add_page(); pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="MISSION REPORT", ln=1, align='C')
    for msg in history:
        role = "ARC" if msg["role"] == "model" else "USER"
        text = str(msg["parts"][0]).encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 10, txt=f"{role}: {text}"); pdf.ln(2)
    return pdf.output(dest='S').encode('latin-1')

# --- UI LAYOUT ---
lat, lon = get_user_location()

# DYNAMIC HEADER (THE AVATAR REPLACEMENT)
status_color = "#FF0000" if st.session_state["emergency_mode"] else "#00FFFF"
st.markdown(f"""
<div style="border-bottom: 2px solid {status_color}; padding-bottom: 10px; margin-bottom: 20px;">
    <h1 style="color: {status_color}; text-align: center; font-family: 'Courier New';">
        A.R.C. MAINFRAME <span style="font-size: 15px; animation: blink 2s infinite;">● ONLINE</span>
    </h1>
</div>
""", unsafe_allow_html=True)

# ACTION DECK
c1, c2, c3, c4 = st.columns(4)
with c1: 
    if st.button("🕶️ BLACKOUT"): st.session_state.history = []; st.rerun()
with c2:
    if st.button("🖨️ PDF REP"):
        if st.session_state.history:
            st.download_button("DL", create_pdf(st.session_state.history), "report.pdf", "application/pdf")
with c3:
    with st.popover("📂 UPLOAD INTEL"):
        # This is the Vision Input
        uploaded_img = st.file_uploader("Visual Analysis", type=['png', 'jpg', 'jpeg'])
with c4:
    if st.session_state["emergency_mode"]:
        if st.button("🟢 ALL CLEAR"): st.session_state["emergency_mode"] = False; st.rerun()
    else:
        st.markdown('<div class="emergency-btn">', unsafe_allow_html=True)
        if st.button("🚨 EMERGENCY"): st.session_state["emergency_mode"] = True; st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

# SIDEBAR SETTINGS
with st.sidebar:
    voice_choice = st.selectbox("Voice", ["Jarvis", "Cortana"])
    st.metric("Active Key Node", f"#{st.session_state['key_index'] + 1}")

# CHAT LOGIC
if not st.session_state.history:
    st.session_state.history = [{"role": "model", "parts": ["A.R.C. Online."]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(msg["parts"][0])
        if len(msg["parts"]) > 1 and isinstance(msg["parts"][1], str): # Image path
             st.image(msg["parts"][1], width=200)

# INPUT
c_mic, c_text = st.columns([1, 6])
with c_mic: voice_data = mic_recorder(start_prompt="🎤", stop_prompt="🛑", key="recorder")
with c_text: text_input = st.chat_input("Command...")

user_msg = None
image_part = None

if voice_data and voice_data['bytes']:
    with st.spinner("Decrypting..."):
        user_msg = transcribe_audio(voice_data['bytes'])

if text_input: user_msg = text_input

# PROCESS INPUT
if user_msg or uploaded_img:
    # Display User Message
    if user_msg: st.chat_message("user").markdown(user_msg)
    
    # Handle Image (Computer Vision)
    content_payload = [user_msg if user_msg else "Analyze this image."]
    if uploaded_img:
        img = Image.open(uploaded_img)
        st.chat_message("user").image(img, width=200)
        content_payload.append(img) # Send actual image object to Gemini
        
    # History management
    st.session_state.history.append({"role": "user", "parts": [user_msg if user_msg else "[IMAGE DATA]"]})

    # System Prompt Selection
    sys_prompt = f"""
    ROLE: A.R.C. Chief of Staff.
    MODE: {'EMERGENCY (TRAUMA/TACTICAL)' if st.session_state['emergency_mode'] else 'STANDARD (DIRECTORATE)'}
    LOC: {lat}, {lon}
    MEMORY: {FACTS_CONTEXT}
    """
    
    with st.status("Computing...", expanded=False):
        try:
            # Attempt generation
            chat = model.start_chat(history=[])
            response = chat.send_message([sys_prompt] + content_payload)
            text = response.text
        except Exception as e:
            # KEY ROTATION LOGIC
            if "429" in str(e):
                rotate_key() # Switch keys
                chat = model.start_chat(history=[])
                response = chat.send_message([sys_prompt] + content_payload)
                text = response.text
            else:
                text = f"SYSTEM FAILURE: {e}"

        # Tools Logic (Search/Alert)
        if not st.session_state["emergency_mode"]:
            if "[TOOL_SEARCH:" in text:
                q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
                data = perform_search(q, lat, lon)
                response = chat.send_message(f"SEARCH DATA: {data}")
                text = response.text
            if "[TOOL_ALERT:" in text:
                msg = text.split("[TOOL_ALERT:")[1].split("]")[0]
                send_alert(msg)
                if db: db.log_alert(msg)
                text += f"\n\n**SENTINEL:** Alert Sent."

    with st.chat_message("assistant"): st.markdown(text)
    st.session_state.history.append({"role": "model", "parts": [text]})
    if not st.session_state["emergency_mode"]:
        asyncio.run(generate_neural_voice(text, voice_choice))
