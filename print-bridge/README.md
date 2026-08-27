# Ponte de impressão — Brisa PDV

Este programinha roda no PC ligado nas duas impressoras Elgin i9 (uma pro
Bar/Cozinha, outra pra Tabacaria). A cada poucos segundos ele pergunta pro
sistema "tem pedido novo pra imprimir?", manda pra impressora certa, e avisa
o sistema que já imprimiu. Fica ligado o tempo todo, sem precisar mexer.

## O que você precisa antes de começar

- O PC (Windows) já com as duas Elgin i9 ligadas nele por cabo USB.
- Esse PC ligado na internet, de preferência por cabo de rede.
- Um funcionário cadastrado no PDV só pra isso — vá em **Funcionários** no
  PDV (`brisaloungebar.com.br/pdv`) e cadastre um usuário, por exemplo
  `impressora`, com uma senha seguinda qualquer, cargo "Garçom" mesmo (o
  cargo aqui não importa).

## Passo 1 — Compartilhar as duas impressoras no Windows

Isso é feito uma vez só:

1. Abra **Configurações → Bluetooth e dispositivos → Impressoras e
   scanners** (ou "Painel de Controle → Dispositivos e Impressoras" no
   Windows mais antigo).
2. Ache a impressora do Bar/Cozinha na lista, clique nela, entre em
   **Propriedades da impressora**.
3. Na aba **Compartilhamento**, marque "Compartilhar esta impressora" e dê
   um nome sem espaço, por exemplo `ELGIN_BAR`. Salve.
4. Repita pra impressora da Tabacaria, com o nome `ELGIN_TABACARIA`.

Se você usar nomes diferentes desses, anota — vai precisar deles no passo 3.

## Passo 2 — Instalar o Node.js

Baixe e instale a versão **LTS** em [nodejs.org](https://nodejs.org) — é
"Avançar, Avançar, Concluir", igual instalar qualquer programa.

## Passo 3 — Configurar

1. Copie a pasta inteira `print-bridge` pra dentro do PC (por exemplo, pra
   `C:\brisa-print-bridge`).
2. Dentro dela, faça uma cópia do arquivo `config.example.json` e renomeie
   pra `config.json`.
3. Abra `config.json` num bloco de notas e preencha:

```json
{
  "baseUrl": "https://brisaloungebar.com.br",
  "username": "impressora",
  "password": "a senha que você cadastrou no passo 0",
  "printers": {
    "bar_cozinha": "\\\\localhost\\ELGIN_BAR",
    "tabacaria": "\\\\localhost\\ELGIN_TABACARIA"
  },
  "pollIntervalMs": 4000,
  "stripAccents": false,
  "lineWidth": 32
}
```

Troque `username`/`password` pelos que você cadastrou, e os nomes depois de
`localhost\` pelos nomes que você deu ao compartilhar as impressoras (passo 1).

## Passo 4 — Rodar

Abra o **Prompt de Comando** (procure "cmd" no menu Iniciar), navegue até a
pasta e rode:

```
cd C:\brisa-print-bridge
npm install
npm start
```

Vai aparecer algo como:

```
[14:32:10] Ponte de impressão iniciada — https://brisaloungebar.com.br
[14:32:11] Login OK como impressora
```

Deixe essa janela aberta. A partir daqui, todo pedido lançado pelo garçom
que for do Bar/Cozinha ou da Tabacaria sai impresso sozinho.

Pra parar, feche a janela ou aperte Ctrl+C.

## Deixar ligado sempre (sem precisar abrir na mão todo dia)

Jeito mais simples: crie um atalho pro arquivo `iniciar.bat` (veja abaixo) e
coloque esse atalho na pasta de Inicialização do Windows
(`Win + R`, digite `shell:startup`, Enter — arraste o atalho pra lá). Assim,
toda vez que o PC ligar, a ponte já sobe sozinha.

Crie um arquivo `iniciar.bat` dentro da pasta `print-bridge` com este
conteúdo:

```bat
@echo off
cd /d %~dp0
npm start
```

## Se algo der errado

- **"Não consegui logar"** — usuário ou senha errados no `config.json`, ou o
  funcionário foi desativado no PDV. Confira em Funcionários.
- **"Falha ao imprimir em \\localhost\ELGIN_BAR"** — o nome do
  compartilhamento não bate com o que você configurou no Windows (passo 1),
  ou a impressora está desligada/sem papel/offline. O item fica na fila e
  imprime sozinho assim que resolver — não precisa reiniciar nada.
- **Acentos saindo errados no papel** (tipo "ç" virando outro símbolo) —
  abra `config.json` e troque `"stripAccents": false` para `"stripAccents":
  true`. Vai perder os acentos ("Caipirinha Cachaca" em vez de "Cachaça"),
  mas garante que imprime legível enquanto a gente ajusta o código certo
  pra essa impressora especificamente.
- Qualquer outro erro aparece escrito na janela do Prompt de Comando —
  manda print pra mim que eu vejo o que é.

## O que ainda não foi testado numa impressora de verdade

Tudo aqui foi construído e testado com testes automatizados (formatação do
ticket, comunicação com o sistema, o que acontece quando a impressão falha),
mas nunca rodou contra uma Elgin i9 física — isso eu não tenho como simular.
O ponto mais provável de precisar de um ajuste fino no primeiro teste real é
a página de código dos acentos (veja "Se algo der errado" acima). Testa
assim que puder e me chama com o resultado.
