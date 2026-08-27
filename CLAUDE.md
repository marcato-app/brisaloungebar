# Brisa Lounge Bar

Antes de qualquer coisa, leia **PDV_STATUS.md** — tem o estado real do
projeto (o que está pronto e testado, o que falta, migrações do banco
pendentes de conferir). Não repita trabalho que já está marcado como
pronto lá.

## Stack

Cloudflare Worker (`src/index.js`) + D1 (`brisaloungebar-db`). Sem build
step — os arquivos `.html` na raiz (`index.html`, `bio.html`, `admin.html`,
`pdv.html`) são servidos como estão pelos assets do Worker.

## Branch

Trabalhe em `claude/menu-website-store-8bch7k`. Não crie branch nova sem
o usuário pedir.

## Banco de dados

Não há deploy automático de schema. Toda mudança de banco vira um arquivo
numerado em `migrations/` (ex: `006_algo.sql`), e o SQL é entregue pro
usuário rodar manualmente no D1 Console do Cloudflare — ele não tem acesso
de terminal ao banco de produção. Depois de qualquer migração nova,
atualize o checklist em `PDV_STATUS.md`.

## Testes

Sempre existentes antes de considerar algo pronto — rodam contra SQLite
real (`node:sqlite`), não mock:

```bash
node test/pdv.test.mjs        # rotas do PDV
node test/routing.test.mjs    # roteamento worker/assets
cd print-bridge && npm test   # ponte de impressão
```

Ao terminar uma fatia nova, atualize `PDV_STATUS.md` (o que ficou pronto,
contagem de testes) antes de fazer commit.
