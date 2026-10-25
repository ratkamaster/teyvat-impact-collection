@echo off
setlocal
echo ========================================================
echo   Publish Teyvat Impact Collection to GitHub
echo ========================================================
echo.

set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\Programs\gh;%PATH%"

cd /d "%~dp0"

echo [Step 1/2] Checking GitHub authentication...
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Please log into your GitHub account:
    echo (A browser window will open, and a one-time code will be copied to your clipboard)
    echo.
    gh auth login -w -p https
)

echo.
echo [Step 2/2] Creating GitHub repository and pushing files...
set /p REPONAME="Repository name [default: teyvat-impact-collection]: "
if "%REPONAME%"=="" set REPONAME=teyvat-impact-collection

gh repo create %REPONAME% --public --source=. --push

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCCESS] Your project is now live on GitHub!
    echo ========================================================
) else (
    echo.
    echo If repository already exists, pushing changes...
    git push -u origin main
)

pause
