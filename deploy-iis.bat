@echo off
echo ============================================
echo   Docupile Share - IIS Deployment Script
echo ============================================
echo.

REM ── Change to the folder where this .bat file lives ──
cd /d "%~dp0"
echo Working directory: %CD%
echo.

REM ---------- CONFIG ----------
SET DEPLOY_PATH=C:\inetpub\wwwroot\docupile-share
REM Change DEPLOY_PATH above to your actual IIS site folder
REM ----------------------------

echo [1/5] Installing dependencies (including dev deps needed for build)...
call npm install
if %errorlevel% neq 0 (echo ERROR: npm install failed & pause & exit /b 1)

echo.
echo [2/5] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (echo ERROR: prisma generate failed & pause & exit /b 1)

echo.
echo [3/5] Building Next.js application...
call npm run build
if %errorlevel% neq 0 (echo ERROR: build failed & pause & exit /b 1)

echo.
echo [4/5] Copying files to deployment folder: %DEPLOY_PATH%
if not exist "%DEPLOY_PATH%" mkdir "%DEPLOY_PATH%"

REM Copy standalone build (contains server + all node_modules needed)
xcopy /E /I /Y ".next\standalone\*"   "%DEPLOY_PATH%\"

REM Copy static assets
if not exist "%DEPLOY_PATH%\.next\static" mkdir "%DEPLOY_PATH%\.next\static"
xcopy /E /I /Y ".next\static\*"       "%DEPLOY_PATH%\.next\static\"

REM Copy public folder (uploaded files, logos, etc.)
if not exist "%DEPLOY_PATH%\public" mkdir "%DEPLOY_PATH%\public"
xcopy /E /I /Y "public\*"             "%DEPLOY_PATH%\public\"

REM Copy IIS config and server entry
copy /Y "web.config"  "%DEPLOY_PATH%\web.config"
copy /Y "server.js"   "%DEPLOY_PATH%\server.js"

REM Copy .env and data folder
copy /Y ".env"        "%DEPLOY_PATH%\.env"
if not exist "%DEPLOY_PATH%\data" mkdir "%DEPLOY_PATH%\data"
xcopy /E /I /Y "data\*" "%DEPLOY_PATH%\data\"

echo.
echo [5/5] Done! Files deployed to: %DEPLOY_PATH%
echo.
echo ============================================
echo  NEXT STEPS in IIS Manager:
echo  1. Create a new Site pointing to: %DEPLOY_PATH%
echo  2. Set Application Pool to: No Managed Code
echo  3. Ensure iisnode is installed (see README)
echo  4. Set NODE_ENV=production in env vars
echo  5. Browse to your site URL
echo ============================================
echo.
pause
