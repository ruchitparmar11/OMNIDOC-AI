import urllib.request
import re

html = urllib.request.urlopen('https://omnidoc-ai.vercel.app/').read().decode()
js_files = re.findall(r'/assets/[^\"]+\.js', html)
for js in js_files:
    js_content = urllib.request.urlopen('https://omnidoc-ai.vercel.app' + js).read().decode()
    if 'http://localhost:5000' in js_content:
        print("FOUND localhost:5000 in", js)
        # check if there's any other string with /api
        print("Matches for /api:", re.findall(r'http[s]?://[^\"\']+/api', js_content))
    else:
        print("NOT FOUND localhost:5000 in", js)
        print("Matches for /api:", re.findall(r'http[s]?://[^\"\']+/api', js_content))
