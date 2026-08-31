@echo off
echo.
echo  ╔════════════════════════════════════════╗
echo  ║   Sentinel Attendance — Starting...    ║
echo  ╚════════════════════════════════════════╝
echo.
echo  Starting backend server on http://localhost:3000
echo  Then open index.html in your browser.
echo.
cd /d "%~dp0backend"
node server.js
