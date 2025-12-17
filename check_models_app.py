import streamlit as st
import google.generativeai as genai

try:
    api_key = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=api_key)
    st.write("Listing available models:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            st.write(f"- {m.name}")
            print(f"MODEL: {m.name}")
except Exception as e:
    st.error(f"Error: {e}")