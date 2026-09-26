@echo off
rem Instala o revisa las herramientas de Church Projector (Windows).
rem Doble clic = instalar lo que falte. Tambien acepta los mismos argumentos
rem que instalar_herramientas.py, por ejemplo:  herramientas.cmd --estado
setlocal
set "AQUI=%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%AQUI%instalar_herramientas.py" %*
  goto fin
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%AQUI%instalar_herramientas.py" %*
  goto fin
)
echo.
echo No se encontro Python 3.
echo Instalalo desde https://www.python.org/downloads/ (marca "Add python.exe to PATH")
echo y volve a ejecutar este archivo.

:fin
echo.
if "%~1"=="" pause
endlocal
