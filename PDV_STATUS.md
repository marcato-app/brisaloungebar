# Status do PDV — Brisa Lounge Bar

Documento de continuidade. Serve pra retomar o projeto de qualquer lugar —
terminal, celular, outra sessão do Claude — sem precisar reconstruir o
contexto do zero. Atualiza este arquivo sempre que fechar uma fatia nova.

- **Repo:** `marcato-app/brisaloungebar`
- **Branch de trabalho:** `claude/menu-website-store-8bch7k`
- **Site:** `brisaloungebar.com.br` (cardápio público, `/bio`, `/admin`, `/pdv`)
- **Infra:** Cloudflare Worker (`src/index.js`) + D1 (`brisaloungebar-db`)
- **Roteiro original:** artefato "Roteiro PDV Brisa" publicado numa conversa
  anterior — este arquivo é o estado real de execução daquele roteiro.

Não tem senha nem token neste arquivo de propósito — ele é público no
histórico do git. Credenciais (login do PDV, senha de funcionário-ponte da
impressora) foram combinadas por fora, no chat.

---

## O que já está pronto e no ar

Cada item abaixo está testado (suíte automatizada rodando contra SQLite
real, não mock — `node test/pdv.test.mjs`) — exceto Configurações e o
mapa de mesas, que dependem de migrações ainda não confirmadas em
produção nesta sessão (ver seção de migrações). As migrações 003/004/005
(fila de impressão, autorização de cancelamento, status "pronto" do
kanban) rodaram em produção em 2026-08-27, confirmadas por query direta
no D1 — antes disso o schema não suportava essas três funcionalidades em
produção, apesar do checklist antigo dizer que sim. Estado atual: **106
checagens em `test/pdv.test.mjs`, 0 falhas**, mais 14 em
`test/admin.test.mjs` (reordenação do cardápio), `test/routing.test.mjs`
(roteamento) e 13 em `print-bridge/test/*`.

### Fundação
- Catálogo do cardápio migrado pra dentro do mesmo banco do PDV (nenhuma
  mudança pro `/cardapio` público).
- Login de funcionário separado do login do admin do cardápio (cookies e
  sessões diferentes, dá pra estar logado nos dois ao mesmo tempo).
- Cadastro de funcionários (só gerente cadastra/edita; desligar é desativar,
  nunca apagar — o nome continua no histórico de pedidos antigos).
- Cadastro de clientes (nome, telefone, nascimento) com busca.

### Admin do cardápio (`admin.html`)
- Botões ▲▼ em cada seção, grupo e item — troca de lugar com o vizinho
  mais próximo (`PUT /api/admin/{sections,groups,items}/:id/move`, troca
  atômica de `sort_order` via `env.DB.batch`). Reflete direto no
  `/api/menu` público, sem precisar mexer em código pra reorganizar o
  cardápio. Seções têm ordem global; grupos reordenam dentro da própria
  seção; itens dentro do próprio grupo. `test/admin.test.mjs`, 14 checagens.
- Geração de PDF do cardápio a partir do admin (pedido do usuário em
  2026-08-29): link "PDF do cardápio" no topo do admin abre `/impressao`,
  uma página que busca `/api/menu` ao vivo e monta o mesmo padrão visual
  do PDF feito por fora nesta sessão (capa, fotos por categoria,
  Cinzel/Jost, QR fixo em `assets/img/qr-cardapio.png`). Preço mudou ou
  categoria foi reordenada? É só abrir de novo, o PDF sai atualizado na
  hora.
  - Paginação por altura medida (porta client-side do gerador Python
    original): mede cada categoria fora da tela antes de decidir onde
    cortar página, categoria nunca é partida ao meio, troca de seção
    sempre abre página nova.
  - **O botão gera o arquivo PDF direto no navegador** (`html2canvas` +
    `jsPDF`, vendorizados em `assets/js/` — sem CDN, mesma lógica de
    "precisa abrir numa wifi de bar ruim" do resto do projeto), em vez de
    usar `window.print()`. Motivo: a primeira versão usava
    `window.print()`, e o usuário reportou (2026-08-29) borda branca,
    numeração de página e link no rodapé, e páginas em branco entre as
    páginas ao imprimir — tudo isso vem da caixa de diálogo de impressão
    de cada navegador/app (cada um decide sozinho margem e
    cabeçalho/rodapé; não tem CSS que desligue isso de fora). Gerando o
    PDF ele mesmo (retrato de cada página via `html2canvas`, colado num
    PDF via `jsPDF`, baixado direto), o resultado é sempre igual —
    zero-margem, sem rodapé, sem depender de configuração de quem clicou.
    Reverificado ponta a ponta com Playwright simulando o clique no botão
    e conferindo o PDF baixado: 8 páginas A4 consistentes, nenhuma
    categoria cortada, sem borda, sem rodapé.
  - Bug de medição encontrado e corrigido antes desta troca: a medição
    rodava com resultado bem menor que o tamanho real, por três motivos
    empilhados — tipografia presa dentro de `@media print` (não se
    aplica fora da hora de imprimir), `#measureRoot` fora do escopo de
    `.print-area` (perdendo a margem real entre itens) e `.cols.one`
    encolhendo pro conteúdo em vez de preencher 150mm por causa de
    `margin:auto` num item de flex column. Resultado visível: uma
    categoria cortada ao meio entre páginas. Ficou resolvido junto com a
    troca pro `html2canvas`/`jsPDF` — a página final não depende mais de
    `@media print` pra nada, então essas três regras hoje vivem em
    escopo incondicional o tempo todo.
  - Cartão de mesa com QR code (`/tmp/tent/` nesta sessão, arquivo solto
    ainda não versionado no repo): o fundo (foto do salão escurecida)
    estava com o filtro forte demais (brilho ~34%) e virava preto sólido
    ao imprimir de verdade, mesmo saindo quase certo na tela. Clareado
    (brilho ~85%, véu mais fraco) — a foto agora aparece de verdade tanto
    na tela quanto impressa.

### Comandas e pedido
- **Mapa de mesas** como tela principal de Comandas: grade de 12 mesas
  numeradas (`TABLE_COUNT` em `pdv.html`, muda sem migração), cada uma
  colorida por estado — verde (livre), dourado (ocupada, ainda tem item
  não entregue), vermelho pulsando (tudo entregue, só falta fechar a
  conta). Toca numa mesa livre e abre a comanda na hora, sem formulário
  (`POST /api/pdv/tabs` com `tableNumber`, label "Mesa N" nasce sozinho no
  servidor). Trava mesa já ocupada (400) pra não abrir duas comandas na
  mesma mesa. Atualiza sozinha a cada 6s, igual ao quadro de setor.
- **Balcão/Avulso**: seção abaixo do mapa pra comanda sem mesa (cliente no
  bar, viagem) — é o fluxo antigo de abrir comanda por nome, preservado.
- Garçom lança item buscando pelo nome — cada lançamento é uma linha nova
  (não edita a comanda inteira), então dois garçons na mesma comanda não se
  atropelam.
- Transferência de comanda (troca o titular, mantém o histórico e a mesa).

### Fechamento e pagamento
- Pagamento parcial **por item** (não por valor livre) — quem paga escolhe
  quais linhas está cobrindo; o valor é sempre calculado a partir dos itens
  escolhidos, nunca aceito do cliente.
- Um item já pago trava: não cancela, não muda quantidade.
- Fechar comanda exige saldo pendente zerado.
- Cupom em tela (logo, comanda, cliente, itens, pago/pendente, pagamentos)
  com folha de impressão própria — já funciona hoje em qualquer impressora
  comum ou salvando em PDF, independente da impressora térmica. Não é
  fiscal de propósito (sem NFC-e/SAT — isso é um projeto bem maior, exige
  módulo fiscal certificado). Cabeçalho puxa nome/CNPJ/endereço/telefone
  de "Configurações" (ver abaixo); nenhum desses três é obrigatório.
- Impressão do cupom é o caixa clicando em "Imprimir" (funciona com
  qualquer impressora instalada no Windows, térmica ou não, contanto que
  tenha driver) — decisão explícita do usuário em 2026-08-28 de não
  automatizar isso como a ponte de impressão faz pro Bar/Cozinha e
  Tabacaria, porque tem uma pessoa ali pra apertar o botão mesmo.

### Configurações do negócio
- Tela "Configurações" (só gerente): nome do negócio, CNPJ, endereço,
  telefone e rodapé do cupom — tudo opcional exceto o nome. Guardado em
  `venue_settings` (chave/valor, uma linha por campo).
- Cupom de venda lê esses dados a cada abertura (`GET /api/pdv/settings`,
  cacheado no front igual ao catálogo). Editar aqui muda o próximo cupom
  na hora, sem precisar de deploy.

### Cancelamento com controle
- Cancelar um item exige usuário e senha de um gerente, digitados na hora,
  sem precisar deslogar o garçom. Fica registrado qual gerente autorizou
  cada cancelamento (`tab_items.canceled_by`).

### Quadro de setor (Kanban)
- Bar/Cozinha e Tabacaria têm cada um seu quadro com 4 colunas: **Novo →
  Em produção → Aguardando garçom → Entregue**. O setor só empurra até
  "pronto"; "entregue" é o garçom confirmando que levou pra mesa.
- Tela cheia no computador (4 colunas lado a lado), 2×2 no tablet, deslize
  lateral no celular. Item atrasado (5min/10min) muda de cor sozinho.
- Atualiza sozinho a cada 6s, sem precisar recarregar a página.

### Estoque (Fase 4)
- Contagem manual, sem baixa automática por venda — decisão de propósito
  (ficha técnica por item desatualizaria sozinha a cada dose trocada sem
  avisar o sistema; ver `migrations/002_pdv.sql`, tabela `stock_items`, que
  já estava criada desde a fundação).
- Tela "Estoque": lista, cadastra e edita item (nome, unidade, quantidade,
  mínimo opcional). Item abaixo do mínimo ganha badge "Baixo" e conta no
  resumo do topo da tela.
- Só caixa e gerente veem a aba e mexem — escondida pro garçom.

### Financeiro (Fase 4)
- Não é contabilidade, é controle de vencimento (tabela `expenses`, também
  já criada desde a fundação).
- Tela "Financeiro": lança despesa (descrição, valor, vencimento, categoria
  opcional, recorrente), filtra por Em aberto / Pagas / Todas, marca como
  paga sem perder a data original do pagamento se salva de novo. Vencida
  fica destacada em vermelho, resumo do topo soma o que está em aberto.
- Mesma trava de acesso do Estoque: só caixa e gerente.

### Identidade visual do PDV — repaginação premium (2026-08-27)
- Base: ferramenta de operação, não site de marca — paleta fria, formas
  retangulares em vez de pílulas, números em monoespaçada (IBM Plex Mono).
  O cardápio público e o admin continuam com a identidade de marca — isso
  foi só na tela interna.
- Sistema de design elevado sobre essa base: tokens de sombra/elevação,
  ícones SVG desenhados à mão (sem CDN — o app precisa abrir numa wifi de
  bar ruim), gradientes sutis nos cards, glow no foco de input, vinheta no
  fundo da página. Testado e aprovado pelo usuário em 2026-08-27.
- Comandas, Clientes, Estoque, Financeiro, Funcionários, quadro de setor,
  login e modal de autorização — todos redesenhados na mesma passada,
  reaproveitando os mesmos componentes (`row-card`, `stat-strip`, avatar
  com iniciais coloridas, `sectionHead`).
- Depois do teste do usuário: Comandas virou o mapa de mesas (ver acima) —
  a lista simples de antes não passava a sensação de POS de verdade.

### Ponte de impressão (escrita, não testada com hardware real)
- `print-bridge/` — programa Node.js separado, roda no PC Windows ligado
  nas duas Elgin i9 (Bar/Cozinha e Tabacaria) por cabo USB.
- Confirmado com o Hércules: 1 PC, Windows, ligado por cabo de rede.
- Busca a fila de impressão de cada setor, monta o ticket em ESC/POS,
  manda pro Windows via impressora compartilhada (`copy /b`) — sem
  precisar de driver USB nenhum além do que a própria impressora usa.
- 35 testes cobrindo formatação do ticket, comunicação com a API, e o
  comportamento quando a impressão falha (não marca como impresso, tenta
  de novo sozinho). **Nunca rodou contra uma impressora física** — isso é
  o maior item pendente do projeto inteiro (ver abaixo).
- `print-bridge/README.md` tem o passo a passo de instalação pra quem
  nunca configurou nada assim.

---

## Migrações do banco (D1) — confira que todas rodaram

Rodadas manualmente no D1 Console (`brisaloungebar-db`), uma de cada vez,
nesta ordem. Este checklist tinha ficado marcado como tudo pronto por
sessões anteriores sem checagem real — uma query direta em 2026-08-27
mostrou que só o 002 tinha rodado de fato. As três que faltavam (003, 004,
005) rodaram e foram reconfirmadas por query no mesmo dia. Se esse tipo de
divergência aparecer nesse checklist de novo, desconfie e rode a query de
verificação antes de assumir qualquer coisa.

- [x] `migrations/002_pdv.sql` — funcionários, clientes, comandas, itens,
      pagamentos, despesas, estoque; `price_cents` e `sector` no catálogo.
      Confirmado rodado (2026-08-27).
- [x] `migrations/003_print_queue.sql` — `printed_at` em `tab_items`.
      Confirmado rodado (2026-08-27).
- [x] `migrations/004_cancel_authorization.sql` — `canceled_by` em `tab_items`.
      Confirmado rodado (2026-08-27).
- [x] `migrations/005_kanban_status.sql` — status `pronto` (recria a tabela,
      SQLite não deixa alterar um CHECK existente). Confirmado rodado
      (2026-08-27).
- [x] `migrations/006_table_number.sql` — `table_number` em `tabs`, pro
      mapa de mesas. Confirmado rodado (2026-08-27).
- [ ] `migrations/007_venue_settings.sql` — tabela `venue_settings`
      (nome/CNPJ/endereço/telefone/rodapé do cupom). **Pendente**
      (2026-08-28) — entregue pro usuário rodar. Sem ela, a tela
      Configurações e o cupom de venda quebram (500).

### Query de verificação (roda a qualquer hora, não muda nada)
```sql
SELECT 'tabelas do PDV (002)' AS checagem,
  CASE WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='employees')
       THEN 'ja rodou' ELSE 'FALTA rodar 002_pdv.sql' END AS status
UNION ALL
SELECT 'fila de impressao (003)',
  CASE WHEN (SELECT sql FROM sqlite_master WHERE name='tab_items') LIKE '%printed_at%'
       THEN 'ja rodou' ELSE 'FALTA rodar 003_print_queue.sql' END
UNION ALL
SELECT 'autorizacao de cancelamento (004)',
  CASE WHEN (SELECT sql FROM sqlite_master WHERE name='tab_items') LIKE '%canceled_by%'
       THEN 'ja rodou' ELSE 'FALTA rodar 004_cancel_authorization.sql' END
UNION ALL
SELECT 'status "pronto" no kanban (005)',
  CASE WHEN (SELECT sql FROM sqlite_master WHERE name='tab_items') LIKE '%pronto%'
       THEN 'ja rodou' ELSE 'FALTA rodar 005_kanban_status.sql' END
UNION ALL
SELECT 'mapa de mesas (006)',
  CASE WHEN (SELECT sql FROM sqlite_master WHERE name='tabs') LIKE '%table_number%'
       THEN 'ja rodou' ELSE 'FALTA rodar 006_table_number.sql' END
UNION ALL
SELECT 'configuracoes do negocio (007)',
  CASE WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='venue_settings')
       THEN 'ja rodou' ELSE 'FALTA rodar 007_venue_settings.sql' END;
```

Se alguma tela der erro estranho (ex: "status inválido" ao marcar item como
pronto), o primeiro lugar a checar é rodar essa query de novo.

---

## O que falta

Em ordem de prioridade real, não a ordem do roteiro original:

### 1. Rodar `migrations/007_venue_settings.sql` em produção
Sem ela, a tela Configurações e o cupom de venda quebram (500 — tabela
`venue_settings` não existe). Mesmo passo de sempre: D1 Console → cola →
executa → confere com a query de verificação lá em cima.

### 2. Testar o mapa de mesas e Configurações de verdade num navegador
Mapa de mesas: migração 006 confirmada rodada (2026-08-27), 13 checagens
em `test/pdv.test.mjs`. Configurações: precisa da 007 rodar primeiro, 7
checagens novas. Nenhum dos dois foi clicado num navegador real ainda
(extensão do Chrome não conectou em nenhuma sessão até agora). Testar:
mapa de mesas (abrir `/pdv`, Comandas, tocar numa mesa livre, lançar
item, marcar entregue no setor, ver a mesa ficar vermelha, pagar, ver
liberar) e Configurações (preencher CNPJ/endereço, salvar, abrir o cupom
de uma comanda e conferir que aparece). **`TABLE_COUNT` está fixo em 12**
em `pdv.html` — trocar é uma linha, sem migração.

### 3. Testar a ponte de impressão numa Elgin i9 de verdade — **bloqueado até ter o PC configurado**
Ponto mais provável de precisar ajuste no primeiro teste real: acentuação
(ç, ã) saindo errada — o `README.md` já documenta o plano B de uma linha
(`stripAccents: true` no `config.json`). Qualquer outro erro, a mensagem
aparece na janela do terminal — copia e cola aqui. O cupom de venda (não
fiscal) **não** passa por essa ponte — é impressão normal via Windows,
o caixa clica em "Imprimir" (decisão do usuário em 2026-08-28).

### 4. Solto de sessões anteriores (fora do PDV, mas ainda pendente)
- Apagar o OAuth App do GitHub e o Worker `brisa-cms-oauth` órfãos — o
  client secret deles foi exposto no chat lá no início do projeto, antes
  do PDV existir. Nunca confirmado como apagado.
- Os subdomínios `bio.`, `admin.`, `cardapio.` no Cloudflare ficaram sem
  uso depois que tudo passou a ser por caminho (`/bio`, `/admin`, `/pdv`).
  Não atrapalham, mas podem ser removidos.

### 5. Buraco pequeno, de baixo risco
- Reduzir a quantidade de um item lançado (não cancelar, só diminuir)
  hoje não exige senha de gerência — só cancelar exige. Não tem botão pra
  isso na tela ainda, então não é alcançável por ninguém usando o app
  normalmente, mas a API aceitaria se alguém chamasse direto. Mencionado,
  nunca fechado porque não foi pedido.

---

## Como continuar

```bash
# rodar os testes do PDV e do admin (SQLite real, não mock)
node test/pdv.test.mjs
node test/admin.test.mjs
node test/routing.test.mjs

# rodar os testes da ponte de impressão
cd print-bridge && npm test
```

`test/pdv.test.mjs` e `test/routing.test.mjs` tinham um `ROOT` fixo em
`/home/user/brisaloungebar` (caminho de um sandbox antigo) — corrigido
nesta sessão pra resolver a raiz do repo sozinho via `import.meta.url`,
então agora rodam em qualquer máquina.

Todo commit nesta branch segue o padrão: código + teste automatizado que
prova o comportamento + (quando mexe no schema) uma migração numerada em
`migrations/`, com o SQL sempre entregue pra rodar manualmente no D1
Console — não existe deploy automático de schema neste projeto.

Se for outra sessão do Claude retomando: lê este arquivo inteiro antes de
mexer em qualquer coisa. O código já reflete tudo que está marcado como
pronto acima — não precisa (nem deve) reconstruir nada disso.
