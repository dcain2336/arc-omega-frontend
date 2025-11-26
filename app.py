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
import pandas as pd

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C. Mainframe", page_icon="⚛️", layout="wide", initial_sidebar_state="collapsed")

# --- CUSTOM CSS (PROJECT ORACLE) ---
st.markdown("""
<style>
    .stApp { background-color: #050505; color: #00FFFF; font-family: 'Courier New', monospace; }
    .stTextInput input { background-color: #111; color: #00FFFF; border: 1px solid #00FFFF; border-radius: 5px; }
    .stButton>button { background-color: #000; color: #00FFFF; border: 2px solid #00FFFF; border-radius: 0px; font-weight: bold; transition: all 0.3s; width: 100%; }
    .stButton>button:hover { background-color: #00FFFF; color: #000; box-shadow: 0 0 15px #00FFFF; }
    .emergency-btn>button { color: #FF0000 !important; border-color: #FF0000 !important; }
    .emergency-btn>button:hover { background-color: #FF0000 !important; color: #000 !important; box-shadow: 0 0 20px #FF0000 !important; }
    /* Metric Styling */
    div[data-testid="stMetricValue"] { color: #00FFFF; font-size: 18px; text-shadow: 0 0 5px #00FFFF; }
    div[data-testid="stMetricLabel"] { color: #666; font-size: 12px; }
    header {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# --- SESSION STATE INIT ---
if "emergency_mode" not in st.session_state: st.session_state["emergency_mode"] = False
if "history" not in st.session_state: st.session_state.history = []
if "uploaded_files" not in st.session_state: st.session_state["uploaded_files"] = []

# --- CRITICAL TOOLS ---
def send_alert(message):
    try:
        sender = st.secrets["EMAIL_USER"]
        password = st.secrets["EMAIL_PASS"]
        recipient = st.secrets["PHONE_GATEWAY"]
        msg = MIMEText(message)
        msg["Subject"] = "A.R.C. SECURITY"
        msg["From"] = sender
        msg["To"] = recipient
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, recipient, msg.as_string())
        return "SIGNAL SENT"
    except Exception as e: return f"FAIL: {e}"

# --- SECURITY CHECK ---
def check_password():
    if "password_correct" not in st.session_state: st.session_state["password_correct"] = False
    
    def password_entered():
        if "password" in st.session_state:
            if st.session_state["password"] == st.secrets["PASSWORD"]:
                st.session_state["password_correct"] = True
            else:
                st.session_state["password_correct"] = False
                # INTRUDER TRAP LOGIC
                try: ip = st.context.headers.get("X-Forwarded-For", "Hidden IP")
                except: ip = "Unknown"
                send_alert(f"⚠️ UNAUTHORIZED ACCESS ATTEMPT. IP: {ip}")
                
    if not st.session_state["password_correct"]:
        st.text_input("ACCESS CODE:", type="password", on_change=password_entered, key="password")
        return False
    return True

if not check_password(): st.stop()

# --- BRAIN & DATABASE ---
try:
    db = DatabaseHandler(st.secrets["MONGO_URI"])
    FACTS_CONTEXT = db.get_facts()
except: 
    db = None
    FACTS_CONTEXT = "[Memory Offline]"

try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
    # Force the working model based on logs
    model = genai.GenerativeModel("gemini-2.0-flash-exp") 
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    wf_client = None
    if "WOLFRAM_ID" in st.secrets: wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"])
except Exception as e: st.error(f"Config Error: {e}"); st.stop()

# --- HELPER FUNCTIONS ---
def get_user_location():
    loc = get_geolocation()
    if loc: return loc['coords']['latitude'], loc['coords']['longitude']
    return None, None

async def generate_neural_voice(text, voice_style):
    try:
        voices = {"Jarvis": "en-US-ChristopherNeural", "Cortana": "en-US-AriaNeural", "Alfred": "en-GB-RyanNeural"}
        selected = voices.get(voice_style, "en-US-ChristopherNeural")
        clean = text.replace("*", "").replace("#", "").split("SENTINEL LOG:")[0]
        communicate = edge_tts.Communicate(clean, selected)
        audio_fp = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio": audio_fp.write(chunk["data"])
        audio_fp.seek(0)
        b64 = base64.b64encode(audio_fp.read()).decode()
        return f'<audio autoplay="true" controls><source src="data:audio/mp3;base64,{b64}" type="audio/mp3"></audio>'
    except: return None

def create_pdf(chat_history):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="MISSION REPORT", ln=1, align='C')
    for msg in chat_history:
        role = "ARC" if msg["role"] == "model" else "USER"
        text = str(msg["parts"][0]).encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 10, txt=f"{role}: {text}")
        pdf.ln(2)
    return pdf.output(dest='S').encode('latin-1')

def perform_search(query, lat, lon):
    try:
        # FORCE GPS INJECTION
        if lat and lon: query += f" near coordinates {lat}, {lon}"
        response = tavily.search(query=query, max_results=3)
        return "\n".join([f"- {r['title']}: {r['content']}" for r in response.get('results', [])])
    except: return "[Search Failed]"

# --- HUD HEADER (TIME ZONES) ---
lat, lon = get_user_location()
t1, t2, t3, t4, t5 = st.columns(5)

# World Clock
utc = datetime.datetime.now(pytz.utc)
est = utc.astimezone(pytz.timezone('US/Eastern'))
cst = utc.astimezone(pytz.timezone('US/Central'))
mst = utc.astimezone(pytz.timezone('US/Mountain'))
pst = utc.astimezone(pytz.timezone('US/Pacific'))
oki = utc.astimezone(pytz.timezone('Japan'))

t1.metric("ZULU", utc.strftime("%H:%M"))
t2.metric("EST (HOME)", est.strftime("%H:%M"))
t3.metric("CST", cst.strftime("%H:%M"))
t4.metric("PST", pst.strftime("%H:%M"))
t5.metric("OKINAWA", oki.strftime("%H:%M"))

if lat and lon:
    with st.expander(f"📡 SATELLITE LOCK: {lat:.2f}, {lon:.2f}"):
        st.map(pd.DataFrame({'lat': [lat], 'lon': [lon]}), zoom=12)

st.divider()

# --- ACTION DECK ---
act1, act2, act3, act4 = st.columns(4)
with act1:
    if st.button("🕶️ BLACKOUT"):
        st.session_state.history = []
        st.rerun()
with act2:
    if st.button("🖨️ PDF REP"):
        if st.session_state.history:
            pdf_bytes = create_pdf(st.session_state.history)
            st.download_button("DOWNLOAD", data=pdf_bytes, file_name="mission_rep.pdf", mime='application/pdf')
with act3:
    with st.popover("📂 UPLOAD"):
        uploaded_file = st.file_uploader("Drop Intel", type=['txt', 'pdf', 'png', 'jpg'])
        if uploaded_file: st.session_state["uploaded_files"].append(uploaded_file)
with act4:
    if st.session_state["emergency_mode"]:
        if st.button("🟢 ALL CLEAR"):
            st.session_state["emergency_mode"] = False
            st.rerun()
    else:
        st.markdown('<div class="emergency-btn">', unsafe_allow_html=True)
        if st.button("🚨 EMERGENCY"):
            st.session_state["emergency_mode"] = True
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

# --- EOD UTILITY DRAWER ---
with st.expander("💥 E.O.D. BLAST CALCULATOR"):
    ec1, ec2 = st.columns(2)
    weight = ec1.number_input("Explosive Weight (lbs)", min_value=0.0, step=0.1)
    exp_type = ec2.selectbox("Type", ["TNT", "C4", "Semtex", "Black Powder"])
    
    # Simple K-Factor logic (Approximation for quick ref)
    ref_factor = {"TNT": 1.0, "C4": 1.37, "Semtex": 1.35, "Black Powder": 0.55}
    if st.button("CALCULATE NEW & STANDOFF"):
        new_val = weight * ref_factor[exp_type]
        standoff = 328 * (new_val ** (1/3)) # K328 for public safety (rough example)
        st.success(f"N.E.W.: {new_val:.2f} lbs (TNT Eq)")
        st.warning(f"MIN EVAC DISTANCE (Unshielded): {standoff:.0f} ft")

# --- THE VAULT ---
with st.expander("🗄️ THE VAULT (LOGS & INTEL)"):
    tab_logs, tab_docs = st.tabs(["SENTINEL LOGS", "CLASSIFIED DOCS"])
    with tab_logs:
        if db: 
            logs = list(db.alerts.find().sort("date", -1).limit(5))
            for log in logs: st.text(f"[{log['date']}] {log['content']}")
    with tab_docs:
        if st.session_state["uploaded_files"]:
            for f in st.session_state["uploaded_files"]: st.code(f"📄 {f.name}")

# --- SIDEBAR ---
with st.sidebar:
    st.header("SYSTEM SETTINGS")
    voice_choice = st.selectbox("Voice", ["Jarvis", "Cortana", "Alfred"])
    st.caption("A.R.C. Version 20.0")

# --- PERSONA ---
if st.session_state["emergency_mode"]:
    st.markdown("""<style>.stApp { background-color: #200000; }</style>""", unsafe_allow_html=True)
    SYSTEM_PROMPT = f"EMERGENCY MODE. ACT AS CRISIS RESPONDER. PRIORITIZE LIFE SAFETY. MEMORY: {FACTS_CONTEXT}"
    st.error("🚨 CRISIS PROTOCOLS ACTIVE 🚨")
else:
    SYSTEM_PROMPT = f"""
    ### SYSTEM ROLE: A.R.C.
    Chief of Staff for Marine EOD Tech.
    
    **DIRECTORATE:**
    I. TECH | II. SAFETY | III. INTEL | IV. HUMAN | V. AGRARIAN
    
    **TOOLS:**
    - [TOOL_SEARCH: query] (Uses GPS Lat/Lon)
    - [TOOL_ALERT: msg] (SMS User)
    - [TOOL_IMAGE: prompt] (Art)
    
    **MEMORY:** {FACTS_CONTEXT}
    """

# --- CHAT LOGIC ---
if not st.session_state.history:
    st.session_state.history = [{"role": "model", "parts": ["A.R.C. Online. Awaiting Command."]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(msg["parts"][0])
        if "pollinations.ai" in msg["parts"][0]:
            try: st.image(msg["parts"][0].split("(")[1].split(")")[0])
            except: pass

# --- INPUT HANDLING (MULTI-MODAL) ---
c_mic, c_text = st.columns([1, 6])
with c_mic: voice_data = mic_recorder(start_prompt="🎤", stop_prompt="🛑", key="recorder")
with c_text: text_input = st.chat_input("Command...")

user_msg = None
is_voice = False

if voice_data and voice_data['bytes']:
    # DIRECT NEURAL INJECTION (Send Audio Bytes to Gemini)
    user_msg = "Audio Transmission Received."
    is_voice = True
    audio_bytes = voice_data['bytes']
    
if text_input:
    user_msg = text_input

if user_msg:
    st.chat_message("user").markdown(user_msg)
    
    # Prepare Content
    if is_voice:
        # Wrap audio for Gemini
        content = [SYSTEM_PROMPT, f"[SYSTEM: User Location {lat}, {lon}]", 
                   {"mime_type": "audio/wav", "data": audio_bytes}]
    else:
        content = [SYSTEM_PROMPT, f"[SYSTEM: User Location {lat}, {lon}] " + user_msg]

    st.session_state.history.append({"role": "user", "parts": [user_msg]})
    
    with st.status("Computing...", expanded=False) as status:
        chat = model.start_chat(history=[]) # Stateless for tools to work better
        response = chat.send_message(content)
        text = response.text
        
        # TOOL EXECUTION
        if not st.session_state["emergency_mode"]:
            if "[TOOL_SEARCH:" in text:
                q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
                data = perform_search(q, lat, lon) # Pass GPS
                response = chat.send_message(f"SEARCH DATA: {data}")
                text = response.text
            if "[TOOL_ALERT:" in text:
                msg = text.split("[TOOL_ALERT:")[1].split("]")[0]
                stat = send_alert(msg)
                if db: db.log_alert(msg)
                text += f"\n\n**LOG:** {stat}"
            if "[TOOL_IMAGE:" in text:
                p = text.split("[TOOL_IMAGE:")[1].split("]")[0].replace(" ", "%20")
                text += f"\n\n![Img](https://image.pollinations.ai/prompt/{p}?nologo=true)"
        
        status.update(label="Done", state="complete")

    with st.chat_message("assistant"): st.markdown(text)
    st.session_state.history.append({"role": "model", "parts": [text]})
    
    if not st.session_state["emergency_mode"]:
        audio_html = asyncio.run(generate_neural_voice(text, voice_choice))
        if audio_html: st.markdown(audio_html, unsafe_allow_html=True)
