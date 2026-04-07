$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeHome = Join-Path $projectRoot ".tools\node-v24.14.1-win-x64"
$npm = Join-Path $nodeHome "npm.cmd"
$frontendDir = Join-Path $projectRoot "frontend"

if (-not (Test-Path $npm)) {
  throw "Local Node runtime not found at $nodeHome"
}

$env:PATH = "$nodeHome;$env:PATH"
Set-Location $frontendDir

Write-Host "Starting frontend with local Node runtime..." -ForegroundColor Cyan
& $npm run dev
