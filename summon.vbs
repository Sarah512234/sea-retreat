Option Explicit
Dim sh, ps
Set sh = CreateObject("WScript.Shell")
ps = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - 4) & ".ps1"
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps & """", 0, False
