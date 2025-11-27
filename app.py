# app.py — A.R.C. MAINFRAME — FINAL CLOUD-OPTIMIZED VERSION (Nov 2025)

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

# ============================= SECRETS (all text-based) =============================
required = ["GROK_KEY", "OPENAI_KEY", "AZURE_KEY", "AZURE_ENDPOINT",
            "DEEPSEEK_KEY", "OPENROUTER_KEY", "HF_TOKEN", "ARC_PASSWORD_HASH"]

for key in required:
    if key not in st.secrets:
        st.error(f"Missing secret: {key} — Add it in Settings → Secrets")
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
        bucket = gcs_client.bucket("arc-mainframe-storage")
