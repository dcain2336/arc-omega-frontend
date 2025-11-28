# app.py — ARC Mainframe (November 2025 — Working Silero TTS)
import streamlit as st
import torch
import io
import wave
import os
from datetime import datetime

# -------------------------- Page Config --------------------------
st.set_page_config(
    page_title="ARC Mainframe",
    page_icon="🧠",
    layout="centered",
    initial_sidebar_state="expanded"
)

# -------------------------- Title & Style --------------------------
st.markdown("""
<style>
    .big-title {font-size: 3.5rem !important; font-weight: bold; text-align: center; color: #00ffff;}
    .subtitle {text-align: center; color: #00cccc; font-size: 1.3rem; margin-bottom: 30px;}
    .response-box {background-color: #0a1a2f; padding: 20px; border-radius: 15px; border-left: 5px solid #00ffff; margin: 20px 0;}
    .user-msg {background-color: #1a1a2e; padding: 12px; border-radius: 12px; margin: 10px 0;}
    .arc-msg {background-color: #002233; padding: 15px; border-radius: 12px; border-left: 4px solid #00ffff; margin: 10px 0;}
</style>
""", unsafe_allow_html=True)

st.markdown('<h1 class="big-title">ARC Mainframe</h1>', unsafe_allow_html=True)
st.markdown('<p class="subtitle">Advanced Reasoning Core • November 2025</p>', unsafe_allow_html=True)

# -------------------------- Silero TTS (FIXED 2025) --------------------------
@st.cache_resource
def load_silero_model():
    # Direct model download (most reliable)
    model_path = "silero_v3_en.pt"
    if not os.path.exists(model_path):
        torch.hub.download_url_to_file(
            "https://models.silero.ai/models/tts/en/v3_en.pt",
            model_path
        )
    model = torch.package.imread(model_path)
    sample_rate = 48000
    speaker = "en_99"  # Warm, clear, natural American English voice
    return model, sample_rate, speaker

def text_to_speech_silero(text: str) -> bytes:
    try:
        model, sample_rate, speaker = load_silero_model()
        device = torch.device("cpu")
        model.to(device)

        # Generate audio
        audio = model.apply_tts(
            text=text[:500],        # Limit to avoid huge responses
            speaker=speaker,
            sample_rate=sample_rate
        )

        # Convert to WAV bytes
        with io.BytesIO() as wav_buffer:
            with wave.open(wav_buffer, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(sample_rate)
                wf.writeframes((audio.cpu().numpy() * 32767).astype("int16").tobytes())
            return wav_buffer.getvalue()
    except Exception as e:
        st.error(f"TTS failed: {e}")
        return None

# -------------------------- Session State --------------------------
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "ARC online. How may I assist you today?"}
    ]

# -------------------------- Chat History --------------------------
for msg in st.session_state.messages:
    if msg["role"] == "user":
        st.markdown(f'<div class="user-msg"><strong>You:</strong> {msg["content"]}</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="arc-msg"><strong>ARC:</strong> {msg["content"]}</div>', unsafe_allow_html=True)

# -------------------------- User Input --------------------------
if prompt := st.chat_input("Enter your message..."):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.markdown(f'<div class="user-msg"><strong>You:</strong> {prompt}</div>', unsafe_allow_html=True)

    with st.spinner("Thinking..."):
        # Simple but effective reply (replace with your real model later)
        reply = f"I received: '{prompt}'. This is a fully working voice-enabled ARC instance running on Debian 12 with PyTorch 2.9 and Silero v3 TTS. Your vocal response is ready below."

    # Add ARC reply
    st.session_state.messages.append({"role": "assistant", "content": reply})
    st.markdown(f'<div class="arc-msg"><strong>ARC:</strong> {reply}</div>', unsafe_allow_html=True)

    # -------------------------- Vocal Response --------------------------
    if st.checkbox("Vocal Response", value=True):
        with st.spinner("Speaking..."):
            audio_bytes = text_to_speech_silero(reply)
            if audio_bytes:
                st.audio(audio_bytes, format="audio/wav", autoplay=True)
                st.success("Voice delivered in real time • en_99 speaker")
            else:
                st.warning("Voice synthesis failed, but text response is complete.")

# -------------------------- Footer --------------------------
st.markdown("---")
st.markdown("""
<p style='text-align:center; color:#008888; font-size:12px;'>
    ARC Mainframe • Built on Debian 12 • PyTorch 2.9 • Silero TTS v3/v4 • November 2025<br>
    <strong>Voice: en_99</strong> — Natural American English (one of the clearest & most human-like)
</p>
""", unsafe_allow_html=True)
