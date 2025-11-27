# app.py — A.R.C. Mainframe — Ultimate Redundancy Edition (Nov 2025)

import streamlit as st
import requests
import json
import hashlib
import asyncio
import os
from huggingface_hub import InferenceClient
import edge_tts
from google.cloud import storage

# ============================= ALL YOUR KEYS (exact names) =============================
GROK_KEY         = st.secrets["GROK_KEY"]
AZURE_KEY        = st.secrets["AZURE_KEY"]
AZURE_ENDPOINT   = st.secrets["AZURE_ENDPOINT"]
DEEPSEEK_KEY     = st.secrets["DEEPSEEK_KEY"]
PERPLEXITY_KEY   = st.secrets["PERPLEXITY_KEY"]
HF_TOKEN         = st.secrets["HF_TOKEN"]
OPENAI_KEY       = st.secrets["OPENAI_KEY"]
OPENROUTER_KEY   = st.secrets["OPENROUTER_KEY"]
# (Tavily, Wolfram, StableHorde, etc. are ready for future tools)

ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]

# GCS — uses your uploaded GOOGLE_KEYS.json
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".streamlit/GOOGLE_KEYS.json"
try:
    gcs = storage.Client()
    bucket = gcs.bucket("arc-mainframe-storage")  # ← change only if your bucket has another name
except:
    bucket = None

# ============================= SMART LLM CALLER WITH FULL FAILOVER =============================
def call_llm(prompt: str) -> str:
    backends = [
        ("Grok",        f"https://api.x.ai/v1/chat/completions", {"Authorization": f"Bearer {GROK_KEY}"}, {"model": "grok-beta"}),
        ("Azure",       f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", {"api-key": AZURE_KEY}, {}),
        ("DeepSeek",    "https://api.deepseek.com/v1/chat/completions", {"Authorization": f"Bearer {DEEPSEEK_KEY}"}, {"model": "deepseek-chat"}),
        ("OpenRouter",  "https://openrouter.ai/api/v1/chat/completions", {"Authorization": f"Bearer {OPENROUTER_KEY}"}, {"model": "anthropic/claude-3.5-sonnet"}),
        ("OpenAI",      "https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {OPENAI_KEY}"}, {"model": "gpt-4o-mini"}),
        ("Llama-70B",   None, None, None),  # special case
    ]

    for name, url, headers, extra in backends:
        try:
            if name == "Llama-70B":
                client = InferenceClient(token=HF_TOKEN)
                return client.text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=600)
            
            payload = {
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                **extra
            }
            r = requests.post(url, headers=headers, json=payload, timeout=20)
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except Exception:
            continue

    return "All LLM backends are temporarily unreachable. Retrying in background…"

# ============================= PASSWORD =============================
if st.session_state.get("auth") != True:
    pwd = st.text_input("Password", type="password")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == ARC_PASSWORD_HASH:
            st.session_state.auth = True
            st.rerun()
        else:
            st.error("Access denied")
            st.stop()
else:
    # ============================= UI =============================
    st.set_page_config(page_title="A.R.C.", layout="centered")
    st.markdown("""
    <style>
        .stApp {background:#0e1117; color:#fff;}
        .stChatInput > div > div > input {background:#111; color:#0ff; border:1px solid #0ff;}
    </style>
    """, unsafe_allow_html=True)

    st.markdown("""
    <div style="text-align:center; padding:2rem 0;">
        <h1 style="color:#00ffff; text-shadow:0 0 30px #00ffff; font-size:3.5rem;">A.R.C. MAINFRAME</h1>
        <p style="color:#00aaff; font-size:1.3rem;">6 AI cores • Infinite redundancy • Self-healing</p>
    </div>
    """, unsafe_allow_html=True)

    # Load memory
    if "messages" not in st.session_state:
        if bucket:
            try:
                st.session_state.messages = json.loads(bucket.blob("memory.json").download_as_text())
            except:
                st.session_state.messages = []
        else:
            st.session_state.messages = []

    # Show history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Input
    if prompt := st.chat_input("Your command, Sir..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Council is deliberating across all cores..."):
                reply = call_llm(f"You are A.R.C., an elite cybernetic intelligence. Respond in sharp, cinematic style:\n\n{prompt}")
            st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})

            # Save memory
            if bucket:
                bucket.blob("memory.json").upload_from_string(json.dumps
