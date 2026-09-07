# PolarPath AI PowerShell Launcher
# Team AXIOM — SIH 2026 Problem Statement 26059

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "              POLARPATH AI — ANTARCTIC NAVIGATION INTELLIGENCE" -ForegroundColor White
Write-Host "                     Team AXIOM | THINK. BUILD. IMPACT." -ForegroundColor Yellow
Write-Host "                    Smart India Hackathon 2026 (PS 26059)" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launching web browser on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process "http://localhost:8000"
Write-Host "Starting FastAPI server with Python 3.13..." -ForegroundColor White
py -3.13 backend\run_server.py
