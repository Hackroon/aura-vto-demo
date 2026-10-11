@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  npm install --cache "%cd%\.npm-cache"
  if errorlevel 1 exit /b 1
)
start "Aura Try-On" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:3939"
npm start
