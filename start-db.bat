@echo off
title EduCore - Base de Datos MySQL (Puerto 3307)
echo ===================================================
echo   Iniciando MariaDB / MySQL Portable en 127.0.0.1:3307
echo   Base de datos: educore
echo   Presiona Ctrl+C para detener la base de datos
echo ===================================================
"%LOCALAPPDATA%\Programs\mariadb-portable\bin\mysqld.exe" --defaults-file="%LOCALAPPDATA%\Programs\mariadb-portable\data\my.ini" --console
