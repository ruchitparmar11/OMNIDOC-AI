import os
try:
    import tomllib
except ImportError:
    import toml as tomllib  # Fallback if toml is installed but python < 3.11

from openai import OpenAI
import httpx

print("Starting OpenRouter Debug...")

try:
    # Load secrets
    if os.path.exists(".streamlit/secrets.toml"):
        with open(".streamlit/secrets.toml", "rb") as f:
            secrets = tomllib.load(f)
        api_key = secrets.get("OPENROUTER_API_KEY") or secrets.get("OPENAI_API_KEY")
    else:
        print("secrets.toml not found.")
        api_key = None
    
    if not api_key:
        print("Error: No OPENROUTER_API_KEY found in .streamlit/secrets.toml")
        exit(1)

    print(f"API Key found: {api_key[:5]}...")

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        http_client=httpx.Client()
    )

    models_to_check = [
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'google/gemini-exp-1206:free',
        'google/gemini-pro-1.5'
    ]

    print("\nChecking specific models used in main.py...")
    
    for model in models_to_check:
        print(f"\nTesting model: {model}")
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "say hello"}],
            )
            print(f"Success! Response: {response.choices[0].message.content}")
        except Exception as e:
            print(f"Failed: {str(e)}")

except ImportError:
    print("Error: 'toml' module not found. Please install it using 'pip install toml'")
except Exception as e:
    print(f"An error occurred: {e}")
