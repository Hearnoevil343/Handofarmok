@echo off
title Hand of Armok - Simulation lab
cd /d "%~dp0"

:: ---------------------------------------------------------------------------
:: Simulation lab launcher. Double-click, pick a mode, and read the report it
:: opens at the end. See tools\simlab\README.md for what the modes do.
::
:: Uses Node.js from this machine, or the portable copy that
:: "Launch (Windows).bat" downloads into .node if Node is not installed.
:: ---------------------------------------------------------------------------

where npm >nul 2>nul
if errorlevel 1 (
  if exist "%~dp0.node\npm.cmd" (
    set "PATH=%~dp0.node;%PATH%"
  ) else (
    echo Node.js was not found. Run "Launch (Windows).bat" once first - it
    echo fetches a portable copy - then try this again.
    pause
    exit /b 1
  )
)

if not exist node_modules (
  echo First run - installing dependencies. This takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 goto :failed
)

echo Compiling the world engine...
call npm run --silent simlab:build
if errorlevel 1 goto :failed

echo.
echo   1  Estimate only   - how many runs and roughly how long, then stop
echo   2  Sweep           - every combination in sweep.default.json
echo   3  Search          - hill-climb for better settings (8 rounds)
echo.
set "MODE="
set /p "MODE=Pick 1, 2 or 3 and press Enter: "

if "%MODE%"=="1" (
  call npm run --silent simlab -- sweep --dry
  goto :end
)
if "%MODE%"=="2" (
  call npm run --silent simlab -- sweep
  if errorlevel 1 goto :failed
  goto :report
)
if "%MODE%"=="3" (
  call npm run --silent simlab -- search --config tools/simlab/search.json --rounds 8
  if errorlevel 1 goto :failed
  goto :report
)
echo "%MODE%" is not one of the choices.
goto :end

:report
echo.
echo Done. Opening the runs folder - REPORT.md is the summary.
start "" "%~dp0runs"
goto :end

:failed
echo.
echo Something failed. Scroll up for the error.

:end
echo.
pause
