@echo off
title GeminiHub - Dev Runner
echo ======================================================================
echo                 GEMINIHUB ENTERPRISE - LOCAL RUNNER                  
echo ======================================================================
echo.

echo [1/3] Kiem tra va khoi dong Docker (PostgreSQL 16 va Redis 7)...
docker compose up -d
if %errorlevel% neq 0 (
    echo [CANH BAO] Docker Desktop chua duoc bat hoac chua khoi dong xong.
    echo Neu can dung Database that, vui long mo ung dung Docker Desktop!
)

echo.
echo [2/3] Dang khoi dong Backend API (Fastify Cua so 1)...
start "GeminiHub API [Port 4000]" cmd /k "npm run dev:api"

echo.
echo [3/3] Dang khoi dong Frontend Web (Next.js Cua so 2)...
start "GeminiHub Web [Port 3000]" cmd /k "npm run dev:web"

echo.
echo ======================================================================
echo   GEMINIHUB DA DUOC KHOI DONG THANH CONG!
echo   * Frontend Web UI : http://localhost:3000
echo   * Backend Swagger : http://localhost:4000/docs
echo ======================================================================
echo.
pause

