@echo off
echo ==============================================
echo   Compiling Teyvat Arena 3D (.exe) ...
echo ==============================================
g++ -O2 -mwindows src\main.cpp -lopengl32 -lglu32 -lgdi32 -luser32 -lwinmm -o TeyvatArena.exe
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Game compiled successfully!
    echo Output: TeyvatArena.exe
) else (
    echo.
    echo [ERROR] Compilation failed!
)
pause
