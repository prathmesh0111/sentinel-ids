@echo off
setlocal EnableExtensions
title SecureMart - Fraud and IP Anomaly Detection
cd /d "%~dp0"

echo ==================================================
echo    SecureMart - One-Click Launcher
echo    PostgreSQL 18 + Next.js 16 + ML + Live Stream
echo ==================================================
echo.

rem ---- 0. sanity checks ----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on this PC.
  echo         Install Node.js 20 or newer from https://nodejs.org
  echo         then double-click this file again.
  echo.
  pause
  exit /b 1
)

for /f %%i in ('node -v') do set NODEV=%%i
echo [OK] Node.js %NODEV% detected.

rem ---- 0b. stop stale instances of this app left by a previous crashed run --
rem (they hold port 3000 and the Prisma engine DLL, breaking a fresh start)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*G2Project*' } | ForEach-Object { Write-Output ('[CLEAN] Stopping stale app process ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul
for %%P in (3000 3003) do (
  for /f "tokens=5" %%p in ('netstat -aon ^| findstr /c:":%%P " ^| findstr /i "LISTENING"') do (
    echo [CLEAN] Port %%P is still held by old process %%p - stopping it...
    taskkill /f /pid %%p >nul 2>&1
  )
)
echo.

rem ---- 1. install dependencies ---------------------------------------------
if not exist "node_modules\.bin\next.cmd" (
  if exist "node_modules\" echo [WARN] Incomplete install detected - reinstalling...
  echo [1/5] Installing dependencies - first run only, please wait...
  echo       approx 400 MB incl. embedded PostgreSQL binaries
  call npm install
  if errorlevel 1 (
    echo [WARN] install failed once - killing file locks and retrying...
    ping -n 6 127.0.0.1 >nul
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*G2Project*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul
    call npm install
    if errorlevel 1 (
      echo [ERROR] npm install failed twice. Close other windows using this
      echo         folder, check your internet connection, then retry.
      pause
      exit /b 1
    )
  )
) else (
  echo [1/5] Dependencies already installed - skipping.
)
echo.

rem ---- 2. environment file ---------------------------------------------------
if not exist ".env" (
  copy /y "07_CONFIGURATION\env.example" ".env" >nul
  echo [2/5] Created .env from .env.example.
) else (
  echo [2/5] .env already present - skipping.
)
echo.

rem ---- 3. database: postgres up + first-run seed (existing data preserved) --
echo [3/5] Preparing PostgreSQL database...
call node 05_DATABASE\database_connection\boot-db.mjs
if errorlevel 1 (
  echo [ERROR] Database setup failed - read the messages above.
  echo         Hint: antivirus/firewall blocking port 5432 is a common cause.
  pause
  exit /b 1
)
echo.

rem ---- 4. live security stream (separate minimized window) -------------------
echo [4/5] Starting live security event stream on port 3003...
start "SecureMart Stream :3003" /min cmd /k "npm run stream"
echo.

rem ---- 5. web app -------------------------------------------------------------
echo [5/5] Starting SecureMart web app on http://localhost:3000 ...
echo       Your browser will open automatically in a few seconds.
echo.
ping -n 13 127.0.0.1 >nul
rem ---- warm up routes so the first real login never hits a cold compile ----
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://localhost:3000/ -TimeoutSec 25 } catch {}; try { $r = Invoke-WebRequest -UseBasicParsing -Method Post -Body '{}' -ContentType 'application/json' http://localhost:3000/api/auth/login -TimeoutSec 25 } catch {}"
if not defined NOBROWSER start "" "http://localhost:3000"

echo ==================================================
echo   SecureMart is RUNNING
echo.
echo    Store front : http://localhost:3000
echo    Admin panel : http://localhost:3000/admin
echo    Admin login : admin@securemart.in / AdminPass#2026
echo.
echo   Keep this window OPEN - closing it stops the web app.
echo   Admin panel: Products, Orders, Customers, IP Ledger,
echo   Access Control, ML Models and Settings.
echo ==================================================
echo.
call npm run dev
echo.
echo Web app stopped. PostgreSQL keeps running in the background
echo so the next start is instant. Close the "SecureMart Stream"
echo window too if you want everything fully stopped.
pause
