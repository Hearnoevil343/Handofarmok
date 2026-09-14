@echo off
title Hand of Armok
cd /d "%~dp0"

:: ---------------------------------------------------------------------------
:: Hand of Armok launcher.
::
:: Nothing needs to be installed first. If Node.js is not on this machine, a
:: portable copy is downloaded into a folder next to this file and used from
:: there. It never touches the rest of the system.
:: ---------------------------------------------------------------------------

set "PORTABLE=%~dp0.node"

where npm >nul 2>nul
if not errorlevel 1 goto :have_node

if exist "%PORTABLE%\npm.cmd" (
  set "PATH=%PORTABLE%;%PATH%"
  goto :have_node
)

echo.
echo Node.js was not found. Fetching a portable copy - about 30 MB, once.
echo It is kept in the .node folder beside this launcher and nowhere else.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$idx = Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/latest-v22.x/';" ^
  "$zip = ($idx.Links | Where-Object { $_.href -match 'node-v[\d\.]+-win-x64\.zip$' } | Select-Object -First 1).href;" ^
  "if (-not $zip) { throw 'Could not find a Node.js download.' };" ^
  "$url = 'https://nodejs.org/dist/latest-v22.x/' + $zip;" ^
  "Write-Host ('Downloading ' + $zip);" ^
  "Invoke-WebRequest -UseBasicParsing $url -OutFile '%TEMP%\hoa-node.zip';" ^
  "Expand-Archive -Force '%TEMP%\hoa-node.zip' '%TEMP%\hoa-node';" ^
  "$inner = Get-ChildItem '%TEMP%\hoa-node' | Select-Object -First 1;" ^
  "if (Test-Path '%PORTABLE%') { Remove-Item -Recurse -Force '%PORTABLE%' };" ^
  "Move-Item $inner.FullName '%PORTABLE%';" ^
  "Remove-Item '%TEMP%\hoa-node.zip' -Force;" ^
  "Remove-Item -Recurse -Force '%TEMP%\hoa-node'"

if errorlevel 1 (
  echo.
  echo Could not download Node.js. Check your connection and try again, or
  echo install it yourself from https://nodejs.org and rerun this launcher.
  pause
  exit /b 1
)
set "PATH=%PORTABLE%;%PATH%"

:have_node
if not exist node_modules (
  echo First run - installing dependencies. This takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo Install failed. Scroll up for the error.
    pause
    exit /b 1
  )
)

echo Starting. Your browser will open automatically.
echo Close this window to stop.
echo.
call npm run dev -- --open
pause
