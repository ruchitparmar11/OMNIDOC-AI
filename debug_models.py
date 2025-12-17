import google.generativeai as genai
import toml
import os

try:
    data = toml.load(".streamlit/secrets.toml")
    api_key = data["GEMINI_API_KEY"]
    genai.configure(api_key=api_key)
    print("Successfully configured API. Listing models:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")