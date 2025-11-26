# ═══════════════════════════════════════════════════════════════
#                    A.R.C. • MARK VII • FINAL BLACK EDITION
# ═══════════════════════════════════════════════════════════════

import streamlit as st
from streamlit_mic_recorder import mic_recorder
import speech_recognition as sr
import edge_tts, asyncio, base64, io, datetime, pytz, json, boto3, random, os
from cryptography.fernet import Fernet
import google.generativeai as genai
import ray
from tavily import TavilyClient

# ────── FORCE BLACK THEME & HIDE STREAMLIT CRAP ──────
st.set_page_config(page_title="ARC", page_icon="⚛", layout="centered")
hide_menu = """
<style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .stApp {background: #000000;}
    section[data-testid="stSidebar"] {background: #0a0a0a;}
    .stChatMessage {background: #111111; border-radius: 12px;}
</style>
"""
st.markdown(hide_menu, unsafe_allow_html=True)

ray.init(ignore_reinit_error=True, include_dashboard=False)

# ────── PASSWORD LOGIN ──────
if st.session_state.get("authenticated") != True:
    pwd = st.text_input("Enter ARC Password", type="password", key="pwd")
    if pwd == st.secrets["ARC_PASSWORD"]:
        st.session_state.authenticated = True
        st.rerun()
    elif pwd:
        st.error("Access Denied")
    st.stop()

# ────── MULTI-KEY GEMINI ──────
def get_gemini_key():
    keys = st.secrets["GOOGLE_KEYS"]
    random.shuffle(keys)
    for k in keys:
        try:
            genai.configure(api_key=k)
            genai.GenerativeModel("gemini-1.5-flash").generate_content("test")
            return k
        except: continue
    st.error("All Gemini keys failed")
    st.stop()
get_gemini_key()

# ────── ENCRYPTION ──────
cipher = Fernet(st.secrets["ENCRYPTION_KEY"].encode())
def encrypt(d): return cipher.encrypt(json.dumps(d).encode()).decode()
def decrypt(t):
    try: return json.loads(cipher.decrypt(t.encode()).decode())
    except: return {"history":[]}
if "memory" not in st.session_state:
    e = st.session_state.get("enc_memory")
    st.session_state.memory = decrypt(e) if e else {"history":[]}

# ────── EXACT MARK VII REACTOR FROM YOUR PHOTO ──────
def reactor(state="normal"):
    c = {"normal":"#00eeff","thinking":"#00ffaa","emergency":"#ff0033","talking":"#00eeff"}.get(state,"#00eeff")
    st.markdown(f"""
    <div style="position:fixed;top:20px;right:15px;width:220px;height:220px;z-index:9999;pointer-events:none">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs><radialGradient id="glow"><stop offset="0%" stop-color="{c}"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>
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
          <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="100" r="12" fill="#ffffff"/>
      </svg>
    </div>
    <style>
    @keyframes pulse {{0%,100%{{filter:brightness(1)}} 50%{{filter:brightness(3)}}}}
    .core {{animation: pulse 2s infinite}}
    </style>
    """, unsafe_allow_html=True)
    if state == "talking":
        st.markdown('<audio autoplay><source src="data:audio/wav;base64,..." type="audio/wav"></audio>', unsafe_allow_html=True)

# ────── VOICE (FIXED) ──────
async def speak(text):
    reactor("talking")
    try:
        comm = edge_tts.Communicate(text, "en-US-GuyNeural")
        audio = io.BytesIO()
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
        audio.seek(0)
        b64 = base64.b64encode(audio.read()).decode()
        st.audio(f"data:audio/wav;base64,{b64}", autoplay=True)
    except:
        pass  # silent fail if TTS down

def listen():
    audio = mic_recorder(start_prompt="Hold to speak", just_once=False, key="mic")
    if audio:
        try:
            r = sr.Recognizer()
            with sr.AudioFile(io.BytesIO(audio["bytes"])) as src:
                return r.recognize_google(r.record(src))
        except:
            st.toast("Speech not recognized", icon="Warning")
    return None

# ────── COUNCIL (now safe) ──────
@ray.remote(num_cpus=0.2)
def agent(q):
    try:
        m = genai.GenerativeModel("gemini-1.5-flash")
        return m.generate_content(f"Respond as ARC — short, sharp, military: {q}").text
    except:
        return "Stand by."

async def council(query):
    reactor("thinking")
    try:
        results = ray.get([agent.remote(query) for _ in range(4)], timeout=20)
        merged = genai.GenerativeModel("gemini-1.5-flash").generate_content(
            "Combine into one perfect response:\n" + "\n\n".join(results)).text
    except:
        merged = "ARC online. Awaiting orders."
    reactor("normal")
    return merged

# ────── UI ──────
st.title("⚛ ARC • Mark VII")
st.markdown("<h2 style='text-align:center;color:#00eeff;margin-top:-30px'>Autonomous Response Coordinator</h2>", unsafe_allow_html=True)
reactor()

col1, col2 = st.columns(2)
if col1.button("EMERGENCY", type="primary"): reactor("emergency"); asyncio.run(speak("Emergency mode"))
if col2.button("GHOST MODE"): reactor("normal"); asyncio.run(speak("Session wiped")); st.session_state.clear(); st.rerun()

user = listen() or st.chat_input("Speak or type...", key="input")
if user:
    if "turtle moves at midnight" in user.lower():
        reactor("normal")
        asyncio.run(speak("Duress detected. Erasing."))
        st.session_state.clear()
        st.rerun()

    with st.chat_message("user", avatar="User"):
        st.markdown(user)

    answer = asyncio.run(council(user))

    with st.chat_message("assistant", avatar="⚛"):
        st.markdown(f"<span style='color:#00eeff'>{answer}</span>", unsafe_allow_html=True)
        asyncio.run(speak(answer))

    st.session_state.memory["history"].append({"user":user, "arc":answer})
    st.session_state.enc_memory = encrypt(st.session_state.memory)
