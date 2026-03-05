import urllib.request
import re

js_content = urllib.request.urlopen("https://omnidoc-ai.vercel.app/assets/index-BethHu7L.js").read().decode()

import json
url = re.findall(r'\"http[^\"]+api\"', js_content)
url2 = re.findall(r'http[^\"]+api', js_content)
auth = re.findall(r'[^\,]+\/auth\/register[^\,]+', js_content)
auth2 = re.findall(r'API_BASE[^\,]+', js_content)
print("URL:", url, url2)
print("Auth string context:", auth)
print("API_BASE context", auth2)
