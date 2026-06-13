@echo off
chcp 65001 > nul
title Consultio Med - Inicializador

echo ===================================================
echo   🩺   CONSULTIO MED - INICIALIZADOR DE PLATAFORMA
echo ===================================================
echo.

:: Verificar se o Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] O Node.js não foi encontrado no seu computador!
    echo Por favor, instale o Node.js em https://nodejs.org/ antes de continuar.
    echo.
    pause
    exit /b
)

:: Verificar se as dependências já foram instaladas
if not exist "node_modules\" (
    echo [INFO] Instalando dependências do projeto (isso pode levar alguns minutos)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar as dependências. Verifique sua conexão com a internet.
        pause
        exit /b
    )
    echo [SUCESSO] Dependências instaladas com sucesso!
    echo.
)

:: Verificar se o .env.local foi configurado com chave Gemini
set has_key=0
if exist ".env.local" (
    findstr /C:"GEMINI_API_KEY=\"\"" .env.local >nul
    if %errorlevel% neq 0 (
        findstr /C:"GEMINI_API_KEY=" .env.local >nul
        if %errorlevel% equ 0 set has_key=1
    )
)

if %has_key% equ 0 (
    echo ---------------------------------------------------
    echo   ⚠️  ATENÇÃO: CHAVE GEMINI NÃO CONFIGURADA!
    echo ---------------------------------------------------
    echo O assistente inteligente de IA precisa da GEMINI_API_KEY.
    echo Por favor, abra o arquivo ".env.local" e insira a chave obtida em:
    echo https://aistudio.google.com/
    echo ---------------------------------------------------
    echo.
    set /p "proceed=Deseja iniciar o sistema assim mesmo? (S/N): "
    if /i "%proceed%" neq "s" exit /b
)

echo [INFO] Iniciando o servidor de desenvolvimento do Consultio Med...
echo O navegador sera aberto automaticamente em http://localhost:5173
echo.

:: Abrir o navegador automaticamente após 3 segundos
start /b cmd /c "timeout /t 3 >nul && start http://localhost:5173"

:: Executar a aplicação
call npm run dev

pause
