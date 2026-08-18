@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================
echo   Ave Mujica TimeLine - Update
echo ================================
echo.

:loop
python generate_data.py

if %errorlevel% == 0 (
    echo.
    echo [OK] data.js updated! Refresh page to see changes.
) else (
    echo.
    echo [FAIL] Check: Python 3 installed? data.xlsx exists?
)

echo.
echo ----------------------------------
echo   [1] Update again
echo   [0] Quit
echo ----------------------------------

:wait
set "choice="
set /p "choice=Enter: "

if "%choice%"=="1" (
    echo.
    echo ================================
    goto loop
)
if "%choice%"=="0" (
    echo.
    echo Done.
    goto end
)
echo Invalid input, please enter 1 or 0.
goto wait

:end
pause