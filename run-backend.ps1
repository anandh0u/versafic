$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeHome = Join-Path $projectRoot ".tools\node-v24.14.1-win-x64"
$npm = Join-Path $nodeHome "npm.cmd"
$backendDir = Join-Path $projectRoot "backend"

if (-not (Test-Path $npm)) {
  throw "Local Node runtime not found at $nodeHome"
}

$env:PATH = "$nodeHome;$env:PATH"
Set-Location $backendDir

Write-Host "Starting backend with local Node runtime..." -ForegroundColor Cyan
& $npm run dev
