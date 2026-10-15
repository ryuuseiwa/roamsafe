$ErrorActionPreference = 'Stop'
$roamLinuxPath = (wsl.exe -d Ubuntu -- wslpath -a $PSScriptRoot).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Ubuntu WSL is required. See README.md.' }
Write-Host 'Starting RoamSafe at http://localhost:5173 — press Ctrl+C to stop.'
wsl.exe -d Ubuntu -- bash "$roamLinuxPath/scripts/dev.sh"
