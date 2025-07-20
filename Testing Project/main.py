import streamlit as st
import os
import tempfile
import google.generativeai as genai
import sqlite3
import hashlib
import datetime
import time
from utils.extract_pdf import extract_text_from_pdf
from utils.extract_word import extract_text_from_word
from utils.extract_image import extract_text_from_image
from utils.extract_code import extract_text_from_code

# Set Gemini API key
os.environ["GEMINI_API_KEY"] = "AIzaSyC6zJJDT_Lbev8VpSrbYjPgmlMXIxVu174"
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-2.0-flash-exp')

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

def save_user_history(user_id, content_type, content, description, questions="", answers=""):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("""INSERT INTO user_history 
                 (user_id, content_type, content, description, questions, answers) 
                 VALUES (?, ?, ?, ?, ?, ?)""", 
              (user_id, content_type, content, description, questions, answers))
    conn.commit()
    conn.close()

def get_user_history(user_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("""SELECT content_type, content, description, questions, answers, created_at 
                 FROM user_history WHERE user_id = ? ORDER BY created_at DESC""", (user_id,))
    history = c.fetchall()
    conn.close()
    return history

# Initialize database
init_db()

# Retry function for Gemini API
def generate_with_retry(prompt, max_retries=3, delay=2):
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            error_msg = str(e)
            if attempt < max_retries - 1:  # Not the last attempt
                if "overloaded" in error_msg or "timeout" in error_msg or "deadline" in error_msg:
                    st.warning(f"🔄 Attempt {attempt + 1} failed. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
            # If it's the last attempt or a different error, raise the exception
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

# Authentication UI
st.title('OMNIDOC AI Multimodal Description & Q&A')

# Check if user is logged in
if 'user_id' not in st.session_state:
    st.session_state.user_id = None
    st.session_state.username = None

if st.session_state.user_id is None:
    # Default Streamlit UI for authentication
    st.title("🤖 OMNIDOC AI Assistant")
    st.subheader("Your intelligent document analysis companion")
    
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
    
    # Divider
    st.divider()
    
    # Registration
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
    
    st.stop()

# Main application (user is logged in)
st.markdown("""
<style>
.welcome-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 15px;
    text-align: center;
    margin-bottom: 2rem;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}
.welcome-text {
    font-size: 1.5rem;
    margin-bottom: 1rem;
}
.app-description {
    font-size: 1.1rem;
    opacity: 0.9;
}
.main-content {
    background: white;
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
}

</style>
""", unsafe_allow_html=True)

st.markdown(f'''
<div class="welcome-header">
    <div class="welcome-text">🎉 Welcome back, <strong>{st.session_state.username}</strong>!</div>
    <div class="app-description">Ready to explore your documents with AI-powered insights</div>
</div>
''', unsafe_allow_html=True)

st.write("### 📁 Upload & Analyze")
st.write("Upload a file (text, PDF, Word, image, code) or enter text. Get a detailed description, then ask questions!")

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
user_history = get_user_history(st.session_state.user_id)
if user_history:
    st.sidebar.write(f"📚 You have {len(user_history)} session(s) in your history")
    for i, (content_type, content, description, questions, answers, created_at) in enumerate(user_history):
        with st.sidebar.expander(f"📄 {content_type} - {created_at[:10]}", expanded=False):
            st.write(f"**Content:** {content[:80]}...")
            st.write(f"**Description:** {description[:80]}...")
            if questions:
                st.write(f"**Questions:** {questions[:50]}...")
            if st.button(f"🔄 Load Session {i+1}", key=f"load_{i}"):
                st.session_state['description'] = description
                st.session_state['last_answer'] = answers if answers else ""
                st.session_state['current_questions'] = questions
                st.session_state['current_answers'] = answers
                st.rerun()
else:
    st.sidebar.write("📝 No history yet. Start by uploading a file or entering text!")

uploaded_file = st.file_uploader('Upload file', type=['txt', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'py', 'js', 'java', 'cpp'])
input_text = st.text_area('Or paste text/code here')

description = ''

if st.button('Generate Description'):
    content = ''
    content_type = 'text'
    
    if uploaded_file:
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
                detailed_prompt = (
                    "Read the following content and generate a detailed, comprehensive description. "
                    "Include all important points, context, and nuances. "
                    "Content:\n\n" + content
                )
                description = generate_with_retry(detailed_prompt)
                st.session_state['description'] = description
                st.session_state['last_answer'] = ''
                st.session_state['current_content'] = content
                st.session_state['current_content_type'] = content_type
                
                # Save description to history immediately
                save_user_history(
                    st.session_state.user_id,
                    content_type,
                    content,
                    description,
                    "",  # No questions yet
                    ""   # No answers yet
                )
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