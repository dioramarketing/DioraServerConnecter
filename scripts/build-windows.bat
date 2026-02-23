@echo off
chcp 65001 >nul 2>&1
title DioraServerConnecter - Windows 빌드
color 0A

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║     DioraServerConnecter - Windows 빌드 스크립트     ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: ─── 관리자 권한 확인 ───
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] 관리자 권한이 필요할 수 있습니다.
    echo [!] 문제가 발생하면 마우스 우클릭 → "관리자 권한으로 실행"
    echo.
)

:: ─── 프로젝트 루트로 이동 ───
cd /d "%~dp0.."
set "PROJECT_ROOT=%cd%"
echo [*] 프로젝트 경로: %PROJECT_ROOT%
echo.

:: ─── 1. Node.js 확인 ───
echo [1/5] Node.js 확인 중...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js가 설치되어 있지 않습니다.
    echo [*] Node.js를 자동으로 설치합니다...
    echo.

    :: winget으로 설치 시도
    where winget >nul 2>&1
    if %errorLevel% equ 0 (
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    ) else (
        echo [!] winget을 사용할 수 없습니다.
        echo [!] https://nodejs.org 에서 Node.js LTS를 수동 설치해주세요.
        echo.
        pause
        exit /b 1
    )

    :: PATH 새로고침
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    where node >nul 2>&1
    if %errorLevel% neq 0 (
        echo [X] Node.js 설치 후 이 스크립트를 다시 실행해주세요.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%i in ('node -v') do echo       Node.js %%i OK
echo.

:: ─── 2. Rust 확인 ───
echo [2/5] Rust 확인 중...
where rustc >nul 2>&1
if %errorLevel% neq 0 (
    :: cargo가 PATH에 있는지 한 번 더 확인
    if exist "%USERPROFILE%\.cargo\bin\rustc.exe" (
        set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
    ) else (
        echo [!] Rust가 설치되어 있지 않습니다.
        echo [*] Rust를 자동으로 설치합니다... (1~2분 소요)
        echo.

        :: rustup 다운로드 및 설치
        curl -sSf https://win.rustup.rs/x86_64 -o "%TEMP%\rustup-init.exe"
        if %errorLevel% neq 0 (
            echo [X] Rust 다운로드 실패. 인터넷 연결을 확인해주세요.
            pause
            exit /b 1
        )
        "%TEMP%\rustup-init.exe" -y --default-toolchain stable 2>nul
        set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
    )
)
for /f "tokens=*" %%i in ('rustc --version') do echo       %%i OK
echo.

:: ─── 3. npm install ───
echo [3/5] 의존성 설치 중... (처음 실행 시 2~3분)
cd /d "%PROJECT_ROOT%\client"
if not exist "node_modules" (
    call npm install
    if %errorLevel% neq 0 (
        echo [X] npm install 실패
        pause
        exit /b 1
    )
) else (
    echo       node_modules 존재, 스킵
)
echo.

:: ─── 4. 빌드 ───
echo [4/5] DioraServerConnecter 빌드 중... (처음 5~10분, 이후 1~2분)
echo       잠시 기다려주세요...
echo.
call npx tauri build 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [X] 빌드 실패!
    echo [?] 오류 내용을 확인하고 다시 시도해주세요.
    echo.
    pause
    exit /b 1
)

:: ─── 5. 결과 안내 ───
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║                  빌드 완료!                          ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo   설치 파일 위치:
echo.

set "BUNDLE_DIR=%PROJECT_ROOT%\client\src-tauri\target\release\bundle"

:: NSIS 설치파일
if exist "%BUNDLE_DIR%\nsis\*.exe" (
    for %%f in ("%BUNDLE_DIR%\nsis\*.exe") do (
        echo   [EXE 설치파일] %%f
        echo.
        set "INSTALLER=%%f"
    )
)

:: MSI 설치파일
if exist "%BUNDLE_DIR%\msi\*.msi" (
    for %%f in ("%BUNDLE_DIR%\msi\*.msi") do (
        echo   [MSI 설치파일] %%f
    )
)

echo.
echo ──────────────────────────────────────────────────────
echo   EXE 파일을 직원에게 전달하면 더블클릭으로 설치됩니다.
echo ──────────────────────────────────────────────────────
echo.

:: 결과 폴더 열기
if exist "%BUNDLE_DIR%\nsis" (
    explorer "%BUNDLE_DIR%\nsis"
) else if exist "%BUNDLE_DIR%\msi" (
    explorer "%BUNDLE_DIR%\msi"
)

pause
