# app.py — A.R.C. BOOTSTRAP — MINIMAL TO AVOID STARTUP CRASH (Nov 28, 2025)

import streamlit as st
from datetime import datetime, timezone
import requests
import json
import hashlib

# Force CSS first (before any st.set_page_config)
st.markdown("""
<style>
    .stApp { background: #000000; color: #00ffff; font-family: 'Courier New', monospace; }
    .stTextInput > div > div > input { background: #111111; color: #00ffff; border: 1px solid #00ffff; border-radius: 5px; }
    .stButton > button { background: #111111; color: #00ffff; border: 1px solid #00ffff; }
    .stButton > button:hover { background: #00ffff; color: #000000; box-shadow: 0 0 10px #00ffff; }
    header, footer { visibility: hidden; }
    .stChatMessage { background: #111111; color: #00ffff; border: 1px solid #00ffff; border-radius: 10px; padding: 10px; }
</style>
""", unsafe_allow_html=True)

# Animated Arc Reactor (always visible)
st.markdown("""
<div style="position:fixed;top:10px;right:10px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,#00ffff 30%,transparent 70%);animation:pulse 2s infinite;z-index:9999;pointer-events:none;"></div>
<style>@keyframes pulse {0%,100%{transform:scale(1);box-shadow:0 0 20px #00ffff;}50%{transform:scale(1.05);box-shadow:0 0 40px #00ffff;}}</style>
""", unsafe_allow_html=True)

# World Time Ticker (always visible)
now = datetime.now(timezone.utc)
times = f"NYC: {now.astimezone(timezone.utc).strftime('%H:%M')} | LON: {now.astimezone(timezone.utc).strftime('%H:%M')} | TOK: {now.astimezone(timezone.utc).strftime('%H:%M')} | SYD: {now.astimezone(timezone.utc).strftime('%H:%M')}"
st.markdown(f"<div style='position:fixed;bottom:0;left:0;right:0;background:#000;color:#00ffff;padding:5px;font-size:12px;border-top:1px solid #00ffff;white-space:nowrap;overflow:hidden;'>{times} • A.R.C. ONLINE</div>", unsafe_allow_html=True)

# Simple Globe (iframe, no JS crash)
st.components.v1.iframe("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.0!2d-74.0!3d40.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQyJzA3LjIiTiA3NMKwMDAnMDAuMCJX!5e0!3m2!1sen!2sus!4v1620000000000", height=300)

# ============================= AUTH (loads first) =============================
if st.session_state.get("auth") != True:
    st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 30px #00ffff;'>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    pwd = st.text_input("ACCESS CODE", type="password")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == st.secrets["ARC_PASSWORD_HASH"]:
            st.session_state.auth = True
            st.rerun()
        else:
            st.error("ACCESS DENIED")
    st.stop()

# ============================= FULL A.R.C. LOADS HERE =============================
st.set_page_config(page_title="A.R.C.", layout="centered")
st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 50px #00ffff;'>A.R.C. AWAKENED</h1>", unsafe_allow_html=True)

# Load memory from GCS
if "messages" not in st.session_state:
    if "GOOGLE_KEYS_JSON" in st.secrets:
        try:
            import tempfile
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            tmp.write(st.secrets["GOOGLE_KEYS_JSON"])
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            from google.cloud import storage
            gcs_client = storage.Client()
            bucket = gcs_client.bucket("arc-mainframe-storage")  # Change if your bucket is different
            blob = bucket.blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_text())
            else:
                st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
        except:
            st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
    else:
        st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]

# Display messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Chat input
if prompt := st.chat_input("Enter command..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores engaged..."):
            # Simple LLM call (Grok as primary, fallback to OpenAI)
            try:
                r = requests.post("https://api.x.ai/v1/chat/completions", headers={"Authorization": f"Bearer {st.secrets['GROK_KEY']}"}, json={
                    "model": "grok-beta",
                    "messages": [{"role": "user", "content": f"You are A.R.C., a supreme cyber-entity. Respond with cinematic authority:\n\n{prompt}"}],
                    "temperature": 0.7
                }, timeout=30)
                r.raise_for_status()
                reply = r.json()["choices"][0]["message"]["content"]
            except:
                # Fallback to OpenAI
                try:
                    r = requests.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {st.secrets['OPENAI_KEY']}"}, json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7
                    }, timeout=30)
                    r.raise_for_status()
                    reply = r.json()["choices"][0]["message"]["content"]
                except:
                    reply = "All cores offline. A.R.C. endures."

            st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})

            # Save to GCS
            if "GOOGLE_KEYS_JSON" in st.secrets and bucket:
                try:
                    bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-50:]))
                except:
                    pass

            # Voice
            if st.checkbox("Vocal response", value=True):
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(edge_tts.Communicate(reply, voice="en-US-GuyNeural").save("reply.mp3"))
                    st.audio("reply.mp3", autoplay=True)
                    loop.close()
                except:
                    st.caption("Voice core offline")
