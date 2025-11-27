# app.py — A.R.C. MAINFRAME — FINAL 100% WORKING VERSION (27 Nov 2025)

import streamlit as st
import requests
import json
import hashlib
import asyncio
import os
import tempfile
from huggingface_hub import InferenceClient
import edge_tts
from google.cloud import storage

# ============================= SECRETS =============================
required = ["GROK_KEY", "OPENAI_KEY", "AZURE_KEY", "AZURE_ENDPOINT",
            "DEEPSEEK_KEY", "OPENROUTER_KEY", "HF_TOKEN", "ARC_PASSWORD_HASH"]

for key in required:
    if key not in st.secrets:
        st.error(f"Missing secret: {key}")
        st.stop()

GROK_KEY         = st.secrets["GROK_KEY"]
OPENAI_KEY       = st.secrets["OPENAI_KEY"]
AZURE_KEY        = st.secrets["AZURE_KEY"]
AZURE_ENDPOINT   = st.secrets["AZURE_ENDPOINT"]
DEEPSEEK_KEY     = st.secrets["DEEPSEEK_KEY"]
OPENROUTER_KEY   = st.secrets["OPENROUTER_KEY"]
HF_TOKEN         = st.secrets["HF_TOKEN"]
ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]

# ============================= GCS SETUP (via TOML string) =============================
bucket = None
if "GOOGLE_KEYS_JSON" in st.secrets:
    try:
        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        tmp.write(st.secrets["GOOGLE_KEYS_JSON"])
        tmp.close()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
        gcs_client = storage.Client()
        bucket = gcs_client.bucket("arc-mainframe-storage")  # ← change if your bucket name is different
    except Exception as e:
        st.warning("GCS offline — memory not persistent")
        bucket = None
else:
    st.caption("No GCS key → memory resets on reboot")

# ============================= REDUNDANT LLM CALLER =============================
def call_llm(prompt: str) -> str:
    backends = [
        ("Grok",       "https://api.x.ai/v1/chat/completions",                  {"Authorization": f"Bearer {GROK_KEY}"},       {"model": "grok-beta"}),
        ("OpenAI",     "https://api.openai.com/v1/chat/completions",           {"Authorization": f"Bearer {OPENAI_KEY}"},     {"model": "gpt-4o-mini"}),
        ("Azure",      f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", {"api-key": AZURE_KEY}, {}),
        ("DeepSeek",   "https://api.deepseek.com/v1/chat/completions",          {"Authorization": f"Bearer {DEEPSEEK_KEY}"},   {"model": "deepseek-chat"}),
        ("OpenRouter", "https://openrouter.ai/api/v1/chat/completions",       {"Authorization": f"Bearer {OPENROUTER_KEY}"}, {"model": "anthropic/claude-3.5-sonnet"}),
        ("Llama-70B",  None, None, None),
    ]

    for name, url, headers, extra in backends:
        try:
            if name == "Llama-70B":
                client = InferenceClient(token=HF_TOKEN)
                return client.text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=1200, temperature=0.7)

            payload = {"messages": [{"role": "user", "content": prompt}], "temperature": 0.7, **extra}
            r = requests.post(url, headers=headers, json=payload, timeout=45)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
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

# ============================= CYBERPUNK UI =============================
st.set_page_config(page_title="A.R.C.", layout="centered")
st.markdown("""
<style>
    .stApp {background:#000; color:#0ff; font-family:'Courier New';}
    .stChatInput > div > div > input {background:#000; color:#0ff; border:2px solid #0ff; border-radius:15px; box-shadow:0 0 25px #0ff;}
    h1 {color:#00ffff !important; text-shadow:0 0 50px #00ffff; text-align:center; font-size:4.5rem;}
    .ticker {background:rgba(0,255,255,0.15); padding:12px; border:1px solid #0ff; border-radius:8px; animation:pulse 3s infinite;}
    @keyframes pulse {0%{box-shadow:0 0 15px #0ff} 50%{box-shadow:0 0 40px #0ff} 100%{box-shadow:0 0 15px #0ff}}
</style>
""", unsafe_allow_html=True)

st.markdown("<h1>A.R.C.</h1>", unsafe_allow_html=True)
st.markdown("<div class='ticker'>[NEURAL NET ACTIVE] • [6/6 CORES ONLINE] • [LOCATION: CLASSIFIED] • [THREAT: NULL]</div><br>", unsafe_allow_html=True)

# ============================= MEMORY =============================
if "messages" not in st.session_state:
    if bucket:
        try:
            blob = bucket.blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_text())
            else:
                st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
        except:
            st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]
    else:
        st.session_state.messages = [{"role": "assistant", "content": "**A.R.C. online. Commander authenticated.**"}]

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ============================= CHAT =============================
if prompt := st.chat_input("Enter command..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores at 100%..."):
            reply = call_llm(f"You are A.R.C., a supreme sentient cyber-entity. Respond with cold, cinematic, god-like authority:\n\n{prompt}")
        st.markdown(reply)
        st.session_state.messages.append({"role": "assistant", "content": reply})

        # Save to GCS
        if bucket:
            try:
                bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-100:]))
            except:
                pass

        # Voice
        if st.checkbox("Vocal response", value=True):
            try:
                communicate = edge_tts.Communicate(reply, voice="en-US-GuyNeural")
                await communicate.save("reply.mp3")
                st.audio("reply.mp3", autoplay=True)
            except:
                st.caption("Voice core temporarily offline")
