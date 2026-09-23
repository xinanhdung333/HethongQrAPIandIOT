@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "DATABASE_URL=postgresql://smartqr:1@localhost:5432/smartqr?schema=public"
set "REDIS_URL=redis://localhost:6379"
set "JWT_SECRET=dev-secret"
set "QR_JWT_SECRET=qr-jwt-dev-secret"
set "API_KEY_PEPPER=local-development-api-key-pepper"
set "API_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
set "PAYMENT_LINK_SECRET=payment-link-dev-secret"
set "PAYOS_WEBHOOK_SECRET=payos-demo-dev-secret"
set "WEB_ORIGIN=http://localhost:3000"
set "PAYMENT_DEMO_MODE=true"
set "INTERNAL_SERVICE_TOKEN=docker-internal-service-token"
set "NEXT_PUBLIC_API_URL=http://localhost:4000"
set "NEXT_PUBLIC_SOCKET_URL=http://localhost:4000"
set "API_PUBLIC_URL=http://localhost:4000"

call :ensure_docker

:menu
cls
echo ============================================================
echo  SmartQR Hybrid Dev
echo  Docker: postgres + redis
echo  Local:  backend/services/frontend
echo ============================================================
echo.
echo  1. Start Docker DB + Redis
echo  2. Run Prisma generate + migrate dev
echo.
echo  3. Start API               localhost:4000
echo  4. Start Web Frontend      localhost:3000
echo  5. Start Ticket Service    localhost:3003
echo  6. Start Rental Service    localhost:3004
echo  7. Start QR Service        localhost:3005
echo.
echo  8. Start API + Web
echo  9. Start all local services
echo.
echo  A. Stop API port 4000
echo  B. Stop Web port 3000
echo  C. Stop Ticket port 3003
echo  D. Stop Rental port 3004
echo  E. Stop QR port 3005
echo  F. Stop all local app ports
echo.
echo  S. Docker status
echo  L. Logs Docker DB + Redis
echo  X. Stop Docker DB + Redis
echo  Q. Quit
echo.
set /p "choice=Choose: " || exit /b 0

if /i "%choice%"=="1" call :docker_up & pause & goto menu
if /i "%choice%"=="2" call :migrate & pause & goto menu
if /i "%choice%"=="3" call :start_api & goto menu
if /i "%choice%"=="4" call :start_web & goto menu
if /i "%choice%"=="5" call :start_ticket & goto menu
if /i "%choice%"=="6" call :start_rental & goto menu
if /i "%choice%"=="7" call :start_qr & goto menu
if /i "%choice%"=="8" call :start_api & call :start_web & goto menu
if /i "%choice%"=="9" call :start_ticket & call :start_rental & call :start_qr & call :start_api & call :start_web & goto menu
if /i "%choice%"=="A" call :stop_port 4000 & pause & goto menu
if /i "%choice%"=="B" call :stop_port 3000 & pause & goto menu
if /i "%choice%"=="C" call :stop_port 3003 & pause & goto menu
if /i "%choice%"=="D" call :stop_port 3004 & pause & goto menu
if /i "%choice%"=="E" call :stop_port 3005 & pause & goto menu
if /i "%choice%"=="F" call :stop_all_local & pause & goto menu
if /i "%choice%"=="S" docker compose ps postgres redis & pause & goto menu
if /i "%choice%"=="L" docker compose logs -f postgres redis & goto menu
if /i "%choice%"=="X" docker compose stop postgres redis & pause & goto menu
if /i "%choice%"=="Q" exit /b 0

goto menu

:ensure_docker
docker info >nul 2>nul
if not errorlevel 1 exit /b 0

echo Docker Desktop is not ready. Trying to open Docker Desktop...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
  start "" "%LocalAppData%\Docker\Docker Desktop.exe"
) else (
  echo Docker Desktop executable was not found. Please open Docker Desktop manually.
)

echo Waiting for Docker daemon...
for /l %%i in (1,1,60) do (
  docker info >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /t 2 /nobreak >nul
)

echo Docker is still not ready. Open Docker Desktop, then choose option 1.
exit /b 1

:docker_up
call :ensure_docker
echo Starting postgres + redis in Docker...
docker compose up -d postgres redis
exit /b 0

:migrate
call :docker_up
echo Generating Prisma client...
npm run db:generate
echo Running Prisma migrate dev against localhost Postgres...
npm run db:migrate
exit /b 0

:start_api
call :docker_up
start "SmartQR API :4000" cmd /k "cd /d %~dp0 && set DATABASE_URL=%DATABASE_URL%&& set REDIS_URL=%REDIS_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set API_KEY_PEPPER=%API_KEY_PEPPER%&& set API_SECRET_ENCRYPTION_KEY=%API_SECRET_ENCRYPTION_KEY%&& set PAYMENT_LINK_SECRET=%PAYMENT_LINK_SECRET%&& set PAYOS_WEBHOOK_SECRET=%PAYOS_WEBHOOK_SECRET%&& set WEB_ORIGIN=%WEB_ORIGIN%&& set PAYMENT_DEMO_MODE=%PAYMENT_DEMO_MODE%&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& set TICKET_SERVICE_URL=http://localhost:3003&& set RENTAL_SERVICE_URL=http://localhost:3004&& set QR_SERVICE_URL=http://localhost:3005&& npm run dev -w @smartqr/api"
exit /b 0

:start_web
call :docker_up
start "SmartQR Web :3000" cmd /k "cd /d %~dp0 && set NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL%&& set NEXT_PUBLIC_SOCKET_URL=%NEXT_PUBLIC_SOCKET_URL%&& npm run dev -w @smartqr/web"
exit /b 0

:start_ticket
call :docker_up
start "SmartQR Ticket :3003" cmd /k "cd /d %~dp0 && set DATABASE_URL=%DATABASE_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set PORT=3003&& npm run dev -w @smartqr/ticket-service"
exit /b 0

:start_rental
call :docker_up
start "SmartQR Rental :3004" cmd /k "cd /d %~dp0 && set DATABASE_URL=%DATABASE_URL%&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& set PORT=3004&& npm run dev -w @smartqr/rental-service"
exit /b 0

:start_qr
call :docker_up
start "SmartQR QR :3005" cmd /k "cd /d %~dp0 && set DATABASE_URL=%DATABASE_URL%&& set REDIS_URL=%REDIS_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set API_KEY_PEPPER=%API_KEY_PEPPER%&& set API_SECRET_ENCRYPTION_KEY=%API_SECRET_ENCRYPTION_KEY%&& set PAYMENT_LINK_SECRET=%PAYMENT_LINK_SECRET%&& set PAYOS_WEBHOOK_SECRET=%PAYOS_WEBHOOK_SECRET%&& set WEB_ORIGIN=%WEB_ORIGIN%&& set RENTAL_SERVICE_URL=http://localhost:3004&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& set API_PUBLIC_URL=%API_PUBLIC_URL%&& set PORT=3005&& npm run dev -w @smartqr/qr-service"
exit /b 0

:stop_port
set "port=%~1"
echo Stopping processes listening on port %port%...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%port% .*LISTENING"') do (
  taskkill /F /PID %%p
)
exit /b 0

:stop_all_local
call :stop_port 4000
call :stop_port 3000
call :stop_port 3003
call :stop_port 3004
call :stop_port 3005
exit /b 0
