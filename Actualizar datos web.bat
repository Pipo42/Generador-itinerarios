@echo off
rem Regenera data\rutas.json desde el Excel (que solo vive en este PC) y publica la web.
cd /d "%~dp0"
python tools\build_data.py "EXCEL MESTRE LLULL.xlsx" data\rutas.json || goto :error
git add data\rutas.json
git commit -m "Actualizar datos de rutas" || echo (sin cambios en los datos)
git push || goto :error
echo.
echo Listo: la web se actualiza sola en uno o dos minutos.
pause
exit /b 0
:error
echo.
echo Algo ha fallado. Revisa el mensaje de arriba.
pause
exit /b 1
