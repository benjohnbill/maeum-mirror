#!/usr/bin/env bash
# Restart the demo Chrome WITHOUT wiping the profile (the user is signed in).
# Light theme, no bookmarks bar, no search suggestions, no history of earlier takes.
W=/mnt/c/Users/benjohnbill/AppData/Local/Temp/herz-demo
cd /mnt/c
"/mnt/c/Program Files/nodejs/node.exe" -e "fetch('http://127.0.0.1:9333/json/version').then(r=>r.json()).then(v=>{const ws=new WebSocket(v.webSocketDebuggerUrl);ws.onopen=()=>{ws.send(JSON.stringify({id:1,method:'Browser.close'}));setTimeout(()=>process.exit(0),500)}}).catch(()=>process.exit(0))" 2>/dev/null
sleep 3
python3 - "$W/profile/Default/Preferences" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
d.setdefault('browser', {}).setdefault('theme', {})['color_scheme2'] = 1   # 1 = light
d.setdefault('bookmark_bar', {})['show_on_all_tabs'] = False
d.setdefault('search', {})['suggest_enabled'] = False
json.dump(d, open(p, 'w', encoding='utf-8'))
PY
python3 - "$W/profile/Local State" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
labs = set(d.setdefault('browser', {}).get('enabled_labs_experiments', []))
labs |= {'aim-server-eligibility@2', 'omnibox-dynamic-ai-mode-button@2', 'composebox-persistent-aim-button-omnibox@2', 'aim-3p-entrypoint@2', 'glic@2'}
d['browser']['enabled_labs_experiments'] = sorted(labs)
json.dump(d, open(p, 'w', encoding='utf-8'))
PY
rm -f "$W/profile/Default/History" "$W/profile/Default/History-journal"
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir="$(wslpath -w $W)\\profile" --remote-debugging-port=9333 --no-first-run --no-default-browser-check --disable-extensions --window-position=480,270 --window-size=2880,1620 --lang=ko about:blank >/dev/null 2>&1 &
sleep 4
"/mnt/c/Program Files/AutoHotkey/v2/AutoHotkey64.exe" "$(wslpath -w $W/place.ahk)" | cat
