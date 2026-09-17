@echo off
title Quemeds - SIH 2026 Hybrid Quantum Predictor
echo =================================================================
echo   QUEMEDS - Hybrid Quantum-Classical Disease Prediction Platform
echo   Smart India Hackathon 2026 Launcher
echo =================================================================
echo.
echo Starting Quemeds Backend and Web Dashboard...
echo.

cd /d "%~dp0"
python frontend\run_web.py

pause
