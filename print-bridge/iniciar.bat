@echo off
rem Sobe a ponte de impressao. Coloque um atalho deste arquivo na pasta de
rem inicializacao do Windows (Win+R -> shell:startup) pra ela subir sozinha
rem toda vez que o PC ligar.
rem
rem Sem acento de proposito: o Prompt de Comando usa outra tabela de
rem caracteres e mostraria simbolo trocado.
cd /d "%~dp0"
call npm install --omit=dev
npm start
pause
