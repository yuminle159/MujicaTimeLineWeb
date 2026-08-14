@echo off
cd /d "%~dp0"

echo ================================
echo   Ave Mujica TimeLine - Update
echo ================================
echo.
echo Generating data.js from data.csv ...
echo.

python generate_data.py

if %errorlevel% == 0 (
    echo.
    echo [OK] data.js updated! Refresh the page to see changes.
) else (
    echo.
    echo [FAIL] Please check:
    echo   1. Python 3 is installed
    echo   2. data.csv exists
    echo   3. data.csv is saved as UTF-8
)

echo.
pause