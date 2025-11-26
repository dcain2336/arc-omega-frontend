import streamlit as st
from streamlit_mic_recorder import mic_recorder
import openai
import edge_tts
import asyncio
import os
import requests
from twilio.rest import Client
from dotenv import load_dotenv
import datetime
import hashlib

load_dotenv()

# ========================= CONFIG =========================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM")
TWILIO_TO = os.getenv("TWILIO_TO")
PASSWORD_HASH = os.getenv("ARC_PASSWORD_HASH")  # put hashlib.sha256("yourpassword".encode()).hexdigest() in .env

openai.api_key = OPENAI_API_KEY

# ========================= SECURITY =========================
def check_password():
    def password_entered():
        if hashlib.sha256(st.session_state["password"].encode()).hexdigest() == PASSWORD_HASH:
            st.session_state["authenticated"] = True
            del st.session_state["password"]
        else:
            st.session_state["authenticated"] = False
            ip = requests.get('https://api.ipify.org').text
            loc = requests.get(f'http://ip-api.com/json/{ip}').json()
            city = loc.get("city", "Unknown")
            country = loc.get("country", "Unknown")
            client = Client(TWILIO_SID, TWILIO_TOKEN)
            message = f"ARC ALERT: Failed login attempt\nIP: {ip}\nLocation: {city}, {country}\nTime: {datetime.datetime.utcnow()} UTC"
            client.messages.create(body=message, from_=TWILIO_FROM, to=TWILIO_TO)

    if "authenticated" not in st.session_state:
        st.text_input("Enter Password", type="password", on_change=password_entered, key="password")
        return False
    if not st.session_state["authenticated"]:
        st.error("Wrong password")
        return False
    return True

# ========================= PAGE STYLE =========================
st.set_page_config(page_title="A.R.C.", layout="centered")

st.markdown("""
<style>
    .stApp { background: #0e1117; color: #ffffff; }
    .stChatInput > div > div > input { background-color: #262730 !important; color: #ffffff !important; border: 1px solid #00ffff; }
    section[data-testid="stChatMessage"] { background-color: #1a1c2e !important; border: 1px solid #00ffff33 !important; border-radius: 12px; padding: 12px; }
    div[data-testid="chatMessageUser"] { color: #00ffff !important; }
    div[data-testid="chatMessageAssistant"] { color: #ffffff !important; }
    img { border: 2px solid #00ffff; border-radius: 50%; box-shadow: 0 0 40px #00ffff88; }
</style>
""", unsafe_allow_html=True)

# ========================= HEADER =========================
if check_password():
    st.markdown("""
    <div style="text-align: center; margin: 30px 0;">
        <img src="https://i.imgur.com/
