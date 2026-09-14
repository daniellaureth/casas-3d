@echo off
title Casas 3D - Meta Quest por USB
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-Casas3D.ps1" -Quest
if errorlevel 1 pause
