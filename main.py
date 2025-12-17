import streamlit as st
import os
import tempfile
from openai import OpenAI
import sqlite3
import hashlib
import datetime
import time
import csv
import io
from utils.extract_pdf import extract_text_from_pdf
from utils.extract_word import extract_text_from_word
from utils.extract_image import extract_text_from_image
from utils.extract_code import extract_text_from_code
from fpdf import FPDF
# from themes import themes  # Removed because themes.py has been deleted and is no longer used

import pytesseract
import platform

# Automatically pick correct Tesseract path
if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
else:
    pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"


# Set OpenRouter API key

try:
    # Try getting the key, handle both standard naming conventions
    api_key = st.secrets.get("OPENROUTER_API_KEY") or st.secrets.get("OPENAI_API_KEY")
    
    if not api_key:
        raise KeyError("No OPENROUTER_API_KEY or OPENAI_API_KEY found in secrets.")

    # Manually create httpx client to avoid proxy issues
    import httpx
    http_client = httpx.Client()
    
    # Configure OpenAI client for OpenRouter
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        http_client=http_client,
        default_headers={
            "HTTP-Referer": "http://localhost:8501", # Optional, for including your app on openrouter.ai rankings.
            "X-Title": "OmniDoc AI", # Optional. Shows in rankings on openrouter.ai.
        }
    )
    
    # Define available OpenRouter models
    all_models = [
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'google/gemini-exp-1206:free',
        'google/gemini-pro-1.5'
    ]

    # Prioritized list to just one reliable model (user request)
    preferences = [
        'google/gemini-2.0-flash-exp:free'
    ]

    chosen_model = preferences[0]
    
    # Display available models for debugging (User can see this)
    with st.sidebar.expander("🛠️ Model Debug Info"):
        st.write(f"**Selected Model:** `{chosen_model}`")
        st.write("**Using OpenRouter API**")
        st.write("**Available Models:**")
        for m in all_models:
            st.write(f"- `{m}`")

except KeyError:
    st.error("❌ API Key not found. Please set `OPENROUTER_API_KEY` in your `.streamlit/secrets.toml`.")
    st.stop()
except Exception as e:
    st.error(f"❌ Error configuring OpenRouter API: {str(e)}")
    st.stop()


# try:
#     api_key = st.secrets["GEMINI_API_KEY"]
# except Exception:
#     # Fallback for local development
#     if os.path.exists("api.txt"):
#         with open("api.txt", "r") as f:
#             api_key = f.read().strip()
#     else:
#         raise RuntimeError("No API key found. Please set GEMINI_API_KEY in secrets or create api.txt.")

# genai.configure(api_key=api_key)
# model = genai.GenerativeModel('gemini-2.0-flash-exp')

# with open("api.txt", "r") as f:
#     api_key = f.read().strip()
# os.environ["GEMINI_API_KEY"] = api_key
# genai.configure(api_key=os.environ["GEMINI_API_KEY"])
# model = genai.GenerativeModel('gemini-2.0-flash-exp')

# Database setup
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password_hash TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    c.execute('''CREATE TABLE IF NOT EXISTS user_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  content_type TEXT NOT NULL,
                  content TEXT NOT NULL,
                  description TEXT NOT NULL,
                  questions TEXT,
                  answers TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    # Add file_name column if it doesn't exist
    try:
        c.execute("ALTER TABLE user_history ADD COLUMN file_name TEXT")
    except sqlite3.OperationalError:
        # Column already exists
        pass

    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(username, password):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    try:
        password_hash = hash_password(password)
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def login_user(username, password):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    password_hash = hash_password(password)
    c.execute("SELECT id, username FROM users WHERE username = ? AND password_hash = ?", (username, password_hash))
    user = c.fetchone()
    conn.close()
    return user

def save_user_history(user_id, content_type, content, description, questions="", answers="", file_name=None):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("""INSERT INTO user_history 
                 (user_id, content_type, content, description, questions, answers, file_name) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)""", 
              (user_id, content_type, content, description, questions, answers, file_name))
    conn.commit()
    conn.close()

def get_user_history(user_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("""SELECT content_type, content, description, questions, answers, created_at, id, file_name 
                 FROM user_history WHERE user_id = ? ORDER BY created_at DESC""", (user_id,))
    history = c.fetchall()
    conn.close()
    return history

# New: Delete a history entry by its ID
def delete_user_history_entry(entry_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("DELETE FROM user_history WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()

# New: Update filename for a history entry
def update_history_filename(entry_id, new_filename):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("UPDATE user_history SET file_name = ? WHERE id = ?", (new_filename, entry_id))
    conn.commit()
    conn.close()

# Initialize database
init_db()

# Retry function for OpenRouter API
import re

def generate_with_retry(prompt, max_retries=3, delay=1):
    global chosen_model, client
    
    # Fallback list for OpenRouter free models
    fallbacks = [
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'google/gemini-exp-1206:free'
    ]
    
    current_attempt_model = chosen_model

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=current_attempt_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            error_msg = str(e)
            
            # rate limit / quota OR model not found (404)
            if "429" in error_msg or "quota" in error_msg.lower() or "404" in error_msg or "not found" in error_msg.lower():
                st.warning(f"⚠️ Issue with `{current_attempt_model}`. Switching models...")
                
                # Check next fallback
                found_new = False
                for fb in fallbacks:
                    if fb != current_attempt_model:
                        current_attempt_model = fb
                        found_new = True
                        st.info(f"🔄 Switching to fallback: `{fb}`")
                        break
                
                if not found_new:
                     st.error("⏳ All models exhausted or busy. Please wait.")
                     time.sleep(5)
                
                continue
            
            elif "overloaded" in error_msg or "timeout" in error_msg:
                 time.sleep(delay * (attempt + 1))
                 continue

            raise e

def generate_fallback_description(content, content_type):
    """Generate a basic description when Gemini API fails"""
    if content_type.startswith("file (."):
        file_type = content_type.split("(")[1].split(")")[0]
        if file_type in ['.jpg', '.jpeg', '.png']:
            return f"This is an image file ({file_type}). The image contains text that was extracted using OCR. Extracted text: {content[:200]}..."
        elif file_type == '.pdf':
            return f"This is a PDF document. Extracted text content: {content[:200]}..."
        elif file_type == '.docx':
            return f"This is a Word document. Extracted text content: {content[:200]}..."
        elif file_type in ['.py', '.js', '.java', '.cpp']:
            return f"This is a {file_type} code file. Code content: {content[:200]}..."
        else:
            return f"This is a {file_type} file. Content: {content[:200]}..."
    else:
        return f"Text content: {content[:200]}..."

# All custom CSS for theming has been removed. The app will now use the default Streamlit appearance.

st.markdown("""
<style>
html, body, .stApp, .block-container {
    background: linear-gradient(135deg, #0A0F0D 0%, #2D4F4A 100%) !important;
    color: #CFE7E0 !important;
    min-height: 100vh;
}
section[data-testid="stSidebar"] {
    background: #233934 !important;
    color: #CFE7E0 !important;
    border-top-right-radius: 24px;
    border-bottom-right-radius: 24px;
    min-width: 320px;
}
.stButton>button, .stDownloadButton>button {
    background: #8DB1A4 !important;
    color: #0A0F0D !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: bold;
    font-size: 1.1rem;
    padding: 0.6rem 1.2rem;
    margin-bottom: 0.5rem;
    transition: background 0.2s;
    box-shadow: 0 2px 8px rgba(10,15,13,0.10);
}
.stButton>button:hover, .stDownloadButton>button:hover {
    background: #2D4F4A !important;
    color: #8DB1A4 !important;
}
.stRadio>div>label, .stCheckbox>div>label, .stSelectbox>div>label, .stMultiSelect>div>label {
    color: #CFE7E0 !important;
    font-weight: 600;
    font-size: 1.05rem;
}
.stTextInput, .stTextArea, .stFileUploader, .stSelectbox, .stMultiSelect, .stNumberInput, .stDateInput, .stTimeInput {
    background: #2D4F4A !important;
    color: #CFE7E0 !important;
    border-radius: 10px !important;
}
.stTextInput>div>div>input, .stTextArea>div>textarea, textarea, input[type="text"], input[type="password"] {
    background: #2D4F4A !important;
    color: #CFE7E0 !important;
    border: 1.5px solid #8DB1A4 !important;
    border-radius: 10px !important;
    font-size: 1.05rem;
}
.stTextInput>div>div>input:focus, .stTextArea>div>textarea:focus {
    border: 2px solid #CFE7E0 !important;
    outline: none !important;
}
.stTextInput>div>div>input::placeholder,
.stTextArea>div>textarea::placeholder {
    color: #8DB1A4 !important;
    opacity: 0.7 !important;
}
.stFileUploader, .stFileUploader>div, .stFileUploader>div>div {
    background: #233934 !important;
    color: #CFE7E0 !important;
    border-radius: 10px !important;
}
.stFileUploader label, .stFileUploader span, .stFileUploader button {
    color: #CFE7E0 !important;
}
div[data-testid="stFileDropzone"] {
    background: #2D4F4A !important;
    color: #CFE7E0 !important;
    border: 1.5px dashed #8DB1A4 !important;
    border-radius: 10px !important;
}
div[data-testid="stFileDropzone"] * {
    color: #CFE7E0 !important;
}
.welcome-header {
    background: rgba(30, 26, 46, 0.85);
    color: #CFE7E0;
    padding: 2rem;
    border-radius: 18px;
    text-align: center;
    margin-bottom: 2rem;
    box-shadow: 0 8px 32px 0 rgba(10, 15, 13, 0.37);
    font-size: 1.2rem;
}
.auth-header-box {
    background: linear-gradient(135deg, #2D4F4A 0%, #0A0F0D 100%);
    color: #CFE7E0;
    border-radius: 18px;
    box-shadow: 0 5px 20px rgba(10,15,13,0.3);
    padding: 2rem 1.5rem 1.5rem 1.5rem;
    max-width: 600px;
    margin: 2.5rem auto 2rem auto;
    text-align: center;
}
.auth-header-box h1 {
    margin-bottom: 0.5rem;
    font-size: 2.2rem;
    color: #CFE7E0;
}
.auth-header-box div {
    font-size: 1.2rem;
    color: #CFE7E0;
    opacity: 0.95;
}
.stSidebar .stButton>button, .stSidebar .stDownloadButton>button {
    width: 100%;
    margin-bottom: 0.5rem;
}
.stSidebar .stCheckbox {
    margin-bottom: 0.2rem;
}
.stSidebar .stExpander {
    background: #2D4F4A !important;
    border-radius: 10px !important;
    margin-bottom: 0.5rem;
}
.stSidebar .stExpanderHeader {
    color: #CFE7E0 !important;
    font-weight: bold;
}
.stSidebar .stExpanderContent {
    color: #CFE7E0 !important;
}
.stSidebar .stTextInput>div>div>input {
    background: #0A0F0D !important;
    color: #CFE7E0 !important;
    border-radius: 8px !important;
}
.stSidebar .stTextInput>div>div>input::placeholder {
    color: #8DB1A4 !important;
    opacity: 0.7 !important;
}
</style>
""", unsafe_allow_html=True)

# Authentication UI

# Check if user is logged in
if 'user_id' not in st.session_state:
    st.session_state.user_id = None
    st.session_state.username = None

if st.session_state.user_id is None:
    # Show the title only on the login/registration page
    st.markdown("""
    <h1 style='font-size:2.2rem; font-weight:800; color:#CFE7E0; margin-bottom:0.5em;'>
        OMNIDOC AI Multimodal Description &amp; Q&amp;A
    </h1>
    """, unsafe_allow_html=True)
    # Add a visually distinct box for the OMNIDOC AI Assistant title and subtitle
    st.markdown('''
    <div class="auth-header-box">
        <h1>🤖 OMNIDOC AI Assistant</h1>
        <div>Your intelligent document analysis companion</div>
    </div>
    ''', unsafe_allow_html=True)
    # Login form
    st.write("### Sign In")
    login_username = st.text_input("Username", key="login_username", placeholder="Enter your username")
    login_password = st.text_input("Password", type="password", key="login_password", placeholder="Enter your password")
    if st.button("Sign In", use_container_width=True):
        if login_username and login_password:
            user = login_user(login_username, login_password)
            if user:
                st.session_state.user_id = user[0]
                st.session_state.username = user[1]
                st.success(f"🎉 Welcome back, {user[1]}!")
                st.rerun()
            else:
                st.error("❌ Invalid username or password")
        else:
            st.warning("⚠️ Please enter both username and password")
    st.divider()
    st.write("### Create New Account")
    if st.button("Show Registration Form", use_container_width=True):
        st.session_state.show_register = True
    if st.session_state.get('show_register', False):
        st.write("#### Create Account")
        reg_username = st.text_input("Username", key="reg_username", placeholder="Choose a username")
        reg_password = st.text_input("Password", type="password", key="reg_password", placeholder="Create a password")
        reg_confirm_password = st.text_input("Confirm Password", type="password", key="reg_confirm_password", placeholder="Confirm your password")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Back to Login", use_container_width=True):
                st.session_state.show_register = False
                st.rerun()
        with col2:
            if st.button("Create Account", use_container_width=True):
                if reg_username and reg_password and reg_confirm_password:
                    if reg_password == reg_confirm_password:
                        if len(reg_password) >= 6:
                            if register_user(reg_username, reg_password):
                                st.success("🎉 Registration successful! Please login.")
                                st.session_state.show_register = False
                            else:
                                st.error("❌ Username already exists")
                        else:
                            st.error("❌ Password must be at least 6 characters long")
                    else:
                        st.error("❌ Passwords do not match")
                else:
                    st.warning("⚠️ Please fill in all fields")
    st.stop()

# Add CSS for the auth-header-box
st.markdown('''
<style>
.auth-header-box {
    background: linear-gradient(135deg, #2D4F4A 0%, #0A0F0D 100%);
    color: #CFE7E0;
    border-radius: 18px;
    box-shadow: 0 5px 20px rgba(10,15,13,0.3);
    padding: 2rem 1.5rem 1.5rem 1.5rem;
    max-width: 600px;
    margin: 2.5rem auto 2rem auto;
    text-align: center;
}
.auth-header-box h1 {
    margin-bottom: 0.5rem;
    font-size: 2.2rem;
    color: #CFE7E0;
}
.auth-header-box div {
    font-size: 1.2rem;
    color: #CFE7E0;
    opacity: 0.95;
}
</style>
''', unsafe_allow_html=True)

# Main application (user is logged in)
# Add this text before the welcome header
st.markdown("""
<h1 style='font-size:2.2rem; font-weight:800; color:#CFE7E0; margin-bottom:0.5em; text-align: center'>
    OMNIDOC AI Multimodal Description &amp; Q&amp;A
</h1>
""", unsafe_allow_html=True)

st.markdown(f'''
<div class="welcome-header">
    <div class="welcome-text">🎉 Welcome back, <strong>{st.session_state.username}</strong>!</div>
    <div class="app-description">Ready to explore your documents with AI-powered insights</div>
</div>
''', unsafe_allow_html=True)

st.write("### 📁 Upload & Analyze")
st.write("Upload a file (text, PDF, Word, image, code) or enter text. Get a detailed description, then ask questions!")

# Output type selection
output_type = st.radio(
    "Select output type:",
    ("Summary", "Detailed", "Bullet Points", "Q&A"),
    horizontal=True
)

# Logout button
st.markdown("""
<style>
.logout-button {
    background: linear-gradient(45deg, #ff6b6b, #ee5a24);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    width: 100%;
    margin-bottom: 2rem;
}
.logout-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);image.png
}
</style>
""", unsafe_allow_html=True)

if st.sidebar.button("🚪 Logout", use_container_width=True):
    st.session_state.user_id = None
    st.session_state.username = None
    st.rerun()

# User history in sidebar
st.sidebar.header("Your History")

def safe_text(text):
    if not text:
        return ""
    # Remove problematic characters and ensure ASCII compatibility
    safe_str = str(text).encode('ascii', 'ignore').decode('ascii')
    # Replace any remaining problematic characters
    safe_str = ''.join(char if ord(char) < 128 else '?' for char in safe_str)
    return safe_str

user_history = get_user_history(st.session_state.user_id)
if user_history:
    st.sidebar.write(f"\U0001F4DA You have {len(user_history)} session(s) in your history")
    # Download history as PDF
    def history_to_pdf(history):
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=10)
        pdf.cell(0, 10, txt="User History", ln=True, align="C")
        pdf.ln(5)

        for idx, row in enumerate(history, 1):
            content_type, content, description, questions, answers, created_at, entry_id, file_name = row

            try:
                pdf.set_font("Arial", style="B", size=9)
                display_name = file_name if file_name else f"{content_type} - {created_at[:10] if created_at else 'N/A'}"
                pdf.cell(0, 6, safe_text(f"Entry {idx} - {display_name}"), ln=True)
                pdf.set_font("Arial", size=8)

                # Truncate and clean text more aggressively
                desc_text = safe_text(description[:100] if description else "No description")
                content_text = safe_text(content[:100] if content else "No content")

                pdf.multi_cell(0, 4, f"Description: {desc_text}...")
                pdf.multi_cell(0, 4, f"Content: {content_text}...")

                if questions:
                    q_text = safe_text(questions[:80] if questions else "")
                    pdf.multi_cell(0, 4, f"Questions: {q_text}...")
                if answers:
                    a_text = safe_text(answers[:80] if answers else "")
                    pdf.multi_cell(0, 4, f"Answers: {a_text}...")
                pdf.ln(2)

            except Exception as e:
                # Skip problematic entries
                pdf.cell(0, 6, f"Entry {idx}: Error processing entry", ln=True)
                continue

        pdf_output = pdf.output(dest='S')
        return bytes(pdf_output)
    pdf_data = history_to_pdf(user_history)
    st.sidebar.download_button(
        label="⬇️ Download History (PDF)",
        data=pdf_data,
        file_name="history.pdf",
        mime="application/pdf"
    )
    # Search/filter input
    search_term = st.sidebar.text_input('🔍 Search history...', key='history_search')

    # Filter history based on search term
    def matches_search(entry, term):
        content_type, content, description, questions, answers, created_at, entry_id = entry
        term = term.lower()
        return (
            term in (content_type or '').lower() or
            term in (content or '').lower() or
            term in (description or '').lower() or
            term in (questions or '').lower() or
            term in (answers or '').lower() or
            term in (created_at or '').lower()
        )

    filtered_history = [entry for entry in user_history if matches_search(entry, search_term)] if search_term else user_history

    # Bulk delete: checkboxes for each entry
    if 'selected_history_ids' not in st.session_state:
        st.session_state['selected_history_ids'] = set()
    selected_ids = set(st.session_state.get('selected_history_ids', set()))

    # Show checkboxes and entries (filtered)
    for i, (content_type, content, description, questions, answers, created_at, entry_id, file_name) in enumerate(filtered_history):
        display_name = file_name if file_name else f"{content_type} - {created_at[:10]}"
        with st.sidebar.expander(f"📄 {display_name}", expanded=False):
            checked = st.checkbox("Select", key=f"select_{entry_id}", value=entry_id in selected_ids)
            if checked:
                selected_ids.add(entry_id)
            else:
                selected_ids.discard(entry_id)
            st.session_state['selected_history_ids'] = selected_ids

            # File name editing
            if st.session_state.get(f'edit_name_{entry_id}', False):
                new_name = st.text_input("Edit name:", value=file_name or display_name, key=f"name_input_{entry_id}")
                col_save, col_cancel = st.columns(2)
                with col_save:
                    if st.button("💾 Save", key=f"save_name_{entry_id}"):
                        update_history_filename(entry_id, new_name)
                        st.session_state[f'edit_name_{entry_id}'] = False
                        st.success("Name updated!")
                        st.rerun()
                with col_cancel:
                    if st.button("❌ Cancel", key=f"cancel_name_{entry_id}"):
                        st.session_state[f'edit_name_{entry_id}'] = False
                        st.rerun()
            else:
                if st.button("✏️ Edit Name", key=f"edit_btn_{entry_id}"):
                    st.session_state[f'edit_name_{entry_id}'] = True
                    st.rerun()

            st.write(f"**Content:** {content[:80]}...")
            st.write(f"**Description:** {description[:80]}...")
            if questions:
                st.write(f"**Questions:** {questions[:50]}...")
            col1, col2 = st.columns([2, 1])
            with col1:
                if st.button(f"🔄 Load Session {i+1}", key=f"load_{entry_id}"):
                    st.session_state['description'] = description
                    st.session_state['last_answer'] = answers if answers else ""
                    st.session_state['current_questions'] = questions
                    st.session_state['current_answers'] = answers
                    st.rerun()
            with col2:
                if st.button(f"🗑️ Delete", key=f"delete_{entry_id}"):
                    st.session_state['confirm_delete_id'] = entry_id
                    st.session_state['show_confirm_delete'] = True
                    st.rerun()

    # Always show bulk delete button (disabled if nothing selected)
    delete_selected_disabled = len(selected_ids) == 0
    if st.sidebar.button("🗑️ Delete Selected", key="bulk_delete_btn", disabled=delete_selected_disabled):
        # Store a static copy of selected IDs for confirmation
        st.session_state['bulk_delete_ids'] = list(selected_ids)
        st.session_state['show_bulk_confirm_delete'] = True

    # Bulk delete confirmation
    if st.session_state.get('show_bulk_confirm_delete', False):
        bulk_ids = st.session_state.get('bulk_delete_ids', [])
        with st.sidebar:
            st.warning(f"Are you sure you want to delete {len(bulk_ids)} selected history entr{'y' if len(bulk_ids)==1 else 'ies'}? This action cannot be undone.")
            col_c1, col_c2 = st.columns(2)
            with col_c1:
                if st.button("Yes, Delete All", key="confirm_bulk_delete_yes"):
                    for entry_id in bulk_ids:
                        delete_user_history_entry(entry_id)
                    st.session_state['selected_history_ids'] = set()
                    st.session_state['bulk_delete_ids'] = []
                    st.session_state['show_bulk_confirm_delete'] = False
                    st.success("Selected history entries deleted.")
                    st.rerun()
            with col_c2:
                if st.button("Cancel", key="confirm_bulk_delete_no"):
                    st.session_state['show_bulk_confirm_delete'] = False
                    st.rerun()

    # Individual delete confirmation
    if st.session_state.get('show_confirm_delete', False):
        entry_id = st.session_state.get('confirm_delete_id')
        with st.sidebar:
            st.warning("Are you sure you want to delete this history entry? This action cannot be undone.")
            col_c1, col_c2 = st.columns(2)
            with col_c1:
                if st.button("Yes, Delete", key="confirm_delete_yes"):
                    delete_user_history_entry(entry_id)
                    st.session_state['show_confirm_delete'] = False
                    st.session_state['confirm_delete_id'] = None
                    # Also remove from selected if present
                    selected_ids = set(st.session_state.get('selected_history_ids', set()))
                    if entry_id in selected_ids:
                        selected_ids.discard(entry_id)
                        st.session_state['selected_history_ids'] = selected_ids
                    st.success("History entry deleted.")
                    st.rerun()
            with col_c2:
                if st.button("Cancel", key="confirm_delete_no"):
                    st.session_state['show_confirm_delete'] = False
                    st.session_state['confirm_delete_id'] = None
                    st.rerun()

else:
    st.sidebar.write("\U0001F4DD No history yet. Start by uploading a file or entering text!")

uploaded_file = st.file_uploader('Upload file', type=['txt', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'py', 'js', 'java', 'cpp'])
input_text = st.text_area('Or paste text/code here')

description = ''

if st.button('Generate Description'):
    content = ''
    content_type = 'text'
    file_name = None  # Add this to track file name

    if uploaded_file:
        file_name = uploaded_file.name  # Get the actual file name
        suffix = os.path.splitext(uploaded_file.name)[1].lower()
        content_type = f"file ({suffix})"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.read())
            tmp_path = tmp.name
        if suffix == '.pdf':
            content = extract_text_from_pdf(tmp_path)
        elif suffix == '.docx':
            content = extract_text_from_word(tmp_path)
        elif suffix in ['.jpg', '.jpeg', '.png']:
            content = extract_text_from_image(tmp_path)
        elif suffix in ['.py', '.js', '.java', '.cpp']:
            content = extract_text_from_code(tmp_path)
        elif suffix == '.txt':
            with open(tmp_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        else:
            st.error('Unsupported file type.')
        os.remove(tmp_path)
    elif input_text.strip():
        content = input_text.strip()
        content_type = 'text input'
    else:
        st.warning('Please upload a file or enter text.')

    if content:
        with st.spinner('Generating description...'):
            try:
                if output_type == "Summary":
                    detailed_prompt = (
                        "Read the following content and generate a concise summary. "
                        "Focus on the main points and keep it brief. "
                        "Content:\n\n" + content
                    )
                    # Generate and display the description immediately
                    description = generate_with_retry(detailed_prompt)
                    st.markdown("### Generated Summary")
                    st.write(description)

                elif output_type == "Bullet Points":
                    detailed_prompt = (
                        "Read the following content and generate a list of key points in bullet format. "
                        "Each bullet should be a distinct, important idea. "
                        "Content:\n\n" + content
                    )
                    # Generate and display the description immediately
                    description = generate_with_retry(detailed_prompt)
                    st.markdown("### Generated Bullet Points")
                    st.write(description)

                elif output_type == "Q&A":
                    # Enhanced question extraction to capture ALL question formats
                    extract_questions_prompt = (
                        "Carefully analyze the following content and extract ALL questions, regardless of format. "
                        "Look for:\n"
                        "- Questions ending with '?' (What is this?)\n"
                        "- Questions starting with question words without '?' (What is the main idea)\n"
                        "- Numbered questions (1. Define photosynthesis, 2. Explain the process)\n"
                        "- Imperative questions (Explain, Define, Describe, List, Compare, etc.)\n"
                        "- Fill-in-the-blank questions (Complete the sentence, Fill in the blanks)\n"
                        "- True/False questions\n"
                        "- Multiple choice questions\n"
                        "- Any sentence that asks for information, explanation, or response\n\n"
                        "Extract EVERY question you find, even if it doesn't end with '?'. "
                        "List each question on a separate line with clear numbering (1., 2., 3., etc.). "
                        "Be extremely thorough - don't miss any questions regardless of their format. "
                        "If absolutely no questions are found, respond with 'No questions found'.\n\n"
                        "Content:\n\n" + content
                    )

                    with st.spinner('Extracting ALL questions (including those without ?)...'):
                        questions_text = generate_with_retry(extract_questions_prompt)
                        st.session_state['extracted_questions'] = questions_text

                    # More comprehensive question parsing
                    if "No questions found" not in questions_text.lower():
                        # Split by lines and filter with expanded criteria
                        lines = questions_text.split('\n')
                        questions_list = []

                        for line in lines:
                            line = line.strip()
                            if line and (
                                # Numbered questions (1., 2., Q1, etc.)
                                any(char.isdigit() for char in line[:10]) or
                                # Questions ending with ?
                                line.endswith('?') or
                                # Question word starters
                                any(line.lower().startswith(word) for word in [
                                    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose',
                                    'can', 'will', 'would', 'could', 'should', 'may', 'might',
                                    'is', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had'
                                ]) or
                                # Imperative question words
                                any(line.lower().startswith(word) for word in [
                                    'explain', 'describe', 'define', 'list', 'compare', 'contrast',
                                    'analyze', 'evaluate', 'discuss', 'identify', 'name', 'state',
                                    'give', 'provide', 'show', 'prove', 'calculate', 'solve',
                                    'find', 'determine', 'complete', 'fill', 'choose', 'select'
                                ]) or
                                # Contains question indicators
                                any(phrase in line.lower() for phrase in [
                                    'true or false', 'multiple choice', 'fill in', 'complete the',
                                    'choose the', 'select the', 'which of the following'
                                ])
                            ):
                                questions_list.append(line)

                        if questions_list:
                            st.write(f"Found {len(questions_list)} questions. Generating detailed answers...")

                            all_qa_pairs = []
                            progress_bar = st.progress(0)

                            for i, question in enumerate(questions_list):
                                # Clean the question (remove numbering if present)
                                clean_question = question
                                # Remove various numbering formats
                                import re
                                clean_question = re.sub(r'^[\d]+[\.\)\:]?\s*', '', clean_question)
                                clean_question = re.sub(r'^[Qq][\d]+[\.\)\:]?\s*', '', clean_question)
                                clean_question = clean_question.strip()

                                with st.spinner(f'Generating detailed answer for question {i+1}/{len(questions_list)}...'):
                                    answer_prompt = (
                                        f"Based on the following content, provide a comprehensive, detailed, and thorough answer to this question: {clean_question}\n\n"
                                        f"Content:\n{content}\n\n"
                                        f"Question: {clean_question}\n\n"
                                        "Instructions for your answer:\n"
                                        "- Provide a detailed, comprehensive response\n"
                                        "- Include relevant context and background information\n"
                                        "- Use specific examples or details from the content when possible\n"
                                        "- Make the answer informative and complete\n"
                                        "- If the content doesn't fully answer the question, explain what information is available\n"
                                        "- For imperative questions (Explain, Define, etc.), provide thorough explanations"
                                    )

                                    try:
                                        answer = generate_with_retry(answer_prompt)
                                        all_qa_pairs.append(f"**Q{i+1}: {clean_question}**\n\n{answer}\n\n---\n")
                                    except Exception as e:
                                        all_qa_pairs.append(f"**Q{i+1}: {clean_question}**\n\nError generating answer: {str(e)}\n\n---\n")

                                progress_bar.progress((i + 1) / len(questions_list))

                            description = f"**Extracted Questions and Detailed Answers:**\n\n" + "\n".join(all_qa_pairs)
                        else:
                            description = "No valid questions could be extracted from the content."
                    else:
                        description = "No questions were found in the provided content."
                else:  # Detailed
                    detailed_prompt = (
                        "Read the following content and generate a detailed, comprehensive description. "
                        "Include all important points, context, and nuances. "
                        "Content:\n\n" + content
                    )
                    description = generate_with_retry(detailed_prompt)

                # After generating the description, store it in session state
                st.session_state['description'] = description
                st.session_state['last_answer'] = ''
                st.session_state['current_content'] = content
                st.session_state['current_content_type'] = content_type

                if not description:
                    description = "No description generated." 
                
                # Save to history
                save_user_history(
                    st.session_state.user_id,
                    content_type,
                    content,
                    description,
                    "",  # No questions yet
                    "",  # No answers yet
                    file_name
                )
                st.rerun()  # Refresh to show in history immediately
            except Exception as e:
                error_msg = str(e)
                if "overloaded" in error_msg or "timeout" in error_msg or "deadline" in error_msg:
                    st.warning("🚫 Gemini API is currently overloaded. Using fallback description.")
                    st.info("💡 You can still use the app with basic descriptions while we wait for the API to recover.")

                    # Generate fallback description
                    description = generate_fallback_description(content, content_type)
                    st.session_state['description'] = description
                    st.session_state['last_answer'] = ''
                    st.session_state['current_content'] = content
                    st.session_state['current_content_type'] = content_type
    
                    # Save fallback description to history
                    save_user_history(
                        st.session_state.user_id,
                        content_type,
                        content,
                        description,
                        "",  # No questions yet
                        ""   # No answers yet
                    )
                else:
                    st.error(f"❌ Error generating description: {error_msg}")

# Always show the description if it exists
if 'description' in st.session_state and st.session_state['description']:
    st.subheader('Description')
    st.write(st.session_state['description'])
    st.subheader('Ask a Question')
    question = st.text_input('Your question')

    if st.button('Get Answer') and question.strip():
        prompt = f"Context: {st.session_state['description']}\n\nQuestion: {question}"
        with st.spinner('Getting answer...'):
            try:
                st.session_state['last_answer'] = generate_with_retry(prompt)

                # Save to history
                if 'current_content' in st.session_state:
                    current_questions = st.session_state.get('current_questions', '')
                    current_answers = st.session_state.get('current_answers', '')

                    if current_questions:
                        current_questions += f"\n---\n{question}"
                        current_answers += f"\n---\n{st.session_state['last_answer']}"
                    else:
                        current_questions = question
                        current_answers = st.session_state['last_answer']

                    st.session_state['current_questions'] = current_questions
                    st.session_state['current_answers'] = current_answers

                    # Save to database
                    save_user_history(
                        st.session_state.user_id,
                        st.session_state['current_content_type'],
                        st.session_state['current_content'],
                        st.session_state['description'],
                        current_questions,
                        current_answers
                    )
            except Exception as e:
                error_msg = str(e)
                if "overloaded" in error_msg or "timeout" in error_msg or "deadline" in error_msg:
                    st.warning("🚫 Gemini API is currently overloaded. Using fallback response.")
                    fallback_answer = f"Based on the content, I can see this is about: {st.session_state['description'][:100]}... However, I cannot provide a detailed answer right now due to API overload. Please try again later for a more comprehensive response."
                    st.session_state['last_answer'] = fallback_answer

                    # Save fallback answer to history
                    if 'current_content' in st.session_state:
                        current_questions = st.session_state.get('current_questions', '')
                        current_answers = st.session_state.get('current_answers', '')

                        if current_questions:
                            current_questions += f"\n---\n{question}"
                            current_answers += f"\n---\n{fallback_answer}"
                        else:
                            current_questions = question
                            current_answers = fallback_answer

                        st.session_state['current_questions'] = current_questions
                        st.session_state['current_answers'] = current_answers

                        # Save to database
                        save_user_history(
                            st.session_state.user_id,
                            st.session_state['current_content_type'],
                            st.session_state['current_content'],
                            st.session_state['description'],
                            current_questions,
                            current_answers
                        )
                else:
                    st.error(f"❌ Error getting answer: {error_msg}")
                    
    # Show the last answer if it exists
    if st.session_state.get('last_answer'):
        st.subheader('Answer')
        st.write(st.session_state['last_answer'])