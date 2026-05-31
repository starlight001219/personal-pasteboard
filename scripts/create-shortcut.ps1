$ErrorActionPreference = 'Stop'

$TargetScript = 'C:\Users\联想\personal-pasteboard\scripts\start-pasteboard.ps1'
$ShortcutPath = 'C:\Users\联想\Desktop\启动个人粘贴板.lnk'
$PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $PowerShell
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$TargetScript`""
$shortcut.WorkingDirectory = 'C:\Users\联想\personal-pasteboard'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Hotkey = 'CTRL+ALT+P'
$shortcut.Description = '启动个人粘贴板 SSH 隧道并打开浏览器'
$shortcut.Save()

Write-Output $ShortcutPath
