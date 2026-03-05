import urllib.request
import re

js_content = urllib.request.urlopen("https://omnidoc-ai.vercel.app/assets/index-BethHu7L.js").read().decode()

import json
api_base_parts = js_content.split('localhost:5000')
print("Split localhost count:", len(api_base_parts))

api_base_parts2 = js_content.split('/api')
print("Split /api count:", len(api_base_parts2))
if len(api_base_parts2) > 1:
    print("context:", repr(api_base_parts2[0][-50:] + "/api" + api_base_parts2[1][:50]))
    print("context2:", repr(api_base_parts2[1][-50:] + "/api" + api_base_parts2[2][:50]))

