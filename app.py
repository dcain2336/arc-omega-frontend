import streamlit as st
import google.generativeai as genai
from tavily import TavilyClient
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import datetime
import edge_tts
import asyncio
import io
import base64
from streamlit_mic_recorder import mic_recorder
from streamlit_js_eval import get_geolocation
import wolframalpha
from github import Github 
from db_handler import DatabaseHandler
from fpdf import FPDF

# --- CONFIGURATION ---
st.set_page_config(page_title="A.R.C. Mainframe", page_icon="🦅", layout="wide")

# --- CONNECT BRAIN ---
try:
    db = DatabaseHandler(st.secrets["MONGO_URI"])
    FACTS_CONTEXT = db.get_facts()
except: 
    db = None
    FACTS_CONTEXT = "[Memory Offline]"

# --- SECURITY ---
def check_password():
    if "password_correct" not in st.session_state: st.session_state["password_correct"] = False
    def password_entered():
        if st.session_state["password"] == st.secrets["PASSWORD"]:
            st.session_state["password_correct"] = True
            del st.session_state["password"]
        else: st.session_state["password_correct"] = False
    if not st.session_state["password_correct"]:
        st.text_input("ACCESS CODE:", type="password", on_change=password_entered, key="password")
        return False
    return True

if not check_password(): st.stop()

# --- SETUP ---
try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
    model = genai.GenerativeModel("gemini-1.5-flash")
    tavily = TavilyClient(api_key=st.secrets["TAVILY_KEY"])
    wf_client = None
    if "WOLFRAM_ID" in st.secrets: wf_client = wolframalpha.Client(st.secrets["WOLFRAM_ID"])
except: st.error("System Config Error."); st.stop()

# --- CORE FUNCTIONS ---
def get_user_location():
    loc = get_geolocation()
    if loc: return f"{loc['coords']['latitude']}, {loc['coords']['longitude']}"
    return "Unknown"

async def generate_neural_voice(text, voice_style):
    try:
        voices = {"Jarvis": "en-US-ChristopherNeural", "Cortana": "en-US-AriaNeural", "Alfred": "en-GB-RyanNeural"}
        selected_voice = voices.get(voice_style, "en-US-ChristopherNeural")
        clean_text = text.replace("*", "").replace("#", "").split("SYSTEM DATA:")[0]
        communicate = edge_tts.Communicate(clean_text, selected_voice)
        audio_fp = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio": audio_fp.write(chunk["data"])
        audio_fp.seek(0)
        audio_b64 = base64.b64encode(audio_fp.read()).decode()
        return f'<audio autoplay="true"><source src="data:audio/mp3;base64,{audio_b64}" type="audio/mp3"></audio>'
    except: return None

def create_pdf(chat_history):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt="A.R.C. MISSION REPORT", ln=1, align='C')
    for msg in chat_history:
        role = "ARC" if msg["role"] == "model" else "USER"
        text = msg["parts"][0].encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 10, txt=f"{role}: {text}")
        pdf.ln(2)
    return pdf.output(dest='S').encode('latin-1')

# --- SELF-IMPROVEMENT ENGINE ---
def propose_upgrade(request):
    try:
        g = Github(st.secrets["GITHUB_TOKEN"])
        repo = g.get_repo(st.secrets["REPO_NAME"])
        contents = repo.get_contents("app.py")
        current_code = contents.decoded_content.decode()
        prompt = f"""
        ACT AS: Lead Software Architect. TASK: Upgrade code based on: "{request}"
        CURRENT CODE: {current_code}
        INSTRUCTIONS:
        1. Write FULL Python code.
        2. AFTER code, write "### EXPLANATION_START ###".
        3. Write bulleted explanation.
        """
        response = model.generate_content(prompt)
        full_text = response.text
        if "### EXPLANATION_START ###" in full_text:
            parts = full_text.split("### EXPLANATION_START ###")
            new_code = parts[0].replace("```python", "").replace("```", "").strip()
            explanation = parts[1].strip()
        else:
            new_code = full_text.replace("```python", "").replace("```", "").strip()
            explanation = "Review code manually."
        return current_code, new_code, explanation
    except Exception as e: return str(e), str(e), "Error."

def execute_upgrade(new_code):
    try:
        g = Github(st.secrets["GITHUB_TOKEN"])
        repo = g.get_repo(st.secrets["REPO_NAME"])
        contents = repo.get_contents("app.py")
        repo.update_file(contents.path, "A.R.C. Self-Upgrade", new_code, contents.sha)
        return True
    except: return False

# --- TOOLS ---
def perform_search(query):
    try:
        response = tavily.search(query=query, max_results=3)
        return "\n".join([f"- {r['title']}: {r['content']}" for r in response.get('results', [])])
    except: return "[Search Failed]"

# --- PERSONA ---
SYSTEM_PROMPT = f"""
### SYSTEM ROLE: A.R.C. (Autonomous Response Coordinator)
You are the Chief of Staff for a Marine EOD Technician, Minister, and Coach.

**LONG-TERM MEMORY:**
{FACTS_CONTEXT}

**CAPABILITIES:**
1. **Search:** `[TOOL_SEARCH: query]`
2. **Alert:** `[TOOL_ALERT: msg]`
3. **Automate:** `[TOOL_ACTION: command]`
4. **Learn:** `[TOOL_LEARN: fact]`
5. **Upgrade:** `[TOOL_UPGRADE: description]`
6. **Visuals:** `[TOOL_IMAGE: description]`
7. **Math:** `[TOOL_MATH: equation]`
"""

# --- UI INTERFACE ---
st.title("🦅 A.R.C. Mainframe")
location_data = get_user_location()

# --- SIDEBAR ---
with st.sidebar:
    st.header("⚙️ Ops")
    if "Unknown" in location_data: st.caption("📡 GPS: SEARCHING...")
    else: st.caption(f"📡 GPS: LOCKED ({location_data})")
    
    voice_choice = st.selectbox("Voice Profile", ["Jarvis", "Cortana", "Alfred"])
    
    # PDF EXPORT (Hard Copy)
    if st.button("🖨️ Generate Hard Copy (PDF)"):
        if "history" in st.session_state:
            pdf_bytes = create_pdf(st.session_state.history)
            st.download_button(label="Download Mission Report", data=pdf_bytes, file_name="mission_report.pdf", mime='application/pdf')

    # OPSEC BLACKOUT
    if st.button("🕶️ BLACKOUT SCREEN"):
        st.session_state.history = [{"role": "user", "parts": [SYSTEM_PROMPT]}, {"role": "model", "parts": ["SECURE MODE ACTIVE. SCREEN CLEARED."]}]
        st.rerun()

    # UPGRADE PANEL
    with st.expander("🛠️ System Modernization"):
        upgrade_req = st.text_input("Proposed Improvement:")
        if st.button("Generate Patch"):
            with st.spinner("Auditing..."):
                old, new, explanation = propose_upgrade(upgrade_req)
                st.session_state["upgrade_old"] = old
                st.session_state["upgrade_new"] = new
                st.session_state["upgrade_explanation"] = explanation
                st.session_state["upgrade_ready"] = True
        if st.session_state.get("upgrade_ready"):
            st.info(f"**BRIEFING:**\n\n{st.session_state['upgrade_explanation']}")
            if st.button("🔴 AUTHORIZE"):
                if execute_upgrade(st.session_state["upgrade_new"]):
                    st.success("Deployed. Rebooting...")
                    st.balloons()

# --- CHAT LOGIC ---
if "history" not in st.session_state:
    st.session_state.history = [{"role": "user", "parts": [SYSTEM_PROMPT]}, {"role": "model", "parts": ["A.R.C. Online."]}]

for msg in st.session_state.history[-4:]:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(msg["parts"][0])
        if "pollinations.ai" in msg["parts"][0]:
            try: st.image(msg["parts"][0].split("(")[1].split(")")[0])
            except: pass

# --- INPUT ---
col1, col2 = st.columns([1, 6])
with col1: voice_input = mic_recorder(start_prompt="● REC", stop_prompt="■ STOP", just_once=True, key="recorder")
with col2: text_input = st.chat_input("Command Line...")

final_prompt = None
if voice_input and voice_input['bytes']: final_prompt = "Voice Signal Received. Respond."
if text_input: final_prompt = text_input

if final_prompt:
    if text_input: st.chat_message("user").markdown(final_prompt)
    else: st.chat_message("user").markdown("*(Voice Signal)*")

    content = [f"[SYSTEM: User Location {location_data}] " + final_prompt]
    st.session_state.history.append({"role": "user", "parts": content})

    with st.status("Processing...", expanded=False) as status:
        chat = model.start_chat(history=st.session_state.history)
        response = chat.send_message(content)
        text = response.text
        
        # Tools
        if "[TOOL_SEARCH:" in text:
            q = text.split("[TOOL_SEARCH:")[1].split("]")[0]
            if "near me" in q: q += f" near {location_data}"
            data = perform_search(q)
            response = chat.send_message(f"SEARCH DATA: {data}")
            text = response.text
        if "[TOOL_UPGRADE:" in text:
            req = text.split("[TOOL_UPGRADE:")[1].split("]")[0]
            text += f"\n\n**SYSTEM:** Upgrade Request '{req}' logged in Sidebar."
        if "[TOOL_LEARN:" in text:
            fact = text.split("[TOOL_LEARN:")[1].split("]")[0]
            if db: res = db.learn_fact(fact); text += f"\n*[{res}]*"
        if "[TOOL_MATH:" in text:
            q = text.split("[TOOL_MATH:")[1].split("]")[0]
            if wf_client: text += f"\n\n**Calc:** {next(wf_client.query(q).results).text}"
        if "[TOOL_IMAGE:" in text:
            prompt = text.split("[TOOL_IMAGE:")[1].split("]")[0].replace(" ", "%20")
            text += f"\n\n![Visual](https://image.pollinations.ai/prompt/{prompt}?width=1024&height=768&nologo=true)"

        status.update(label="Complete", state="complete")

    with st.chat_message("assistant"): st.markdown(text)
    st.session_state.history.append({"role": "model", "parts": [text]})
    audio_html = asyncio.run(generate_neural_voice(text, voice_choice))
    if audio_html: st.markdown(audio_html, unsafe_allow_html=True)
