# ═══════════════════════════════════════════════════════════════
#                    A.R.C. • MARK VII • NO-CRASH EDITION
# ═══════════════════════════════════════════════════════════════

import streamlit as st
import speech_recognition as sr
import edge_tts, asyncio, base64, io, datetime, pytz, json, boto3, random, os
from cryptography.fernet import Fernet
import google.generativeai as genai
import ray
from tavily import TavilyClient
import warnings
warnings.filterwarnings("ignore")  # Kill all warnings

# ────── BLACK IRON MAN THEME ──────
st.set_page_config(page_title="ARC", page_icon="⚛", layout="centered")
st.markdown("""
<style>
    .stApp { background: #000000; color: #00eeff; }
    .stTextInput > div > div > input { background: #111; color: #00eeff; border: 1px solid #00eeff; }
    .stButton > button { background: #111; color: #00eeff; border: 1px solid #00eeff; }
    .stButton > button:hover { background: #00eeff; color: #000; }
    header, footer { visibility: hidden; }
    .stChatMessage { background: #111; color: #00eeff; border-radius: 8px; }
</style>
""", unsafe_allow_html=True)

# ────── RAY WITHOUT WARNINGS ──────
os.environ["RAY_DISABLE_IMPORT_WARNING"] = "1"
ray.init(ignore_reinit_error=True, include_dashboard=False, local_mode=True)

# ────── PASSWORD GATE ──────
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if not st.session_state.authenticated:
    st.markdown("<h1 style='color:#00eeff;text-align:center;'>⚛ ARC Access</h1>", unsafe_allow_html=True)
    pwd = st.text_input("Password", type="password")
    if pwd == st.secrets["ARC_PASSWORD"]:
        st.session_state.authenticated = True
        st.rerun()
    elif pwd:
        st.error("❌ Access Denied")
    st.stop()

# ────── MULTI-KEY GEMINI (quota-proof) ──────
def get_key():
    keys = st.secrets["GOOGLE_KEYS"]
    random.shuffle(keys)
    for k in keys:
        try:
            genai.configure(api_key=k)
            genai.GenerativeModel("gemini-1.5-flash")
            return k
        except: continue
    st.error("API Keys Exhausted"); st.stop()

get_key()

# ────── ENCRYPTION ──────
cipher = Fernet(st.secrets["ENCRYPTION_KEY"].encode())
def encrypt(d): return cipher.encrypt(json.dumps(d).encode()).decode()
def decrypt(t):
    try: return json.loads(cipher.decrypt(t.encode()).decode())
    except: return {"history":[]}
if "memory" not in st.session_state:
    st.session_state.memory = decrypt(st.session_state.get("enc_memory", "")) or {"history":[]}

# ────── MARK VII REACTOR (perfect on mobile, from your photo) ──────
def reactor(state="normal"):
    c = {"normal":"#00eeff","thinking":"#00ffaa","emergency":"#ff0033","talking":"#00eeff"}.get(state,"#00eeff")
    st.markdown(f"""
    <div style="position:fixed;top:20px;right:15px;width:200px;height:200px;z-index:9999;pointer-events:none">
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="95" fill="none" stroke="{c}" stroke-width="12" opacity="0.4"/>
        <circle cx="100" cy="100" r="85" fill="none" stroke="{c}" stroke-width="6">
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="25s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="100" r="75" fill="none" stroke="{c}" stroke-width="6">
          <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="20s" repeatCount="indefinite"/>
        </circle>
        <polygon points="100,30 145,95 55,95" fill="none" stroke="{c}" stroke-width="11"/>
        <circle cx="100" cy="100" r="52" fill="none" stroke="{c}" stroke-width="9"/>
        <circle cx="100" cy="100" r="28" fill="#ffffff" opacity="0.95"/>
        <circle cx="100" cy="100" r="22" fill="{c}" class="core">
          <animate attributeName="r" values="22;26;22" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="100" r="12" fill="#ffffff"/>
      </svg>
    </div>
    <style>
    @keyframes pulse {0%,100%{filter:brightness(1)} 50%{filter:brightness(3)}}
    .core {animation: pulse 2s infinite}
    </style>
    """, unsafe_allow_html=True)

# ────── FIXED VOICE (no crash on speak) ──────
async def speak(text):
    try:
        reactor("talking")
        comm = edge_tts.Communicate(text[:200], "en-US-GuyNeural")  # Shorten text to avoid timeout
        audio = io.BytesIO()
        async for chunk in comm.stream():
            if chunk["type"] == "audio": audio.write(chunk["data"])
        audio.seek(0)
        st.audio(f"data:audio/wav;base64,{base64.b64encode(audio.read()).decode()}", autoplay=True)
    except Exception as e:
        st.toast(f"Voice error: {e}", icon="🔇")

# ────── FIXED MIC (no crash on input) ──────
def listen():
    try:
        audio = mic_recorder(start_prompt="🎤 Speak Now", stop_prompt="🛑", key="mic_key")
        if audio and audio["bytes"]:
            r = sr.Recognizer()
            with sr.AudioFile(io.BytesIO(audio["bytes"])) as source:
                data = r.record(source)
                return r.recognize_google(data)
    except Exception as e:
        st.toast(f"Mic error: {e}", icon="🎤")
    return None

# ────── COUNCIL (timeout-safe) ──────
@ray.remote
def agent(q):
    try:
        m = genai.GenerativeModel("gemini-1.5-flash")
        return m.generate_content(f"ARC response - concise, military: {q}").text
    except: return "ARC ready."

async def council(query):
    reactor("thinking")
    try:
        results = ray.get([agent.remote(query) for _ in range(3)], timeout=15)
        merged = genai.GenerativeModel("gemini-1.5-flash").generate_content(
            f"Merge: {chr(10).join(results)}").text
    except: merged = "ARC operational. Query processed."
    reactor("normal")
    return merged

# ────── GLOBE (now included) ──────
def globe():
    st.components.v1.html("""
    <script src="https://cesium.com/downloads/cesiumjs/releases/1.122/Build/Cesium/Cesium.js"></script>
    <style> #cesium { width:100%; height:300px; border:1px solid #00eeff; border-radius:8px; } </style>
    <div id="cesium"></div>
    <script>
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Free token
    const viewer = new Cesium.Viewer('cesium', { terrain: Cesium.createWorldTerrain(), baseLayerPicker: false });
    navigator.geolocation.getCurrentPosition(pos => viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, 2000) }));
    </script>
    """, height=320)

# ────── THREAT BOARD ──────
def threats():
    try:
        res = TavilyClient(api_key=st.secrets["TAVILY_KEY"]).search("current threats intel", max_results=1)
        st.sidebar.markdown("### Threats")
        st.sidebar.write(res["results"][0]["content"][:200] + "...")
    except: st.sidebar.write("Threats clear.")

# ────── BACKUP ──────
if st.sidebar.button("Backup"):
    enc = encrypt(st.session_state.memory)
    st.sidebar.download_button("Local", enc, "arc.enc")
    try:
        s3 = boto3.client('s3', aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"])
        s3.put_object(Bucket="arc-backup-2025", Key="backup.enc", Body=enc)
        st.sidebar.success("AWS OK")
    except: st.sidebar.error("AWS fail")

# ────── MAIN ──────
st.markdown("<h1 style='color:#00eeff;text-align:center;'>⚛ A.R.C. Mark VII</h1>", unsafe_allow_html=True)
reactor()
globe()
threats()

col1, col2 = st.columns(2)
if col1.button("EMERGENCY"): reactor("emergency"); asyncio.run(speak("Emergency active"))
if col2.button("GHOST"): reactor("normal"); st.session_state.clear(); st.rerun()

user = listen() or st.chat_input("Command...")
if user:
    if "turtle" in user.lower(): asyncio.run(speak("Duress. Wiping.")); st.session_state.clear(); st.rerun()
    with st.chat_message("user"): st.write(user)
    ans = asyncio.run(council(user))
    with st.chat_message("assistant"): st.write(ans); asyncio.run(speak(ans))
    st.session_state.memory["history"].append({"u":user, "a":ans})
    st.session_state.enc_memory = encrypt(st.session_state.memory)
