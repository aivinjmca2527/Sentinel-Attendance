@echo off
echo.
echo  ╔════════════════════════════════════════╗
echo  ║   Sentinel Attendance — Starting...    ║
echo  ╚════════════════════════════════════════╝
echo.
echo  Starting backend server on http://localhost:3000
echo  Open http://localhost:3000 in your browser.
echo.
cd /d "%~dp0"
node server.js
