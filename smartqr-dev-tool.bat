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

if /i "%~1"=="db" call :docker_up & exit /b %errorlevel%
if /i "%~1"=="frontend" call :start_web & exit /b %errorlevel%
if /i "%~1"=="backend" call :start_backend & exit /b %errorlevel%
if /i "%~1"=="all" call :start_all & exit /b %errorlevel%
if /i "%~1"=="ps" call :list_processes & exit /b %errorlevel%
if /i "%~1"=="stop" call :stop_port "%~2" & exit /b %errorlevel%
if /i "%~1"=="stop-all" call :stop_all_ports & exit /b %errorlevel%
if /i "%~1"=="logs" docker compose logs -f postgres redis & exit /b %errorlevel%
if /i "%~1"=="h" call :help & exit /b 0
if /i "%~1"=="help" call :help & exit /b 0
if /i "%~1"=="menu" goto menu
if "%~1"=="" call :start_all & exit /b %errorlevel%

:menu
cls
echo ============================================================
echo  SmartQR Dev Tool
echo ============================================================
echo.
echo  1. Start DB only                  Docker postgres + redis
echo  2. Start frontend                 Web :3000
echo  3. Start backend                  API/services :4000/:3003/:3004/:3005
echo  4. Start full local app           DB + backend + frontend
echo  5. Run Prisma generate + migrate
echo.
echo  6. Show SmartQR processes/ports
echo  7. Stop a custom port
echo  8. Stop app ports                 3000, 3003, 3004, 3005, 4000
echo  9. Stop Docker DB + Redis
echo.
echo  L. Docker DB logs
echo  S. Docker status
echo  H. CLI help
echo  Q. Quit
echo.
set /p "choice=Choose: " || exit /b 0

if /i "%choice%"=="1" call :docker_up & pause & goto menu
if /i "%choice%"=="2" call :start_web & pause & goto menu
if /i "%choice%"=="3" call :start_backend & pause & goto menu
if /i "%choice%"=="4" call :start_all & pause & goto menu
if /i "%choice%"=="5" call :migrate & pause & goto menu
if /i "%choice%"=="6" call :list_processes & pause & goto menu
if /i "%choice%"=="7" call :ask_stop_port & pause & goto menu
if /i "%choice%"=="8" call :stop_all_ports & pause & goto menu
if /i "%choice%"=="9" docker compose stop postgres redis & pause & goto menu
if /i "%choice%"=="L" docker compose logs -f postgres redis & goto menu
if /i "%choice%"=="S" docker compose ps postgres redis & pause & goto menu
if /i "%choice%"=="H" call :help & pause & goto menu
if /i "%choice%"=="Q" exit /b 0

goto menu

:help
echo.
echo CLI usage:
echo   smartqr-dev-tool.bat db
echo   smartqr-dev-tool.bat frontend
echo   smartqr-dev-tool.bat backend
echo   smartqr-dev-tool.bat all
echo   smartqr-dev-tool.bat menu
echo   smartqr-dev-tool.bat ps
echo   smartqr-dev-tool.bat stop 3000
echo   smartqr-dev-tool.bat stop-all
echo   smartqr-dev-tool.bat logs
echo.
exit /b 0

:ensure_docker
docker info >nul 2>nul
if not errorlevel 1 exit /b 0

echo Docker Desktop is not ready. Trying to open Docker Desktop...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe" (
  start "" "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe"
) else if exist "%LocalAppData%\Programs\DockerDesktop\frontend\Docker Desktop.exe" (
  start "" "%LocalAppData%\Programs\DockerDesktop\frontend\Docker Desktop.exe"
) else (
  echo Docker Desktop executable was not found. Please open Docker Desktop manually.
)

echo Waiting for Docker daemon...
for /l %%i in (1,1,90) do (
  docker info >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /t 2 /nobreak >nul
)

echo Docker is still not ready.
exit /b 1

:docker_up
call :ensure_docker
if errorlevel 1 exit /b 1
echo Starting postgres + redis with volumes...
docker compose up -d postgres redis
exit /b %errorlevel%

:migrate
call :docker_up
if errorlevel 1 exit /b 1
echo Generating Prisma client...
npm run db:generate
if errorlevel 1 exit /b 1
echo Running Prisma migrate dev...
npm run db:migrate
exit /b %errorlevel%

:start_backend
call :start_ticket
call :start_rental
call :start_qr
call :start_api
exit /b 0

:start_all
call :docker_up
call :start_backend
call :start_web
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

:ask_stop_port
set "port="
set /p "port=Port to stop: "
call :stop_port "%port%"
exit /b %errorlevel%

:stop_port
set "port=%~1"
if "%port%"=="" (
  echo Missing port. Example: smartqr-dev-tool.bat stop 3000
  exit /b 1
)
echo Stopping processes listening on port %port%...
set "found="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%port% .*LISTENING"') do (
  set "found=1"
  taskkill /F /PID %%p
)
if not defined found echo No process is listening on port %port%.
exit /b 0

:stop_all_ports
call :stop_port 3000
call :stop_port 3003
call :stop_port 3004
call :stop_port 3005
call :stop_port 4000
exit /b 0

:list_processes
echo.
echo Docker services:
docker compose ps postgres redis
echo.
echo Local app ports:
for %%p in (3000 3003 3004 3005 4000 5432 6379) do call :show_port %%p
echo.
exit /b 0

:show_port
set "port=%~1"
set "shown="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%port% .*LISTENING"') do (
  set "shown=1"
  for /f "tokens=1,*" %%a in ('tasklist /FI "PID eq %%p" /FO CSV /NH') do echo Port %port%  PID %%p  %%~a
)
if not defined shown echo Port %port%  free
exit /b 0
