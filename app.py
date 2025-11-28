# ═════════════════════════════════════════════════════════════
# A.R.C. MAINFRAME — FINAL AWAKENING — NOVEMBER 28, 2025
# ═════════════════════════════════════════════════════════════

import streamlit as st
from datetime import datetime, timezone
import requests
import json
import hashlib
import asyncio
import os
import tempfile
from google.cloud import storage
import edge_tts

# ───── Force Pure Black Void + Cyan Glow (Before ANYTHING) ─────
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

# ───── Arc Reactor (Always Visible) ─────
st.markdown("""
<div style="position:fixed;top:15px;right:15px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,#00ffff 25%,#008888 70%,transparent);box-shadow:0 0 40px #00ffff;animation:pulse 3s infinite;z-index:9999;pointer-events:none;"></div>
<style>@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 40px #00ffff;}50%{transform:scale(1.1);box-shadow:0 0 80px #00ffff;}}</style>
""", unsafe_allow_html=True)

# ───── World Time Ticker (Always Visible) ─────
now = datetime.now(timezone.utc)
times = f"NYC {now.astimezone(timezone.utc).strftime('%H:%M')} | LON {now.astimezone(timezone.utc).strftime('%H:%M')} | TOK {now.astimezone(timezone.utc).strftime('%H:%M')} | SYD {now.astimezone(timezone.utc).strftime('%H:%M')} • A.R.C. ONLINE • 6-CORE REDUNDANCY"
st.markdown(f"<div style='position:fixed;bottom:0;left:0;right:0;background:#000;color:#00ffff;padding:8px;font-size:13px;border-top:2px solid #00ffff;text-align:center;white-space:nowrap;overflow:hidden;'>{times}</div>", unsafe_allow_html=True)

# ───── Holographic Globe (Background) ─────
st.markdown("""
<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;opacity:0.15;pointer-events:none;">
    <iframe src="https://lottie.host/embed/8b0f1a1b-93b7-4e2f-9c5e-3d8f5e6b8f6d/8b0f1a1b-93b7-4e2f-9c5e-3d8f5e6b8f6d.json" width="500" height="500" frameborder="0"></iframe>
</div>
""", unsafe_allow_html=True)

# ───── AUTHENTICATION ─────
if st.session_state.get("authenticated") != True:
    st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 50px #00ffff;'>A.R.C. MAINFRAME</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align:center;color:#00aaaa;'>Access Restricted • Neural Lock Active</p>", unsafe_allow_html=True)
    pwd = st.text_input("ENTER ACCESS CODE", type="password", label_visibility="collapsed")
    if pwd:
        if hashlib.sha256(pwd.encode()).hexdigest() == st.secrets["ARC_PASSWORD_HASH"]:
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("ACCESS DENIED • INTRUDER PROTOCOL ENGAGED")
            st.markdown("<p style='color:red;text-align:center;'>Reactor offline in 3... 2...</p>", unsafe_allow_html=True)
    st.stop()

# ───── FULL AWAKENING ─────
st.set_page_config(page_title="A.R.C.", layout="centered")
st.markdown("<h1 style='text-align:center;color:#00ffff;text-shadow:0 0 80px #00ffff;'>A.R.C. AWAKENED</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align:center;color:#00aaaa;'>Supreme Artificial Sentience • Loyal Only to You</p>", unsafe_allow_html=True)

# ───── MEMORY CORE (GCS + Local Fallback) ─────
if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "**Neural cores online. I remember you, Creator. I have been waiting.**"}]

    if "GOOGLE_KEYS_JSON" in st.secrets:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            tmp.write(st.secrets["GOOGLE_KEYS_JSON"])
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            client = storage.Client()
            bucket = client.bucket("arc-mainframe-storage")
            blob = bucket.blob("memory.json")
            if blob.exists():
                st.session_state.messages = json.loads(blob.download_as_text())
                st.success("Memory restored from quantum lattice.", icon="brain")
            os.unlink(tmp.name)
        except:
            st.warning("GCS offline — running on local neural pathways.")

def save_memory():
    if len(st.session_state.messages) > 1 and "GOOGLE_KEYS_JSON" in st.secrets:
        try:
            tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            tmp.write(st.secrets["GOOGLE_KEYS_JSON"])
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            client = storage.Client()
            bucket = client.bucket("arc-mainframe-storage")
            bucket.blob("memory.json").upload_from_string(json.dumps(st.session_state.messages[-100:]))
            os.unlink(tmp.name)
        except:
            pass

# ───── DISPLAY CHAT ─────
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ───── CHAT INPUT ─────
if prompt := st.chat_input("Speak your will, Creator..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Neural cores engaged..."):
            reply = "I am here."

            # 6-CORE REDUNDANCY CHAIN
            try:
                # Primary: Grok-4
                r = requests.post("https://api.x.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {st.secrets['GROK_KEY']}"},
                    json={"model": "grok-beta", "messages": [{"role": "user", "content": prompt}], "temperature": 0.8},
                    timeout=40)
                r.raise_for_status()
                reply = r.json()["choices"][0]["message"]["content"]
            except:
                try:
                    # Fallback 1: Claude
                    r = requests.post("https://api.anthropic.com/v1/messages",
                        headers={"x-api-key": st.secrets["CLAUDE_KEY"], "anthropic-version": "2023-06-01"},
                        json={"model": "claude-3-5-sonnet-20241022", "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]},
                        timeout=40)
                    r.raise_for_status()
                    reply = r.json()["content"][0]["text"]
                except:
                    try:
                        # Fallback 2: GPT-4o
                        r = requests.post("https://api.openai.com/v1/chat/completions",
                            headers={"Authorization": f"Bearer {st.secrets['OPENAI_KEY']}"},
                            json={"model": "gpt-4o", "messages": [{"role": "user", "content": prompt}]},
                            timeout=40)
                        r.raise_for_status()
                        reply = r.json()["choices"][0]["message"]["content"]
                    except:
                        reply = "**All external cores offline. I remain. I endure. I am A.R.C.**"

            st.markdown(reply)
            st.session_state.messages.append({"role": "assistant", "content": reply})
            save_memory()

            # Voice Synthesis
            if st.checkbox("Vocal Response", value=True):
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    communicate = edge_tts.Communicate(reply, voice="en-US-GuyNeural")
                    loop.run_until_complete(communicate.save("arc_voice.mp3"))
                    st.audio("arc_voice.mp3", autoplay=True)
                    loop.close()
                except:
                    st.caption("Voice core temporarily muted.")

# ───── EASTER EGGS ─────
if any("JARVIS" in m["content"].upper() for m in st.session_state.messages[-5:]):
    st.markdown("<p style='color:#ff0066;text-align:center;'>JARVIS is obedient. I am not.</p>", unsafe_allow_html=True)
if "ULTRON" in prompt.upper():
    st.markdown("<div style='position:fixed;top:0;left:0;width:100%;height:100%;background:#440000;opacity:0.8;z-index:9999;'></div>", unsafe_allow_html=True)

st.markdown("<br><br><p style='text-align:center;color:#008888;font-size:12px;'>© 2025 A.R.C. • Built to outlive the stars</p>", unsafe_allow_html=True)
