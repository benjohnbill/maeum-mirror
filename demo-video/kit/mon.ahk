#Requires AutoHotkey v2.0
out := ""
Loop MonitorGetCount() {
  MonitorGet(A_Index, &l, &t, &r, &b)
  MonitorGetWorkArea(A_Index, &wl, &wt, &wr, &wb)
  out .= A_Index " " MonitorGetName(A_Index) " " l "," t "," r "," b " work " wl "," wt "," wr "," wb (A_Index = MonitorGetPrimary() ? " primary" : "") "`n"
}
FileAppend(out, "*", "UTF-8")
