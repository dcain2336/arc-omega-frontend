import streamlit as st
import google.generativeai as genai
from tavily import TavilyClient
import requests
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
import speech_recognition as sr
import pandas as pd

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C. Mainframe", page_icon="⚛️", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (PROJECT ORACLE THEME) ---
st.markdown("""
<style>
    .stApp { background-color: #050505; color: #00FFFF; font-family: 'Courier New', monospace; }
    .stTextInput input { background-color: #111; color: #00FFFF; border: 1px solid #00FFFF; border-radius: 5px; }
    .stButton>button { background-color: #000; color: #00FFFF; border: 2px solid #00FFFF; border-radius: 0px; font-weight: bold; transition: all 0.3s; width: 100%; }
    .stButton>button:hover { background-color: #00FFFF; color: #000; box-shadow: 0 0 15px #00FFFF; }
    .emergency-btn>button { color: #FF0000 !important; border-color: #FF0000 !important; }
    .emergency-btn>button:hover { background-color: #FF0000 !important; color: #000 !important; box-shadow: 0 0 20px #FF0000 !important; }
    div[data-testid="stMetricValue"] { color: #00FFFF; font-size: 24px; text-shadow: 0 0 5px #00FFFF; }
    header {visibility: hidden;}
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { gap: 2px; }
    .stTabs [data-baseweb="tab"] { background-color: #111; color: #00FFFF; border: 1px solid #00FFFF; }
    .stTabs [data-baseweb="tab"][aria-selected="true"] { background-color: #00FFFF; color: #000; }
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE INIT ---
if "emergency_mode" not in st.session_state: st.session_state["emergency_mode"] = False
if "history" not in st.session_state: st.session_state.history = []
if "uploaded_files" not in st.session_state: st.session_state["uploaded_files"] = []

# --- TOOLS ---
def send_alert(message):
    try:
        sender = st.secrets["EMAIL_USER"]
        password = st.secrets["EMAIL_PASS"]
        recipient = st.secrets["PHONE_GATEWAY"]
        msg = MIMEText(message)
        msg["Subject"] = "A.R.C. ALERT"
        msg["From"] = sender
        msg["To"] = recipient
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, recipient, msg.as_string())
        return f"SIGNAL SENT TO {recipient}"
    except Exception as e: return f"COMM FAILURE: {e}"

# --- SECURITY (INTRUDER TRAP) ---
def check_password():
    if "password_correct" not in st.session_state: st.session_state["password_correct"] = False
    
    def password_entered():
        if "password" in st.session_state:
            if st.session_state["password"] == st.secrets["PASSWORD"]:
                st.session_state["password_correct"] = True
            else:
                st.session_state["password_correct"] = False
                # --- INTRUDER LOGIC ---
                try:
                    # Try to grab IP from headers (Works on Streamlit Cloud)
                    ip = st.context.headers.get("X-Forwarded-For", "Unknown IP")
                except: ip = "Hidden IP"
                send_alert(f"⚠️ SECURITY BREACH: Failed Login Attempt from IP: {ip}")
                st.error("ACCESS DENIED. SECURITY TEAM NOTIFIED.")
                
    if not st.session_state["password_correct"]:
        st.text_input("ACCESS CODE:", type="password", on_change=password_entered, key="password")
        return False
    return True

if not check_password(): st.stop()

# --- CONNECT BRAIN ---
try:
    db = DatabaseHandler(st.secrets["MONGO_URI"])
    FACTS_CONTEXT = db.get_facts()
except: 
    db = None
    FACTS_CONTEXT = "[Memory Offline]"

# --- SELF-HEALING SETUP ---
try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
    all_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    def model_priority(name):
        if "1.5-flash" in name and "exp" not in name: return 0
        if "1.5-pro" in name and "exp" not in name: return 1
        if "flash" in name: return 2
        return 3
    all_models.sort(key=model_priority)
    active_model = None
    for m_name in all_models:
        try:
            test_model = genai.GenerativeModel(m_name)
            response = test_model.generate_content("test")
            active_model = test_model
            break
        except: continue
    if not active_model: st.error("CRITICAL FAILURE: No Models."); st.stop()
    model = active_model
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    wf_client = None
    if "WOLFRAM_ID" in st.secrets: wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"])
except Exception as e: st.error(f"Config Error: {e}"); st.stop()

# --- FUNCTIONS ---
def get_user_location():
    loc = get_geolocation()
    if loc: return loc['coords']['latitude'], loc['coords']['longitude']
    return None, None

def transcribe_audio(audio_bytes):
    try:
        r = sr.Recognizer()
        with io.BytesIO(audio_bytes) as source_bytes:
            with open("temp_audio.wav", "wb") as f: f.write(source_bytes.read())
        with sr.AudioFile("temp_audio.wav") as source:
            audio = r.record(source)
            return r.recognize_google(audio)
    except: return None

async def generate_neural_voice(text, voice_style):
    try:
        voices = {"Jarvis": "en-US-ChristopherNeural", "Cortana": "en-US-AriaNeural", "Alfred": "en-GB-RyanNeural"}
        selected_voice = voices.get(voice_style, "en-US-ChristopherNeural")
        clean_text = text.replace("*", "").replace("#", "").split("SENTINEL LOG:")[0]
        communicate = edge_tts.Communicate(clean_text, selected_voice)
        audio_fp = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio": audio_fp.write(chunk["data"])
        audio_fp.seek(0)
        audio_b64 = base64.b64encode(audio_fp.read()).decode()
        return f'<audio autoplay="true" controls><source src="data:audio/mp3;base64,{audio_b64}" type="audio/mp3"></audio>'
    except: return None

def create_pdf(chat_history):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="A.R.C. MISSION REPORT", ln=1, align='C')
    for msg in chat_history:
        role = "ARC" if msg["role"] == "model" else "USER"
        text = msg["parts"][0].encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 10, txt=f"{role}: {text}")
        pdf.ln(2)
    return pdf.output(dest='S').encode('latin-1')

def perform_search(query):
    try:
        response = tavily.search(query=query, max_results=3)
        return "\n".join([f"- {r['title']}: {r['content']}" for r in response.get('results', [])])
    except: return "[Search Failed]"

# --- DASHBOARD HEADER ---
lat, lon = get_user_location()
c1, c2, c3, c4 = st.columns(4)
utc_now = datetime.datetime.now(pytz.utc)
local_now = datetime.datetime.now() 
c1.metric("ZULU (UTC)", utc_now.strftime("%H:%M"))
c2.metric("LOCAL", local_now.strftime("%H:%M"))
if lat and lon:
    c3.metric("LAT", f"{lat:.2f}")
    c4.metric("LON", f"{lon:.2f}")
    with st.expander("🗺️ SATELLITE UPLINK"):
        df = pd.DataFrame({'lat': [lat], 'lon': [lon]})
        st.map(df, zoom=12)
else:
    c3.metric("LAT", "--.--")
    c4.metric("LON", "--.--")

st.divider()

# --- ACTION DECK ---
act1, act2, act3, act4 = st.columns(4)

with act1:
    if st.button("🕶️ BLACKOUT", key="blackout"):
        st.session_state.history = []
        st.rerun()

with act2:
    if st.button("🖨️ PDF REP", key="pdf"):
        if st.session_state.history:
            pdf_bytes = create_pdf(st.session_state.history)
            st.download_button("DOWNLOAD", data=pdf_bytes, file_name="mission_rep.pdf", mime='application/pdf')

with act3:
    # Upload is now inside an expander to keep UI clean
    with st.popover("📂 UPLOAD"):
        uploaded_file = st.file_uploader("Drop Intel", type=['txt', 'pdf', 'png', 'jpg'])
        if uploaded_file:
            # Save to session state so The Vault can see it
            st.session_state["uploaded_files"].append(uploaded_file.name)
            st.toast(f"Intel Received: {uploaded_file.name}")

with act4:
    if st.session_state["emergency_mode"]:
        if st.button("🟢 ALL CLEAR", key="clear"):
            st.session_state["emergency_mode"] = False
            st.rerun()
    else:
        st.markdown('<div class="emergency-btn">', unsafe_allow_html=True)
        if st.button("🚨 EMERGENCY", key="emergency"):
            st.session_state["emergency_mode"] = True
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

# --- THE VAULT (LOGS & DOCS) ---
with st.expander("🗄️ THE VAULT (LOGS & INTEL)"):
    tab_logs, tab_docs = st.tabs(["SENTINEL LOGS", "CLASSIFIED DOCS"])
    with tab_logs:
        st.caption("Recent Alerts from Database:")
        if db:
            # Visualize the last 5 alerts from Mongo
            logs = list(db.alerts.find().sort("date", -1).limit(5))
            for log in logs:
                st.text(f"[{log['date']}] {log['content']}")
        else:
            st.warning("Database Offline.")
            
    with tab_docs:
        st.caption("Session Intel:")
        if st.session_state["uploaded_files"]:
            for f in st.session_state["uploaded_files"]:
                st.code(f"📄 {f}")
        else:
            st.info("No documents intercepted this session.")

# --- SIDEBAR SETTINGS ---
with st.sidebar:
    st.header("SYSTEM SETTINGS")
    voice_choice = st.selectbox("Voice", ["Jarvis", "Cortana", "Alfred"])
    st.caption(f"Brain: {model.model_name}")
    st.caption("A.R.C. Version 19.0 (Sentinel)")

# --- PERSONA LOGIC ---
if st.session_state["emergency_mode"]:
    st.markdown("""<style>.stApp { background-color: #200000; } div[data-testid="stMetricValue"] { color: #FF0000; text-shadow: 0 0 10px #FF0000; }</style>""", unsafe_allow_html=True)
    SYSTEM_PROMPT = f"""
    ### PRIORITY ONE: EMERGENCY MODE ACTIVE
    You are a tactical crisis response AI. 
    **RULES:**
    1. NO GREETINGS. NO FLUFF.
    2. BULLET POINTS ONLY.
    3. PRIORITIZE: Life Safety > Property.
    4. ACT AS: Trauma Surgeon / EOD Lead.
    **MEMORY:** {FACTS_CONTEXT}
    """
    st.error("🚨 EMERGENCY PROTOCOLS ACTIVE. COMMS MINIMIZED. 🚨")
else:
    SYSTEM_PROMPT = f"""
    ### SYSTEM ROLE: A.R.C. (Autonomous Response Coordinator)
    Chief of Staff for Marine EOD Tech, Minister, Coach.
    
    **DIRECTORATE:**
    I. TECH (Engineering, Cyber, Mechanics)
    II. SAFETY (Medical, Legal, Defense)
    III. INTEL (News, Weather, Research)
    IV. HUMAN (Agrarian, Psychology, Cooking)
    
    **RULES:**
    - Consult sub-committees before answering.
    - Maintain professional "Jarvis-like" tone.
    
    **TOOLS:**
    - [TOOL_SEARCH: query] -> Live Info
    - [TOOL_ALERT: msg] -> SMS User
    - [TOOL_IMAGE: prompt] -> Generate Art
    - [TOOL_MATH: eq] -> Wolfram Calc
    
    **MEMORY:** {FACTS_CONTEXT}
    """

# --- CHAT INTERFACE ---
if not st.session_state.history:
    st.session_state.history = [{"role": "model", "parts": ["A.R.C. Online. Awaiting Command." if not st.session_state["emergency_mode"] else "CRISIS MODE. STATE NATURE OF EMERGENCY."]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(msg["parts"][0])
        if "pollinations.ai" in msg["parts"][0]:
            try: st.image(msg["parts"][0].split("(")[1].split(")")[0])
            except: pass

# --- INPUT ---
col_mic, col_text = st.columns([1, 6])
with col_mic: voice_data = mic_recorder(start_prompt="🎤", stop_prompt="🛑", just_once=True, key="recorder")
with col_text: text_input = st.chat_input("Enter Command..." if not st.session_state["emergency_mode"] else "STATE EMERGENCY...")

final_prompt = None
if voice_data and voice_data['bytes']: 
    with st.spinner("Decrypting Audio..."):
        transcribed_text = transcribe_audio(voice_data['bytes'])
        if transcribed_text: final_prompt = transcribed_text

if text_input: final_prompt = text_input

if final_prompt:
    st.chat_message("user").markdown(final_prompt)
    user_context = f"[LOC: {lat},{lon}] " + final_prompt
    st.session_state.history.append({"role": "user", "parts": [user_context]})
    history_formatted = [{"role": "user" if m["role"]=="user" else "model", "parts": m["parts"]} for m in st.session_state.history]
    
    with st.status("Computing...", expanded=False) as status:
        chat = model.start_chat(history=history_formatted[:-1])
        response = chat.send_message([SYSTEM_PROMPT, user_context])
        text = response.text
        
        if not st.session_state["emergency_mode"]:
            if "[TOOL_SEARCH:" in text:
                q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
                data = perform_search(q)
                response = chat.send_message(f"SEARCH DATA: {data}")
                text = response.text
            if "[TOOL_ALERT:" in text:
                msg = text.split("[TOOL_ALERT:")[1].split("]")[0]
                stat = send_alert(msg)
                # Log alert to DB for The Vault
                if db: db.log_alert(msg)
                text += f"\n\n**LOG:** {stat}"
            if "[TOOL_IMAGE:" in text:
                p = text.split("[TOOL_IMAGE:")[1].split("]")[0].replace(" ", "%20")
                text += f"\n\n![Img](https://image.pollinations.ai/prompt/{p}?nologo=true)"
        
        status.update(label="Done", state="complete")

    with st.chat_message("assistant"): st.markdown(text)
    st.session_state.history.append({"role": "model", "parts": [text]})
    if not st.session_state["emergency_mode"]:
        asyncio.run(generate_neural_voice(text, voice_choice))
