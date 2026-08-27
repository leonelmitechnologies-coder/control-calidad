@echo off
cd /d "C:\Proyectos Claude\ControlCalidad"
start "CC-Express" cmd /k "node_modules\.bin\tsx.cmd" server/index.ts
start "CC-Vite" cmd /k "node_modules\.bin\vite.cmd"
echo Servers starting...
