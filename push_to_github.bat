@echo off
setlocal
echo ========================================================
echo   Push Teyvat Impact Collection to your GitHub
echo ========================================================
echo.

set PATH=%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\Programs\gh;%PATH%

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git not found!
    pause
    exit /b 1
)

echo Initializing Git repository...
git init -b main
git config user.name "l0f"
git config user.email "l0f@users.noreply.github.com"
git add .
git commit -m "Initial release: Teyvat Impact Collection (Web 3D + C++ Standalone .EXE)"

echo.
echo ========================================================
echo   Enter your GitHub repository URL:
echo   Example: https://github.com/YOUR_USERNAME/teyvat-impact-games.git
echo ========================================================
set /p REPO_URL="Repository URL: "

if "%REPO_URL%"=="" (
    echo No repository URL provided!
    pause
    exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCCESS] Repository successfully pushed to GitHub!
    echo ========================================================
) else (
    echo.
    echo [ERROR] Failed to push. Make sure the repository exists and you have write permissions.
)

pause
