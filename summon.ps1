$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $project 'src\index.html'
$uri = 'file:///' + ($html -replace '\\', '/')

$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge)) {
  $edge = Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'
}

$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$w = 960
$h = 760
$x = $wa.Right - $w - 12
$y = $wa.Top + 12

if (Test-Path -LiteralPath $edge) {
  Start-Process -FilePath $edge -ArgumentList @("--app=$uri", "--window-size=$w,$h", "--window-position=$x,$y")
} else {
  Start-Process $uri
}
