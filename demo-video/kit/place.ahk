#Requires AutoHotkey v2.0
#SingleInstance Force
hwnd := WinExist("about:blank - Chrome")
if !hwnd {
  FileAppend("no window`n", "*")
  ExitApp 1
}
WinActivate(hwnd)
Sleep 300
Run('"C:\Program Files\glzr.io\GlazeWM\cli\glazewm.exe" command set-floating --centered=false', , "Hide")
Sleep 300
WinMove(480, 270, 2880, 1620, hwnd)
Sleep 500
WinGetPos(&x, &y, &w, &h, hwnd)
FileAppend("pos " x "," y "," w "," h "`n", "*")
