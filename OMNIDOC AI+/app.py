import os
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/')
def home():
    return render_template_string("""
        <h2>Welcome to the GenAI Application!</h2>
        <p>This is a simple application without authentication.</p>
        <a href='/app' style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Go to Streamlit App</a>
    """)

@app.route('/app')
def streamlit_app():
    return render_template_string("""
        <h2>Welcome to the GenAI Streamlit App!</h2>
        <p>Open a new terminal and run:</p>
        <pre>streamlit run main.py</pre>
        <p>Then access <a href="http://localhost:8501" target="_blank">http://localhost:8501</a></p>
        <a href='/' style="padding: 10px 20px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px;">Back to Home</a>
    """)

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False) 