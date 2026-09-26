@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "DATABASE_URL=postgresql://smartqr:1@localhost:5432/smartqr?schema=public"
set "REDIS_URL=redis://localhost:6379"
set "JWT_SECRET=smartqr-local-dev-secret-change-in-production"
set "QR_JWT_SECRET=smartqr-local-dev-secret-change-in-production"
set "API_KEY_PEPPER=local-development-api-key-pepper"
set "API_SECRET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
set "PAYMENT_LINK_SECRET=payment-link-dev-secret"
set "PAYOS_WEBHOOK_SECRET=payos-demo-dev-secret"
set "WEB_ORIGIN=http://localhost:3000"
set "PAYMENT_DEMO_MODE=true"
set "INTERNAL_SERVICE_TOKEN=local-internal-service-token"
set "NEXT_PUBLIC_API_URL=http://localhost:4000"
set "NEXT_PUBLIC_SOCKET_URL=http://localhost:4000"
set "API_PUBLIC_URL=http://localhost:4000"
set "TICKET_SERVICE_URL=http://localhost:3003"
set "RENTAL_SERVICE_URL=http://localhost:3004"
set "QR_SERVICE_URL=http://localhost:3005"

if /i "%~1"=="setup" call :setup & exit /b %errorlevel%
if /i "%~1"=="start" call :start_all & exit /b %errorlevel%
if /i "%~1"=="backend" call :start_backend & exit /b %errorlevel%
if /i "%~1"=="web" call :start_web & exit /b %errorlevel%
if /i "%~1"=="check" call :check_dependencies & exit /b %errorlevel%
if /i "%~1"=="stop" call :stop_all_ports & exit /b %errorlevel%
if /i "%~1"=="help" call :help & exit /b 0
if /i "%~1"=="h" call :help & exit /b 0
if "%~1"=="" call :setup_and_start & exit /b %errorlevel%

call :help
exit /b 1

:help
echo.
echo SmartQR no-Docker runner
echo.
echo Yeu cau: PostgreSQL va Redis da chay ben ngoai Docker.
echo Mac dinh:
echo   PostgreSQL: postgresql://smartqr:1@localhost:5432/smartqr?schema=public
echo   Redis:      redis://localhost:6379
echo.
echo Lenh:
echo   smartqr-no-docker-setup.bat          setup + start all
echo   smartqr-no-docker-setup.bat setup    npm install + prisma migrate + seed
echo   smartqr-no-docker-setup.bat start    start web + API + services
echo   smartqr-no-docker-setup.bat backend  start API/services only
echo   smartqr-no-docker-setup.bat web      start web only
echo   smartqr-no-docker-setup.bat check    check Node/npm and local ports
echo   smartqr-no-docker-setup.bat stop     stop ports 3000/3003/3004/3005/4000
echo.
exit /b 0

:setup_and_start
call :setup
if errorlevel 1 exit /b 1
call :start_all
exit /b %errorlevel%

:setup
call :check_dependencies
if errorlevel 1 exit /b 1

call :write_env_files
if errorlevel 1 exit /b 1

echo.
echo Installing npm dependencies...
npm install
if errorlevel 1 exit /b 1

echo.
echo Generating Prisma client...
npm run db:generate
if errorlevel 1 exit /b 1

echo.
echo Running Prisma migrations...
npm run db:migrate
if errorlevel 1 exit /b 1

echo.
echo Seeding database...
npm run db:seed
if errorlevel 1 exit /b 1

echo.
echo Setup done.
exit /b 0

:check_dependencies
echo.
echo Checking Node.js...
node -v
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20+ first.
  exit /b 1
)

echo.
echo Checking npm...
npm -v
if errorlevel 1 (
  echo npm was not found.
  exit /b 1
)

echo.
echo Checking PostgreSQL port 5432...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Test-NetConnection localhost -Port 5432).TcpTestSucceeded) { exit 0 } else { exit 1 }" >nul
if errorlevel 1 (
  echo PostgreSQL is not reachable at localhost:5432.
  echo Start PostgreSQL first and create database/user: smartqr / 1 / smartqr.
  exit /b 1
)

echo Checking Redis port 6379...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Test-NetConnection localhost -Port 6379).TcpTestSucceeded) { exit 0 } else { exit 1 }" >nul
if errorlevel 1 (
  echo Redis is not reachable at localhost:6379.
  echo Start Redis first.
  exit /b 1
)

echo Dependencies look OK.
exit /b 0

:write_env_files
echo.
echo Writing local .env files...

> apps\api\.env (
  echo DATABASE_URL="%DATABASE_URL%"
  echo REDIS_URL="%REDIS_URL%"
  echo JWT_SECRET="%JWT_SECRET%"
  echo QR_JWT_SECRET="%QR_JWT_SECRET%"
  echo API_KEY_PEPPER="%API_KEY_PEPPER%"
  echo API_SECRET_ENCRYPTION_KEY="%API_SECRET_ENCRYPTION_KEY%"
  echo PAYMENT_LINK_SECRET="%PAYMENT_LINK_SECRET%"
  echo PAYOS_WEBHOOK_SECRET="%PAYOS_WEBHOOK_SECRET%"
  echo WEB_ORIGIN="%WEB_ORIGIN%"
  echo PAYMENT_DEMO_MODE="%PAYMENT_DEMO_MODE%"
  echo INTERNAL_SERVICE_TOKEN="%INTERNAL_SERVICE_TOKEN%"
  echo TICKET_SERVICE_URL="%TICKET_SERVICE_URL%"
  echo RENTAL_SERVICE_URL="%RENTAL_SERVICE_URL%"
  echo QR_SERVICE_URL="%QR_SERVICE_URL%"
  echo API_PUBLIC_URL="%API_PUBLIC_URL%"
)

> apps\web\.env (
  echo NEXT_PUBLIC_API_URL="%NEXT_PUBLIC_API_URL%"
  echo NEXT_PUBLIC_SOCKET_URL="%NEXT_PUBLIC_SOCKET_URL%"
)

> apps\ticket-service\.env (
  echo PORT=3003
  echo NODE_ENV=development
  echo DATABASE_URL="%DATABASE_URL%"
  echo REDIS_URL="%REDIS_URL%"
  echo JWT_SECRET="%JWT_SECRET%"
  echo QR_JWT_SECRET="%QR_JWT_SECRET%"
  echo API_KEY_PEPPER="%API_KEY_PEPPER%"
)

> apps\rental-service\.env (
  echo PORT=3004
  echo DATABASE_URL="%DATABASE_URL%"
  echo JWT_SECRET="%JWT_SECRET%"
  echo PAYMENT_LINK_SECRET="%PAYMENT_LINK_SECRET%"
  echo INTERNAL_SERVICE_TOKEN="%INTERNAL_SERVICE_TOKEN%"
)

> apps\qr-service\.env (
  echo PORT=3005
  echo DATABASE_URL="%DATABASE_URL%"
  echo REDIS_URL="%REDIS_URL%"
  echo JWT_SECRET="%JWT_SECRET%"
  echo QR_JWT_SECRET="%QR_JWT_SECRET%"
  echo API_KEY_PEPPER="%API_KEY_PEPPER%"
  echo API_SECRET_ENCRYPTION_KEY="%API_SECRET_ENCRYPTION_KEY%"
  echo PAYMENT_LINK_SECRET="%PAYMENT_LINK_SECRET%"
  echo PAYOS_WEBHOOK_SECRET="%PAYOS_WEBHOOK_SECRET%"
  echo WEB_ORIGIN="%WEB_ORIGIN%"
  echo RENTAL_SERVICE_URL="%RENTAL_SERVICE_URL%"
  echo INTERNAL_SERVICE_TOKEN="%INTERNAL_SERVICE_TOKEN%"
  echo API_PUBLIC_URL="%API_PUBLIC_URL%"
)

echo .env files written.
exit /b 0

:start_all
call :start_backend
call :start_web
echo.
echo SmartQR is starting.
echo Web: http://localhost:3000
echo API: http://localhost:4000
exit /b 0

:start_backend
call :start_ticket
call :start_rental
call :start_qr
call :start_api
exit /b 0

:start_api
start "SmartQR API :4000" cmd /k "cd /d %~dp0 && set DATABASE_URL=%DATABASE_URL%&& set REDIS_URL=%REDIS_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set API_KEY_PEPPER=%API_KEY_PEPPER%&& set API_SECRET_ENCRYPTION_KEY=%API_SECRET_ENCRYPTION_KEY%&& set PAYMENT_LINK_SECRET=%PAYMENT_LINK_SECRET%&& set PAYOS_WEBHOOK_SECRET=%PAYOS_WEBHOOK_SECRET%&& set WEB_ORIGIN=%WEB_ORIGIN%&& set PAYMENT_DEMO_MODE=%PAYMENT_DEMO_MODE%&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& set TICKET_SERVICE_URL=%TICKET_SERVICE_URL%&& set RENTAL_SERVICE_URL=%RENTAL_SERVICE_URL%&& set QR_SERVICE_URL=%QR_SERVICE_URL%&& set API_PUBLIC_URL=%API_PUBLIC_URL%&& npm run dev -w @smartqr/api"
exit /b 0

:start_web
start "SmartQR Web :3000" cmd /k "cd /d %~dp0 && set NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL%&& set NEXT_PUBLIC_SOCKET_URL=%NEXT_PUBLIC_SOCKET_URL%&& npm run dev -w @smartqr/web"
exit /b 0

:start_ticket
start "SmartQR Ticket :3003" cmd /k "cd /d %~dp0 && set PORT=3003&& set DATABASE_URL=%DATABASE_URL%&& set REDIS_URL=%REDIS_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set API_KEY_PEPPER=%API_KEY_PEPPER%&& npm run dev -w @smartqr/ticket-service"
exit /b 0

:start_rental
start "SmartQR Rental :3004" cmd /k "cd /d %~dp0 && set PORT=3004&& set DATABASE_URL=%DATABASE_URL%&& set JWT_SECRET=%JWT_SECRET%&& set PAYMENT_LINK_SECRET=%PAYMENT_LINK_SECRET%&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& npm run dev -w @smartqr/rental-service"
exit /b 0

:start_qr
start "SmartQR QR :3005" cmd /k "cd /d %~dp0 && set PORT=3005&& set DATABASE_URL=%DATABASE_URL%&& set REDIS_URL=%REDIS_URL%&& set JWT_SECRET=%JWT_SECRET%&& set QR_JWT_SECRET=%QR_JWT_SECRET%&& set API_KEY_PEPPER=%API_KEY_PEPPER%&& set API_SECRET_ENCRYPTION_KEY=%API_SECRET_ENCRYPTION_KEY%&& set PAYMENT_LINK_SECRET=%PAYMENT_LINK_SECRET%&& set PAYOS_WEBHOOK_SECRET=%PAYOS_WEBHOOK_SECRET%&& set WEB_ORIGIN=%WEB_ORIGIN%&& set RENTAL_SERVICE_URL=%RENTAL_SERVICE_URL%&& set INTERNAL_SERVICE_TOKEN=%INTERNAL_SERVICE_TOKEN%&& set API_PUBLIC_URL=%API_PUBLIC_URL%&& npm run dev -w @smartqr/qr-service"
exit /b 0

:stop_all_ports
call :stop_port 3000
call :stop_port 3003
call :stop_port 3004
call :stop_port 3005
call :stop_port 4000
exit /b 0

:stop_port
set "port=%~1"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%port% .*LISTENING"') do taskkill /F /PID %%p
exit /b 0
