import os
import httpx
try:
    import tomllib
except ImportError:
    import toml as tomllib

print("Checking OpenRouter Key Status...")

if os.path.exists(".streamlit/secrets.toml"):
    with open(".streamlit/secrets.toml", "rb") as f:
        secrets = tomllib.load(f)
    api_key = secrets.get("OPENROUTER_API_KEY")
    
    if not api_key:
         print("No OPENROUTER_API_KEY found in .streamlit/secrets.toml")
         exit()
         
    print(f"Key found: {api_key[:8]}...")
    
    try:
        response = httpx.get(
            "https://openrouter.ai/api/v1/auth/key",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            key_data = data.get('data', {})
            print("\n--- Key Information ---")
            print(f"Label: {key_data.get('label', 'N/A')}")
            
            # Format usage (usually in credits/USD)
            usage = key_data.get('usage', 0)
            print(f"Usage So Far: {usage}")
            
            limit = key_data.get('limit')
            if limit is not None:
                print(f"Credit Limit: {limit} (Remaining: {limit - usage if limit else 'Unlimited'})")
            else:
                print("Credit Limit: Unlimited/Prepaid")
                
            print(f"Is Free Tier: {key_data.get('is_free_tier', False)}")
            
            rate_limit = key_data.get('rate_limit')
            if rate_limit:
                 print(f"Rate Limit details: {rate_limit}")
            else:
                 print("Rate Limit details: Standard")
                 
        else:
            print(f"Error checking key: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Connection error: {e}")

else:
    print("secrets.toml not found")
