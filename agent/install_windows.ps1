param(
  [Parameter(Mandatory=$true)][string]$ServerId,
  [Parameter(Mandatory=$true)][string]$Token,
  [Parameter(Mandatory=$true)][string]$Url,
  [ValidateSet(5,10,30)][int]$Interval = 5
)

$ErrorActionPreference = "Stop"
$AgentDir = Join-Path $env:ProgramData "ServerMonitor"
$ConfigPath = Join-Path $AgentDir "agent.json"
$AgentPath = Join-Path $AgentDir "windows_monitor.py"

New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "windows_monitor.py") $AgentPath -Force

$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { throw "Python is required. Install Python 3.11+ and make sure 'python' is on PATH." }

& $Python -m pip install --upgrade psutil requests

@{
  server_id = $ServerId
  token = $Token
  url = $Url
  interval = $Interval
} | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8

# Restrict the configuration file to local administrators and SYSTEM.
icacls $ConfigPath /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)" | Out-Null

$Action = New-ScheduledTaskAction -Execute $Python -Argument "`"$AgentPath`" --config `"$ConfigPath`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "ServerMonitor Agent" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName "ServerMonitor Agent"
Write-Host "ServerMonitor agent installed and started."
