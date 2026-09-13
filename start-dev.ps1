#Requires -Version 5.1
<#
AcademiAI dev launcher - starts the whole stack in SEPARATE terminal windows:

  1. Infra      docker compose up -d   (Postgres / Redis / RabbitMQ / MinIO / Mailpit)
  2. Backend    manage.py runserver     :8000  - its own window
  3. Frontend   npm run dev             :5173  - its own window
  4. (optional) Celery worker (solo pool on win32) - its own window

Why this instead of .vscode/tasks.json?
  VS Code tasks can only render INSIDE the integrated Terminal panel (tabs /
  side-by-side splits). They cannot open separate OS windows. This script
  launches real console windows, each with a descriptive title bar.

Usage:
  .\start-dev.ps1                  # infra + backend + frontend
  .\start-dev.ps1 -IncludeWorker   # + Celery worker (ai,ingestion,email,celery queues)
  .\start-dev.ps1 -SkipDb          # infra already up; just the app windows
#>
[CmdletBinding()]
param(
    [switch]$SkipDb,
    [switch]$IncludeWorker
)

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backendDir ".venv\Scripts\python.exe"))) {
    throw "Backend venv not found at $backendDir\.venv - create it per README.md first."
}

# 1) Infrastructure
if (-not $SkipDb) {
    Write-Host "Starting infrastructure (docker compose up -d)..."
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "docker compose failed (exit $LASTEXITCODE). Is Docker Desktop running? Continuing with app windows - DB-dependent requests will fail until infra is up."
    }
}

# 2) + 3) (+ 4) App windows.
# The -Command strings are single-quoted in the PARENT so '$Host' survives
# interpolation here, then sets the window title before starting the process.
$backendCmd  = '$Host.UI.RawUI.WindowTitle = ''AcademiAI Backend (:8000)''; .\.venv\Scripts\python.exe manage.py runserver'
$frontendCmd = '$Host.UI.RawUI.WindowTitle = ''AcademiAI Frontend (:5173)''; npm run dev'

Start-Process -FilePath 'powershell.exe' -WorkingDirectory $backendDir  -ArgumentList '-NoProfile', '-NoExit', '-Command', $backendCmd
Start-Process -FilePath 'powershell.exe' -WorkingDirectory $frontendDir -ArgumentList '-NoProfile', '-NoExit', '-Command', $frontendCmd

if ($IncludeWorker) {
    $workerCmd = '$Host.UI.RawUI.WindowTitle = ''AcademiAI Celery Worker''; .\.venv\Scripts\celery.exe -A config worker -l info -Q ai,ingestion,email,celery'
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $backendDir -ArgumentList '-NoProfile', '-NoExit', '-Command', $workerCmd
}

Write-Host ''
Write-Host "Launched."
Write-Host "  Backend : http://localhost:8000"
Write-Host "  Frontend: http://localhost:5173"
if ($IncludeWorker) { Write-Host "  Worker  : celery (solo pool, queues: ai,ingestion,email,celery)" }
Write-Host ''
Write-Host "Close a window to stop that process. To stop everything: docker compose down (keeps volumes)."