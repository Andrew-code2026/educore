@echo off
set MYSQLD="%LOCALAPPDATA%\Programs\mariadb-portable\bin\mysqld.exe"
set MYINI="%LOCALAPPDATA%\Programs\mariadb-portable\data\my.ini"

if not exist %MYSQLD% (
    echo [ERROR] No se encontro MariaDB Portable en %MYSQLD%
    pause
    exit /b 1
)

echo [EduCore] Iniciando MariaDB Portable en puerto 3307...
start "" /b %MYSQLD% --defaults-file=%MYINI% --console
echo [EduCore] MariaDB iniciada correctamente en segundo plano en puerto 3307.
