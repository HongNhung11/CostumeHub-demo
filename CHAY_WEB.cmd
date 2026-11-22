@echo off
rem CostumeHub: bam dup de chay. Lan dau tu chuyen du lieu cua ban cu (khong xoa ban goc).
setlocal
cd /d "%~dp0"
set "NEW=costumehub"
set "OLD="

if not exist ".env" copy ".env.example" ".env" >nul

docker info >nul 2>&1
if errorlevel 1 goto nodocker

rem Da co du lieu cua ban moi thi chay luon
docker volume inspect %NEW%_pgdata >nul 2>&1
if errorlevel 1 goto findold
docker run --rm -v %NEW%_pgdata:/d:ro postgres:16-alpine test -f /d/PG_VERSION >nul 2>&1
if not errorlevel 1 goto start

:findold
rem 1) container cua ban cu cho biet dung volume nao
for /f "tokens=1" %%v in ('docker inspect costumehub_db --format "{{range .Mounts}}{{.Name}} {{end}}" 2^>nul') do set "OLD=%%v"
if not defined OLD goto byname
set "OLD=%OLD:_pgdata=%"
if "%OLD%"=="%NEW%" goto byname
docker volume inspect %OLD%_pgdata >nul 2>&1
if not errorlevel 1 goto migrate

:byname
rem 2) da xoa container: tim theo ten thu muc hay gap
set "OLD="
for %%p in (costumehub-demo costumehub-demo-main) do docker volume inspect %%p_pgdata >nul 2>&1 && set "OLD=%%p"
if not defined OLD goto start

:migrate
echo Tim thay du lieu ban cu: %OLD%. Dang chuyen sang ban moi, ban goc van giu nguyen...
docker stop costumehub_web costumehub_backup costumehub_db >nul 2>&1
for %%n in (uploads private_uploads pgdata) do call :copy %%n || goto failed
docker rm -f costumehub_web costumehub_backup costumehub_db >nul 2>&1
echo Chuyen du lieu xong.

:start
echo Dang chay CostumeHub, lan dau mat vai phut...
docker compose up -d --build --wait --wait-timeout 300
if errorlevel 1 goto failed
set "ADDR="
for /f "delims=" %%a in ('docker compose port web 3000') do set "ADDR=%%a"
set "ADDR=%ADDR:0.0.0.0=localhost%"
set "ADDR=%ADDR:127.0.0.1=localhost%"
echo.
echo XONG: http://%ADDR%
echo Tai khoan thu: khachhang / 123456 - nhanvien / 123456 - admin / admin123
if defined CH_NO_PAUSE exit /b 0
start "" "http://%ADDR%"
pause
exit /b 0

:copy
docker volume inspect %OLD%_%1 >nul 2>&1
if errorlevel 1 exit /b 0
docker volume create --label com.docker.compose.project=%NEW% --label com.docker.compose.volume=%1 %NEW%_%1 >nul
docker run --rm -v %OLD%_%1:/from:ro -v %NEW%_%1:/to postgres:16-alpine cp -a /from/. /to/
exit /b %errorlevel%

:nodocker
echo CHUA CHAY DUOC: hay cai / mo Docker Desktop, doi no bao dang chay roi bam dup lai file nay.
if not defined CH_NO_PAUSE pause
exit /b 1

:failed
echo CO LOI: doc dong bao loi o tren, hoac muc "Loi hay gap" trong HUONG_DAN_NHOM.md
if not defined CH_NO_PAUSE pause
exit /b 1
