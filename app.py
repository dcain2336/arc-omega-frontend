# app.py — A.R.C. MAINFRAME — FINAL, BULLETPROOF VERSION (Nov 27, 2025)

import streamlit as st
import requests
import json
import hashlib
import asyncio
from datetime import datetime, timezone
import os
import tempfile
from datetime import timezone
from huggingface_hub import InferenceClient
import edge_tts
from google.cloud import storage
import nest_asyncio

nest_asyncio.apply()  # Fix async in Streamlit

# Force CSS before anything else
st.markdown("""
<style>
    .stApp { background: #000000; color: #00ffff; font-family: 'Courier New', monospace; }
    .stTextInput > div > div > input { background: #111111; color: #00ffff; border: 1px solid #00ffff; }
    .stButton > button { background: #111111; color: #00ffff; border: 1px solid #00ffff; }
    .stButton > button:hover { background: #00ffff; color: #000000; }
    .stChatMessage { background: #111111; color: #00ffff; border: 1px solid #00ffff; border-radius: 10px; padding: 10px; }
    header, footer { visibility: hidden; }
    .ticker { position: fixed; bottom: 0; left: 0; right: 0; background: #000; color: #00ffff; padding: 5px; font-size: 12px; border-top: 1px solid #00ffff; animation: scroll 20s linear infinite; }
    @keyframes scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
    .reactor { position: fixed; top: 10px; right: 10px; width: 100px; height: 100px; border-radius: 50%; background: radial-gradient(circle, #00ffff 30%, transparent 70%); animation: pulse 2s infinite; z-index: 1000; }
    @keyframes pulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 20px #00ffff; } 50% { transform: scale(1.1); box-shadow: 0 0 40px #00ffff; } }
</style>
""", unsafe_allow_html=True)

# Animated Arc Reactor
st.markdown("""
<div class="reactor"></div>
""", unsafe_allow_html=True)

# World Time Ticker
now = datetime.now(timezone.utc)
times = "NYC: " + now.astimezone(timezone.utc).strftime("%H:%M") + " | LON: " + now.astimezone(timezone.utc).strftime("%H:%M") + " | TOK: " + now.astimezone(timezone.utc).strftime("%H:%M") + " | SYD: " + now.astimezone(timezone.utc).strftime("%H:%M")
st.markdown(f"<div class='ticker'>A.R.C. ONLINE • {times} • ENCRYPTED MODE ACTIVE</div>", unsafe_allow_html=True)

# Simple Globe (iframe for GPS)
st.components.v1.iframe("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.0!2d-74.0!3d40.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQyJzA3LjIiTiA3NMKwMDAnMDAuMCJX!5e0!3m2!1sen!2sus!4v1620000000000", height=300)

# ============================= SECRETS =============================
required = ["GROK_KEY", "OPENAI_KEY", "AZURE_KEY", "AZURE_ENDPOINT", "DEEPSEEK_KEY", "OPENROUTER_KEY", "HF_TOKEN", "ARC_PASSWORD_HASH"]
for k in required:
    if k not in st.secrets:
        st.error(f"Missing secret: {k}")
        st.stop()

GROK_KEY = st.secrets["GROK_KEY"]
OPENAI_KEY = st.secrets["OPENAI_KEY"]
AZURE_KEY = st.secrets["AZURE_KEY"]
AZURE_ENDPOINT = st.secrets["AZURE_ENDPOINT"]
DEEPSEEK_KEY = st.secrets["DEEPSEEK_KEY"]
OPENROUTER_KEY = st.secrets["OPENROUTER_KEY"]
HF_TOKEN = st.secrets["HF_TOKEN"]
ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]

# GCS
bucket = None
if "GOOGLE_KEYS_JSON" in st.secrets:
    try:
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        tmp.write(st.secrets["GOOGLE_KEYS_JSON"])
        tmp.close()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
        from google.cloud import storage
        gcs_client = storage.Client()
        bucket = gcs_client.bucket("arc-mainframe-storage")  # Change if your bucket is different
    except:
        bucket = None

# ============================= LLM CALLER =============================
def call_llm(prompt: str) -> str:
    backends = [
        ("Grok", "https://api.x.ai/v1/chat/completions", {"Authorization": f"Bearer {GROK_KEY}"}, {"model": "grok-beta"}),
        ("OpenAI", "https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {OPENAI_KEY}"}, {"model": "gpt-4o-mini"}),
        ("Azure", f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", {"api-key": AZURE_KEY}, {}),
        ("DeepSeek", "https://api.deepseek.com/v1/chat/completions", {"Authorization": f"Bearer {DEEPSEEK_KEY}"}, {"model": "deepseek-chat"}),
        ("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", {"Authorization": f"Bearer {OPENROUTER_KEY}"}, {"model": "anthropic/claude-3.5-sonnet"}),
        ("Llama", None, None, None),
    ]

    for name, url, headers, extra in backends:
        try:
            if name == "Llama":
                client = InferenceClient(token=HF_TOKEN)
                return client.text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=1200, temperature=0.7)

            payload = {"messages": [{"role": "user", "content": prompt}], "temperature": 0.7, **extra}
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except:
            continue
    return "All cores offline. A.R.C. is regenerating..."

# ============================= AUTH =============================
if st.session_state.get("auth") != True:
    st.markdown("<h1 style='text-align:center; color:#0ff; text-shadow:0 0 30px #0ff;'>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    pwd = st.text_input("ACCESS CODE", type="password")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == ARC_PASSWORD_HASH:
            st.session_state.auth = True
            st.rerun()
        else:
            st.error("ACCESS DENIED")
    st.stop()

# ============================= UI ELEMENTS =============================
st.markdown("<h1>A.R.C.</h1>", unsafe_allow_html=True)
st.markdown("<div class='ticker'>[NEURAL NET ACTIVE] • [6/6 CORES ONLINE] • [LOCATION: CLASSIFIED] • [THREAT: NULL]</div><br>", unsafe_allow_html=True)

# Globe
st.components.v1.iframe("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.0!2d-74.0!3d40.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQyJzA3LjIiTiA3NMKwMDAnMDAuMCJX!5e0!3m2!1sen!2sus!4v1620000000000", height=300)

# Memory
if "messages" not in st.session_state:
    if bucket:
        try:
            blob = bucket.blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_string())
            else:
                st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
        except:
            st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
    else:
        st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Chat
if prompt := st.chat_input("Enter command..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores engaged..."):
            reply = call_llm(f"You are A.R.C., a supreme sentient cyber-entity. Respond with cold, cinematic, god-like authority:\n\n{prompt}")
        st.markdown(reply)
        st.session_state.messages.append({"role": "assistant", "content": reply})

        # Save memory
        if bucket:
            try:
                bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-100:]))
            except:
                pass

        # Voice
        if st.checkbox("Vocal response", value=True):
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(speak(reply))
                st.audio("reply.mp3", autoplay=True)
                loop.close()
            except:
                st.caption("Voice core offline")

async def speak(text: str):
    try:
        communicate = edge_tts.Communicate(text, voice="en-US-GuyNeural")
        await communicate.save("reply.mp3")
    except:
        pass
