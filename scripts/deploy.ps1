# PowerShell deploy script for Catalyst on Windows.
# Generates seed data, copies it into the function package, builds the client,
# and deploys the app. Assumes catalyst login + catalyst init are already done.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)
Push-Location -Path '..'

Write-Host '==> Generating seed data (for Data Store import)…'
node data/generate_seed.js

Write-Host '==> Copying seed data into the function package…'
$target = Join-Path -Path 'function/api' -ChildPath 'data/seed'
if (-Not (Test-Path $target)) { New-Item -ItemType Directory -Path $target | Out-Null }
Get-ChildItem -Path 'data/seed' -Filter '*.json' | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $target -Force
}

Write-Host '==> Installing function deps…'
Push-Location -Path 'function/api'
npm install --production
Pop-Location

Write-Host '==> Building client…'
Push-Location -Path 'client'
npm install
npm run build
Pop-Location

Write-Host '==> Deploying to Catalyst…'
catalyst deploy

Write-Host 'Done. Remember to set function env vars (DATA_PROVIDER=catalyst, LLM_PROVIDER=quickml, QUICKML_*) in the console.'

Pop-Location
Pop-Location
