@echo off
rem Lanceur de Kimi — double-clique sur ce fichier pour reveiller ta mascotte.
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
if not exist "node_modules\electron" (
  echo Premiere utilisation : installation des dependances...
  call npm install
)
start "" "node_modules\electron\dist\electron.exe" .
