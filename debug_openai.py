import google.generativeai as genai
import os
import sys

print(f"Python version: {sys.version}")

try:
    import google.generativeai
    print(f"Google Generative AI version: {google.generativeai.__version__}")
except Exception as e:
    print(f"Error importing google.generativeai: {e}")

