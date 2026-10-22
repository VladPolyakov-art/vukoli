@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0vukoli.ps1" %*
exit /b %ERRORLEVEL%
