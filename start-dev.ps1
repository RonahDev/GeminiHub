Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     GeminiHub - He Thong Ban Link Gemini Tu Dong         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kiem tra Docker
Write-Host "`n[1/4] Kiem tra Docker Daemon..." -ForegroundColor Yellow
$dockerOk = $false
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerOk = $true
        Write-Host "  -> Docker Daemon dang hoat dong!" -ForegroundColor Green
    }
} catch {}

if (-not $dockerOk) {
    Write-Host "  [!] Docker Desktop chua bat!" -ForegroundColor Red
    Write-Host "  Vui long mo ung dung Docker Desktop tren Windows, cho den khi bieu tuong mau xanh (Engine running)." -ForegroundColor Yellow
    Write-Host "  Sau khi bat Docker Desktop, hay chay lai script nay." -ForegroundColor Yellow
    Read-Host "Nhan Enter de thoat..."
    exit 1
}

# 2. Khoi dong PostgreSQL & Redis
Write-Host "`n[2/4] Khoi dong PostgreSQL 16 & Redis 7..." -ForegroundColor Yellow
docker compose up -d
Start-Sleep -Seconds 3

# 3. Nap database schema & du lieu mau
Write-Host "`n[3/4] Dong bo database schema & nap du lieu mau (Seed)..." -ForegroundColor Yellow
npm run db:push --workspace=@geminihub/api
npm run db:seed --workspace=@geminihub/api

# 4. Khoi dong server
Write-Host "`n[4/4] Khoi dong Backend API va Frontend Web..." -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  - Backend API: http://localhost:4000/api/v1" -ForegroundColor Cyan
Write-Host "  - Swagger Docs: http://localhost:4000/docs" -ForegroundColor Cyan
Write-Host "`nTai khoan Admin: admin@geminihub.vn | Mat khau: AdminPassword123" -ForegroundColor Magenta
Write-Host "Tai khoan Khach: khachhang@gmail.com | Mat khau: KhachHang123 (Co san 200k vi)" -ForegroundColor Magenta

# Mo 2 cua so dev rieng biet
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev:api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev:web"

Write-Host "`nDa mo 2 cua so chay Backend va Frontend thanh cong!" -ForegroundColor Green

