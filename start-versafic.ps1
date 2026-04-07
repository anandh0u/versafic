$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendScript = Join-Path $projectRoot "run-backend.ps1"
$frontendScript = Join-Path $projectRoot "run-frontend.ps1"

if (-not (Test-Path $backendScript)) {
  throw "Missing launcher: $backendScript"
}

if (-not (Test-Path $frontendScript)) {
  throw "Missing launcher: $frontendScript"
}

Write-Host "Opening backend and frontend in separate PowerShell windows..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$backendScript`""
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$frontendScript`""
