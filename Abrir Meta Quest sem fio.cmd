@echo off
title Casas 3D - Meta Quest sem fio
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-Casas3D.ps1" -AirLink
if errorlevel 1 pause
