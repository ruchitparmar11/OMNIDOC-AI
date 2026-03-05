import urllib.request
import re

js_content = urllib.request.urlopen("https://omnidoc-ai.vercel.app/assets/index-BethHu7L.js").read().decode()

for line in js_content.split(','):
    if '/api' in line:
        print(line[:200])
