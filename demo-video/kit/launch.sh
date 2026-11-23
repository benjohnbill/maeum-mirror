#!/usr/bin/env bash
# Fresh Chrome profile on the main monitor, floated out of GlazeWM, 2880x1620.
W=${DEMO_DIR:-/mnt/c/Users/benjohnbill/Videos/herz-demo}
curl -s -X PUT http://127.0.0.1:9333/json/close >/dev/null 2>&1
cmd.exe /c "curl -s http://127.0.0.1:9333/json/version" >/dev/null 2>&1 && { echo "closing old"; cd /mnt/c && "/mnt/c/Program Files/nodejs/node.exe" -e "fetch('http://127.0.0.1:9333/json/version').then(r=>r.json()).then(v=>{const ws=new WebSocket(v.webSocketDebuggerUrl);ws.onopen=()=>{ws.send(JSON.stringify({id:1,method:'Browser.close'}));setTimeout(()=>process.exit(0),500)}})"; sleep 2; }
rm -rf $W/profile; mkdir -p $W/profile/Default
printf '%s' '{"search":{"suggest_enabled":false},"signin":{"allowed":false},"browser":{"has_seen_welcome_page":true}}' > $W/profile/Default/Preferences
printf '%s' '{"browser":{"enabled_labs_experiments":["aim-server-eligibility@2","omnibox-dynamic-ai-mode-button@2","composebox-persistent-aim-button-omnibox@2","aim-3p-entrypoint@2","glic@2"]}}' > "$W/profile/Local State"
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir="$(wslpath -w $W)\\profile" --remote-debugging-port=9333 --no-first-run --disable-extensions --disable-component-extensions-with-background-pages --no-default-browser-check --window-position=480,270 --window-size=2880,1620 --lang=ko about:blank >/dev/null 2>&1 &
sleep 4
"/mnt/c/Program Files/AutoHotkey/v2/AutoHotkey64.exe" "$(wslpath -w $W/place.ahk)" | cat
