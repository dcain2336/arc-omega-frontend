# app.py — A.R.C. MAINFRAME — FINAL IMMORTAL VERSION (27 Nov 2025)

import streamlit as st
import requests
import json
import hashlib
import asyncio
import os
from huggingface_hub import InferenceClient
import edge_tts
from google.cloud import storage

# ============================= KEYS =============================
GROK_KEY         = st.secrets["GROK_KEY"]
AZURE_KEY        = st.secrets["AZURE_KEY"]
AZURE_ENDPOINT   = st.secrets["AZURE_ENDPOINT"]
DEEPSEEK_KEY     = st.secrets["DEEPSEEK_KEY"]
PERPLEXITY_KEY   = st.secrets["PERPLEXITY_KEY"]
HF_TOKEN         = st.secrets["HF_TOKEN"]
OPENAI_KEY       = st.secrets["OPENAI_KEY"]
OPENROUTER_KEY   = st.secrets["OPENROUTER_KEY"]
ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]

# ============================= GCS SETUP =============================
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".streamlit/GOOGLE_KEYS.json"
try:
    gcs_client = storage.Client()
    bucket = gcs_client.bucket("arc-mainframe-storage")
except:
    bucket = None

# ============================= REDUNDANT LLM CALLER =============================
def call_llm(prompt: str) -> str:
    backends = [
        ("Grok",       "https://api.x.ai/v1/chat/completions",                  {"Authorization": f"Bearer {GROK_KEY}"},       {"model": "grok-beta"}),
        ("Azure",      f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", {"api-key": AZURE_KEY}, {}),
        ("DeepSeek",   "https://api.deepseek.com/v1/chat/completions",         {"Authorization": f"Bearer {DEEPSEEK_KEY}"},   {"model": "deepseek-chat"}),
        ("OpenRouter", "https://openrouter.ai/api/v1/chat/completions",        {"Authorization": f"Bearer {OPENROUTER_KEY}"}, {"model": "anthropic/claude-3.5-sonnet"}),
        ("OpenAI",     "https://api.openai.com/v1/chat/completions",          {"Authorization": f"Bearer {OPENAI_KEY}"},     {"model": "gpt-4o-mini"}),
        ("Llama-70B",  None, None, None),
    ]

    for name, url, headers, extra in backends:
        try:
            if name == "Llama-70B":
                client = InferenceClient(token=HF_TOKEN)
                return client.text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=1000, temperature=0.7)

            payload = {
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                **extra
            }
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except:
            continue

    return "All cores offline. A.R.C. is rebuilding from shadow-realm backups..."

# ============================= AUTH =============================
if st.session_state.get("authenticated") != True:
    pwd = st.text_input("Enter access code", type="password")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == ARC_PASSWORD_HASH:
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("Access denied.")
            st.stop()
else:
    st.set_page_config(page_title="A.R.C.", layout="centered")

    st.markdown("""
    <style>
        .stApp {background: #0e1117; color: #fff;}
        .stChatInput > div > div > input {background: #111; color: #0ff; border: 1px solid #0ff; border-radius: 12px;}
        h1 {color: #00ffff; text-shadow: 0 0 30px #00ffff; text-align: center;}
    </style>
    """, unsafe_allow_html=True)

    st.markdown("<h1>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center; color:#00aaff;'>6 redundant cores • Persistent memory • Voice capable</p>", unsafe_allow_html=True)

    # Load memory
    if "messages" not in st.session_state:
        if bucket:
            try:
                blob = bucket.blob("memory.json")
                if blob.exists():
                    st.session_state.messages = json.loads(blob.download_as_text())
                else:
                    st.session_state.messages = []
            except:
                st.session_state.messages = []
        else:
            st.session_state.messages = []

    # Display chat
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Input
    if prompt := st.chat_input("Your command, Commander..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("All cores engaged..."):
                reply = call_llm(f"You are A.R.C., a supreme cybernetic intelligence. Respond with cinematic gravitas:\n\n{prompt}")
            st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})

            # Save memory
            if bucket:
                bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages))

            # Voice
            if st.toggle("Speak response", value=True):
                asyncio.run(edge_tts.Communicate(reply, voice="en-US-TonyNeural").save("reply.mp3"))
                st.audio("reply.mp3", autoplay=True)
