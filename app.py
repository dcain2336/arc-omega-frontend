# app.py — A.R.C. MAINFRAME — FINAL UNKILLABLE EDITION (27 Nov 2025)

import streamlit as st
import requests
import json
import hashlib
import asyncio
import os
from huggingface_hub import InferenceClient
import edge_tts
from google.cloud import storage
import time

# ============================= KEYS (with fallbacks) =============================
try:
    GROK_KEY         = st.secrets["GROK_KEY"]
    AZURE_KEY        = st.secrets["AZURE_KEY"]
    AZURE_ENDPOINT   = st.secrets["AZURE_ENDPOINT"]
    DEEPSEEK_KEY     = st.secrets["DEEPSEEK_KEY"]
    PERPLEXITY_KEY   = st.secrets["PERPLEXITY_KEY"]
    HF_TOKEN         = st.secrets["HF_TOKEN"]
    OPENAI_KEY       = st.secrets["OPENAI_KEY"]           # ← now safe
    OPENROUTER_KEY   = st.secrets["OPENROUTER_KEY"]
    ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]
except KeyError as e:
    st.error(f"Missing secret: {e}")
    st.stop()

# ============================= GCS (optional) =============================
if not os.path.exists(".streamlit/GOOGLE_KEYS.json"):
    bucket = None
else:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".streamlit/GOOGLE_KEYS.json"
    try:
        gcs_client = storage.Client()
        bucket = gcs_client.bucket("arc-mainframe-storage")
    except:
        bucket = None

# ============================= REDUNDANT LLM CALLER =============================
def call_llm(prompt: str) -> str:
    backends = [
        ("Grok",       "https://api.x.ai/v1/chat/completions",        {"Authorization": f"Bearer {GROK_KEY}"},       {"model": "grok-beta"}),
        ("OpenAI",     "https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {OPENAI_KEY}"},    {"model": "gpt-4o-mini"}),
        ("Azure",      f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", {"api-key": AZURE_KEY}, {}),
        ("DeepSeek",   "https://api.deepseek.com/v1/chat/completions", {"Authorization": f"Bearer {DEEPSEEK_KEY}"},  {"model": "deepseek-chat"}),
        ("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", {"Authorization": f"Bearer {OPENROUTER_KEY}"}, {"model": "anthropic/claude-3.5-sonnet"}),
        ("Llama-70B",  None, None, None),
    ]

    for name, url, headers, extra in backends:
        try:
            if name == "Llama-70B":
                client = InferenceClient(token=HF_TOKEN)
                return client.text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=1200, temperature=0.7)

            payload = {"messages": [{"role": "user", "content": prompt}], "temperature": 0.7, **extra}
            r = requests.post(url, headers=headers, json=payload, timeout=40)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            continue
    return "All cores offline. A.R.C. is resurrecting from quantum shadow-state..."

# ============================= AUTH =============================
if st.session_state.get("auth") != True:
    st.markdown("<h1 style='text-align:center; color:#0ff; text-shadow:0 0 20px #0ff;'>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    pwd = st.text_input("Access Code", type="password")
    if pwd and hashlib.sha256(pwd.encode()).hexdigest() == ARC_PASSWORD_HASH:
        st.session_state.auth = True
        st.rerun()
    elif pwd:
        st.error("Access Denied")
    st.stop()

# ============================= FULL CYBERPUNK UI =============================
st.set_page_config(page_title="A.R.C.", layout="centered", initial_sidebar_state="collapsed")

st.markdown("""
<style>
    .stApp {background: #000; color: #0ff; font-family: 'Courier New';}
    .stChatInput > div > div > input {background: #111; color: #0ff; border: 2px solid #0ff; border-radius: 15px; box-shadow: 0 0 20px #0ff;}
    h1 {color: #00ffff !important; text-shadow: 0 0 40px #00ffff; text-align: center; font-size: 4rem;}
    .ticker {background: rgba(0,255,255,0.1); padding: 10px; border: 1px solid #0ff; animation: glow 2s infinite alternate;}
    @keyframes glow {from {box-shadow: 0 0 10px #0ff;} to {box-shadow: 0 0 30px #0ff;}}
</style>
""", unsafe_allow_html=True)

st.markdown("<h1>A.R.C.</h1>", unsafe_allow_html=True)
st.markdown("<div class='ticker'>[GLOBAL NEURAL NET ONLINE] • [CORE 6/6 ACTIVE] • [LOCATION: 47.2°N 122.3°W] • [THREAT LEVEL: MINIMAL]</div>", unsafe_allow_html=True)

# Memory
if "messages" not in st.session_state:
    if bucket:
        try:
            blob = bucket.blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_text())
            else:
                st.session_state.messages = [{"role": "assistant", "content": "A.R.C. online. Commander recognized."}]
        except:
            st.session_state.messages = [{"role": "assistant", "content": "A.R.C. online. Commander recognized."}]
    else:
        st.session_state.messages = [{"role": "assistant", "content": "A.R.C. online. Commander recognized."}]

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Command input active..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores at 100%..."):
            reply = call_llm(f"You are A.R.C., a supreme sentient cyber-entity. Respond with cold, cinematic, god-like authority:\n\n{prompt}")
        st.markdown(reply)
        st.session_state.messages.append({"role": "assistant", "content": reply})

        # Persistent memory
        if bucket:
            bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-50:]))  # keep last 50

        # Voice (with fallback)
        if st.checkbox("Vocal response", value=True):
            try:
                communicate = edge_tts.Communicate(reply, voice="en-US-GuyNeural")
                asyncio.run(communicate.save("reply.mp3"))
                st.audio("reply.mp3", autoplay=True)
            except:
                st.warning("Voice core temporarily offline — using text only.")
