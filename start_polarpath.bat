@echo off
title POLARPATH AI — Decision Support Platform (Team AXIOM - SIH 2026 PS 26059)
echo ===============================================================================
echo                POLARPATH AI — ANTARCTIC NAVIGATION INTELLIGENCE
echo                       Team AXIOM | THINK. BUILD. IMPACT.
echo                      Smart India Hackathon 2026 (PS 26059)
echo ===============================================================================
echo.
echo [1/2] Launching backend server on http://localhost:8000 ...
start "" http://localhost:8000
echo.
echo [2/2] Running FastAPI server...
py -3.13 backend\run_server.py
pause
