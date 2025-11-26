# ═══════════════════════════════════════════════════════════════
#                         A.R.C. • MARK VII • FINAL
# ═══════════════════════════════════════════════════════════════

import streamlit as st
from streamlit_mic_recorder import mic_recorder
import speech_recognition as sr
import edge_tts, asyncio, base64, io, datetime, pytz, json, boto3, random
from cryptography.fernet import Fernet
import google.generativeai as genai
import ray
from tavily import TavilyClient

ray.init(ignore_reinit_error=True)

# ────── MULTI-KEY GOOGLE SETUP (cycles automatically) ──────
def get_working_gemini_key():
    keys = st.secrets["GOOGLE_KEYS"]
    random.shuffle(keys)
    for key in keys:
        try:
            genai.configure(api_key=key)
            genai.GenerativeModel("gemini-2.0-flash-exp")  # test call
            return key
        except:
            continue
    raise Exception("All Google keys exhausted")

CURRENT_KEY = get_working_gemini_key()
genai.configure(api_key=CURRENT_KEY)

# ────── ENCRYPTION ──────
cipher = Fernet(st.secrets["ENCRYPTION_KEY"].encode())
def encrypt(d): return cipher.encrypt(json.dumps(d).encode()).decode()
def decrypt(t):
    try: return json.loads(cipher.decrypt(t.encode()).decode())
    except: return {"history":[], "style_docs":[]}
if "memory" not in st.session_state:
    e = st.session_state.get("enc_memory")
    st.session_state.memory = decrypt(e) if e else {"history":[], "style_docs":[]}

# ────── MARK VII REACTOR (exact from your photo) ──────
def reactor(state="normal"):
    colors = {"normal":"#00f0ff","thinking":"#00ff99","debate":"#ff00ff",
              "emergency":"#ff0033","success":"#00ff00","auth":"#ffaa00",
              "ghost":"#4400bb","talking":"#00f0ff"}
    c = colors.get(state, "#00f0ff")
    st.markdown(f"""
    <div style="position:fixed;top:8px;right:8px;width:210px;height:210px;z-index:9999;pointer-events:none">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="94" fill="none" stroke="{c}" stroke-width="11" opacity="0.32"/>
        <g opacity="0.82">
          <circle cx="100" cy="100" r="84" fill="none" stroke="{c}" stroke-width="4.5">
            <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="23s" repeatCount="indefinite"/>
          </circle>
          <circle cx="100" cy="100" r="73" fill="none" stroke="{c}" stroke-width="4.5">
            <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="18s" repeatCount="indefinite"/>
          </circle>
        </g>
        <polygon points="100,36 140,92 60,92" fill="none" stroke="{c}" stroke-width="10"/>
        <circle cx="100" cy="100" r="50" fill="none" stroke="{c}" stroke-width="8"/>
        <circle cx="100" cy="100" r="24" fill="#ffffff" opacity="0.92"/>
        <circle cx="100" cy="100" r="18" fill="{c}" class="core">
          <animate attributeName="r" values="18;21;18" dur="2.1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="100" r="10" fill="#ffffff"/>
      </svg>
    </div>
    <style>
    @keyframes breathe {{0%,100%{{transform:scale(1);filter:brightness(1)}} 50%{{transform:scale(1.13);filter:brightness(2.1)}}}}
    @keyframes panic   {{0%{{transform:scale(1);filter:brightness(3)}} 50%{{transform:scale(1.45);filter:brightness(7)}} 100%{{transform:scale(1)}}}}
    @keyframes talk    {{0%{{filter:brightness(1)}} 50%{{ filter:brightness(4.5)}} 100%{{filter:brightness(1)}}}}
    .core {{animation: breathe 3s infinite}}
    .emergency .core {{animation: panic 0.65s infinite !important}}
    .talking .core   {{animation: talk 0.4s infinite !important}}
    </style>
    """, unsafe_allow_html=True)
    if state == "emergency": st.markdown('<script>document.body.classList.add("emergency")</script>', unsafe_allow_html=True)
    if state == "talking":   st.markdown('<script>document.body.classList.add("talking")</script>', unsafe_allow_html=True)

# ────── VOICE & LISTEN ──────
async def speak(text):
    reactor("talking")
    comm = edge_tts.Communicate(text, "en-US-GuyNeural")
    audio = io.BytesIO()
    async for chunk in comm.stream():
        if chunk["type"] == "audio": audio.write(chunk["data"])
    audio.seek(0)
    st.audio(f"data:audio/wav;base64,{base64.b64encode(audio.read()).decode()}", autoplay=True)

def listen():
    audio = mic_recorder(start_prompt="Hold to speak • Release when done", just_once=False, key="mic")
    if audio:
        try:
            r = sr.Recognizer()
            with sr.AudioFile(io.BytesIO(audio["bytes"])) as src:
                return r.recognize_google(r.record(src))
        except: pass
    return None

# ────── COUNCIL (5 agents) ──────
@ray.remote
def agent(query):
    m = genai.GenerativeModel("gemini-2.0-flash-exp")
    return m.generate_content(f"Respond as ARC — sharp, military, no fluff: {query}").text

async def council(query):
    reactor("thinking")
    agents = ray.get([agent.remote(query) for _ in range(5)])
    final = genai.GenerativeModel("gemini-2.0-flash-exp").generate_content(
        f"Merge into one perfect ARC response:\n" + "\n\n".join(agents)).text
    reactor("success")
    return final

# ────── THREAT BOARD & BACKUP ──────
def threat_board():
    try:
        res = TavilyClient(api_key=st.secrets["TAVILY_KEY"]).search("real-time threats military intelligence", max_results=2)
        st.sidebar.markdown("### Threat Board")
        for r in res["results"]: st.sidebar.info(r["content"][:320])
    except: pass

if st.sidebar.button("Encrypted Backup • Local + AWS"):
    enc = encrypt(st.session_state.memory)
    st.sidebar.download_button("Download Local Backup", enc, "arc_backup.enc")
    try:
        s3 = boto3.client('s3', aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"])
        s3.put_object(Bucket="arc-backup-2025",
                      Key=f"backup-{datetime.datetime.now(pytz.utc).isoformat()}.enc",
                      Body=enc)
        st.sidebar.success("Backed up to AWS")
    except: st.sidebar.error("AWS backup failed")

# ────── MAIN UI ──────
st.set_page_config(page_title="ARC", page_icon="⚛", layout="centered")
st.title("⚛ ARC • Autonomous Response Coordinator")
reactor()
threat_board()

col1, col2 = st.columns(2)
if col1.button("EMERGENCY", type="primary"):
    reactor("emergency")
    asyncio.run(speak("Emergency protocols active. All systems red."))
if col2.button("GHOST MODE"):
    reactor("ghost")
    asyncio.run(speak("Going dark. Session erased."))
    st.session_state.clear()
    st.rerun()

user_input = listen() or st.chat_input("Speak or type to ARC...")
if user_input:
    if "turtle moves at midnight" in user_input.lower():
        reactor("ghost")
        asyncio.run(speak("Duress phrase detected. Wiping everything."))
        st.session_state.clear()
        st.rerun()

    with st.chat_message("user"):
        st.markdown(user_input)

    response = asyncio.run(council(user_input))

    with st.chat_message("assistant"):
        st.markdown(response)
        asyncio.run(speak(response))

    st.session_state.memory["history"].append({"user": user_input, "arc": response})
    st.session_state.enc_memory = encrypt(st.session_state.memory)
