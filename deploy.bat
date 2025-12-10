@echo off
echo =====================================
echo Railway Track App Deployment Script
echo =====================================
echo.

REM 環境変数ファイルチェック
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo .env file created. Please update it with your settings.
)

REM Dockerチェック
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker not found. Please install Docker Desktop for Windows.
    pause
    exit /b 1
)

echo Starting Docker deployment...
echo.

REM Docker Composeでビルドと起動
docker-compose build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker build failed.
    pause
    exit /b 1
)

docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker startup failed.
    pause
    exit /b 1
)

echo.
echo =====================================
echo Deployment Complete!
echo =====================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3002
echo Proxy:    http://localhost:80
echo.
echo To stop: docker-compose down
echo To view logs: docker-compose logs -f
echo.
pause