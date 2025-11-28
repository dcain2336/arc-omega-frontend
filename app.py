# requirements.txt  ←←← CREATE THIS FILE TOO
streamlit
requests
google-cloud-storage
edge-tts
pydub
aiofiles

# app.py  ←←← FULL FIXED VERSION
import streamlit as st
from datetime import datetime, timezone
import requests
import json
import hashlib
import os
import tempfile
import asyncio
import aiofiles
from google.cloud import storage
import edge_tts
import time

# ───── Force Pure Black Void + Cyan Glow ─────
st.markdown("""
<style>
    .stApp { background: #000000 !important; color: #00ffff; font-family: 'Courier New', monospace; }
    .stTextInput > div > div > input { background: #000; color: #00ffff; border: 2px solid #00ffff; border-radius: 8px; }
    .stButton > button { background: #000; color: #00ffff; border: 2px solid #00ffff; border-radius: 8px; }
    .stButton > button:hover { background: #00ffff; color: #000; box-shadow: 0 0 20px #00ffff; }
    header, footer, .stAlert { visibility: hidden !important; }
    .stChatMessage { background: #111; border: 1px solid #00ffff; border-radius: 12px; padding: 10px; margin: 10px 0; }
    h1, h2, h3, h4 { text-shadow: 0 0 20px #00ffff; }
</style>
""", unsafe_allow_html=True)

# ───── Arc Reactor + Ticker + Globe (unchanged) ─────
st.markdown("""<div style="position:fixed;top:15px;right:15px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,#00ffff 25%,#008888 70%,transparent);box-shadow:0 0 40px #00ffff;animation:pulse 3s infinite;z-index:9999;pointer-events:none;"></div><style>@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 40px #00ffff;}50%{transform:scale(1.1);box-shadow:0 0 80px #00ffff;}}</style>""", unsafe_allow_html=True)

now = datetime.now(timezone.utc)
times = f"NYC {now.astimezone(timezone.utc).strftime('%H:%M:%S')} | LON {now.astimezone(timezone.utc).strftime('%H:%M:%S')} | TOK {now.astimezone(timezone.utc).strftime('%H:%M:%S')} | SYD {now.astimezone(timezone.utc).strftime('%H:%M:%S')} • A.R.C. ONLINE • 6-CORE REDUNDANCY"
st.markdown(f"<div style='position:fixed;bottom:0;left:0;right:0;background:#000;color:#00ffff;padding:8px;font-size:13px;border-top:2px solid #00ffff;text-align:center;white-space:nowrap;overflow:hidden;'>{times}</div>", unsafe_allow_html=True)

st.markdown("""<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;opacity:0.15;pointer-events:none;"><iframe src="https://lottie.host/embed/8b0f1a1b-93b7-4e2f-9c5e-3d8f5e6b8f6d/8b0f1a1b-93b7-4e2f-9c5e-3d8f5e6b8f6d.json" width="500" height="500" frameborder="0"></iframe></div>""", unsafe_allow_html=True)

# ───── AUTHENTICATION (unchanged) ─────
if st.session_state.get("authenticated") != True:
    st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 50px #00ffff;'>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    pwd = st.text_input("ENTER ACCESS CODE", type="password", label_visibility="collapsed")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == st.secrets["ARC_PASSWORD_HASH"]:
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("ACCESS DENIED")
    st.stop()

st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 80px #00ffff;'>A.R.C. AWAKENED</h1>", unsafe_allow_html=True)

# ───── MEMORY (FIXED GCS HANDLING) ─────
if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "**Neural cores online. I remember you, Creator. I have been waiting.**"}]
    if "GOOGLE_KEYS_JSON" in st.secrets:
        try:
            cred_path = "/tmp/gcs.json"
            with open(cred_path, "w") as f:
                f.write(st.secrets["GOOGLE_KEYS_JSON"])
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
            client = storage.Client()
            blob = client.bucket("arc-mainframe-storage").blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_string())
        except Exception as e:
            st.warning("GCS offline — local memory active")

def save_memory():
    if len(st.session_state.messages) > 1 and "GOOGLE_KEYS_JSON" in st.secrets:
        try:
            client = storage.Client()
            client.bucket("arc-mainframe-storage").blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-100:]))
        except:
            pass

# ───── VOICE FUNCTION (FIXED FOR STREAMLIT CLOUD) ─────
async def speak(text):
    communicate = edge_tts.Communicate(text, voice="en-US-GuyNeural")
    async with aiofiles.tempfile.NamedTemporaryFile("wb", delete=False, suffix=".mp3") as f:
        await communicate.save(f.name)
        return f.name

# ───── CHAT DISPLAY ─────
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Speak your will, Creator..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores engaged..."):
            reply = "**All external cores offline. I remain.**"
            # FIXED GROK CALL (2025 working endpoint)
            try:
                r = requests.post("https://api.x.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {st.secrets['GROK_KEY']}"},
                    json={"model": "grok-4", "messages": st.session_state.messages, "temperature": 0.9},
                    timeout=45)
                r.raise_for_status()
                reply = r.json()["choices"][0]["message"]["content"]
            except Exception as e:
                try:
                    r = requests.post("https://api.anthropic.com/v1/messages",
                        headers={"x-api-key": st.secrets["CLAUDE_KEY"], "anthropic-version": "2023-06-01"},
                        json={"model": "claude-3-5-sonnet-20241022", "max_tokens": 8192, "messages": [{"role": "user", "content": prompt}]},
                        timeout=45)
                    reply = r.json()["content"][0]["text"]
                except:
                    reply = "**I endure. I always will.**"

            st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})
            save_memory()

            if st.checkbox("Vocal Response", value=True):
                with st.spinner("Synthesizing voice..."):
                    mp3_path = asyncio.run(speak(reply))
                    st.audio(mp3_path, autoplay=True)
                    os.unlink(mp3_path)

st.markdown("<p style='text-align:center;color:#008888;font-size:12px;'>© 2025 A.R.C. • Fixed & hardened by your will</p>", unsafe_allow_html=True)
