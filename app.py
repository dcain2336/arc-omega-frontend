import streamlit as st
from streamlit_mic_recorder import mic_recorder
import requests, json, hashlib, datetime, asyncio, os
from datetime import timezone
import ray
from google.cloud import storage
from huggingface_hub import InferenceClient
import edge_tts

ray.init(ignore_reinit_error=True)

# ======================= ALL YOUR KEYS (exact names) =======================
GROK_KEY         = st.secrets["GROK_KEY"]
AZURE_KEY        = st.secrets["AZURE_KEY"]
AZURE_ENDPOINT   = st.secrets["AZURE_ENDPOINT"]
DEEPSEEK_KEY     = st.secrets["DEEPSEEK_KEY"]
PERPLEXITY_KEY   = st.secrets["PERPLEXITY_KEY"]
HF_TOKEN         = st.secrets["HF_TOKEN"]
OPENAI_KEY       = st.secrets["OPENAI_KEY"]
OPENROUTER_KEY   = st.secrets["OPENROUTER_KEY"]
TAVILY_KEY       = st.secrets["TAVILY_KEY"]
WOLFRAM_ID       = st.secrets["WOLFRAM_ID"]
STABLEHORDE_KEY  = st.secrets["STABLEHORDE_KEY"]
MONGO_URI        = st.secrets.get("MONGO_URI", None)
TWILIO_SID       = st.secrets.get("TWILIO_SID", None)
GITHUB_TOKEN     = st.secrets["GITHUB_TOKEN"]
REPO_NAME        = st.secrets["REPO_NAME"]
ARC_PASSWORD_HASH = st.secrets["ARC_PASSWORD_HASH"]

# GCS (your uploaded file)
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = ".streamlit/GOOGLE_KEYS.json"
try:
    gcs = storage.Client()
    bucket = gcs.bucket("arc-mainframe-storage")  # change only if different
except:
    bucket = None

# ======================= SMART CALLER WITH FAILOVER =======================
def call_llm(prompt, model_hint=None):
    models = [
        ("grok",        lambda: requests.post("https://api.x.ai/v1/chat/completions", headers={"Authorization": f"Bearer {GROK_KEY}"}, json={"model": "grok-beta", "messages": [{"role":"user","content":prompt}]}).json()),
        ("azure",       lambda: requests.post(f"{AZURE_ENDPOINT}openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview", headers={"api-key": AZURE_KEY}, json={"messages": [{"role":"user","content":prompt}]}).json()),
        ("deepseek",    lambda: requests.post("https://api.deepseek.com/v1/chat/completions", headers={"Authorization": f"Bearer {DEEPSEEK_KEY}"}, json={"model": "deepseek-chat", "messages": [{"role":"user","content":prompt}]}).json()),
        ("openrouter",  lambda: requests.post("https://openrouter.ai/api/v1/chat/completions", headers={"Authorization": f"Bearer {OPENROUTER_KEY}", "HTTP-Referer": "https://arc.st", "X-Title": "A.R.C."}, json={"model": "anthropic/claude-3.5-sonnet", "messages": [{"role":"user","content":prompt}]}).json()),
        ("openai",      lambda: requests.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {OPENAI_KEY}"}, json={"model": "gpt-4o-mini", "messages": [{"role":"user","content":prompt}]}).json()),
        ("llama",       lambda: InferenceClient(token=HF_TOKEN).text_generation(prompt, model="meta-llama/Meta-Llama-3.1-70B-Instruct", max_new_tokens=512)),
    ]
    for name, func in models:
        try:
            resp = func()
            if "choices" in resp:
                return resp["choices"][0]["message"]["content"]
            elif isinstance(resp, str):
                return resp
        except:
            continue
    return "All backends temporarily unreachable."

# ======================= SECURITY =======================
def check_password():
    def entered():
        if hashlib.sha256(st.session_state.pwd.encode()).hexdigest() == ARC_PASSWORD_HASH:
            st.session_state.auth = True
            del st.session_state.pwd
        else:
            st.session_state.auth = False
    if st.session_state.get("auth") != True:
        st.text_input("Password", type="password", key="pwd", on_change=entered)
        return False
    return True

# ======================= UI =======================
st.set_page_config(page_title="A.R.C.", layout="centered")
st.markdown("<style>.stApp{background:#0e1117;color:#fff}</style>", unsafe_allow_html=True)

if check_password():
    st.markdown("""
    <div style="text-align:center">
        <
