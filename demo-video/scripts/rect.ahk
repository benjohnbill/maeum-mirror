#Requires AutoHotkey v2.0
out := ""
for hwnd in WinGetList("ahk_exe chrome.exe") {
  WinGetPos(&x, &y, &w, &h, hwnd)
  t := WinGetTitle(hwnd)
  if (t != "")
    out .= t " | " x "," y "," w "," h "`n"
}
FileAppend(out, "*", "UTF-8")
