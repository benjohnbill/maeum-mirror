#Requires AutoHotkey v2.0
#SingleInstance Off
; Line-based input server. Reads tab-separated commands on stdin, answers "ok ..." on stdout.
DllCall("SetThreadDpiAwarenessContext", "ptr", -4, "ptr")
DllCall("winmm\timeBeginPeriod", "uint", 1)
CoordMode "Mouse", "Screen"
SendMode "Input"

stdin := FileOpen("*", "r", "UTF-8")
stdout := FileOpen("*", "w", "UTF-8")

Reply(msg) {
  global stdout
  stdout.Write(msg "`n")
  stdout.Read(0)
}

Ease(t) => t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2

Move(x, y, ms) {
  MouseGetPos(&sx, &sy)
  steps := Max(1, Round(ms / 8))
  Loop steps {
    e := Ease(A_Index / steps)
    DllCall("SetCursorPos", "int", Round(sx + (x - sx) * e), "int", Round(sy + (y - sy) * e))
    DllCall("Sleep", "uint", 8)
  }
}

Loop {
  line := stdin.ReadLine()
  if (line = "")
    continue
  a := StrSplit(RTrim(line, "`r"), "`t")
  switch a[1] {
    case "quit":
      Reply("ok")
      ExitApp
    case "activate":
      hwnd := WinExist(a[2])
      WinActivate(hwnd)
      WinWaitActive(hwnd, , 3)
      Reply("ok " hwnd)
    case "client":
      ; Screen rect of the page area inside the Chrome window.
      hwnd := WinExist(a[2])
      WinGetClientPos(&cx, &cy, , , hwnd)
      ControlGetPos(&x, &y, &w, &h, "Chrome_RenderWidgetHostHWND1", hwnd)
      WinGetPos(&wx, &wy, &ww, &wh, hwnd)
      Reply("ok " (cx + x) " " (cy + y) " " w " " h " " wx " " wy " " ww " " wh)
    case "warp":
      DllCall("SetCursorPos", "int", Integer(a[2]), "int", Integer(a[3]))
      Reply("ok")
    case "move":
      Move(Integer(a[2]), Integer(a[3]), Integer(a[4]))
      Reply("ok")
    case "click":
      Click("Down")
      DllCall("Sleep", "uint", 70)
      Click("Up")
      Reply("ok")
    case "type":
      Loop Parse a[2] {
        SendText(A_LoopField)
        DllCall("Sleep", "uint", Random(Integer(a[3]), Integer(a[4])))
      }
      Reply("ok")
    case "key":
      Send(a[2])
      Reply("ok")
    default:
      Reply("err unknown " a[1])
  }
}
