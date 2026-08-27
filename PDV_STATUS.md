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
real, não mock — `node test/pdv.test.mjs`) e conferido em navegador de
verdade antes de subir. Estado atual: **68 checagens em `test/pdv.test.mjs`,
0 falhas**, mais `test/routing.test.mjs` (roteamento) e 35 checagens em
`print-bridge/test/*`.

### Fundação
- Catálogo do cardápio migrado pra dentro do mesmo banco do PDV (nenhuma
  mudança pro `/cardapio` público).
- Login de funcionário separado do login do admin do cardápio (cookies e
  sessões diferentes, dá pra estar logado nos dois ao mesmo tempo).
- Cadastro de funcionários (só gerente cadastra/edita; desligar é desativar,
  nunca apagar — o nome continua no histórico de pedidos antigos).
- Cadastro de clientes (nome, telefone, nascimento) com busca.

### Comandas e pedido
- Abrir comanda, listar comandas abertas com total ao vivo.
- Garçom lança item buscando pelo nome — cada lançamento é uma linha nova
  (não edita a comanda inteira), então dois garçons na mesma comanda não se
  atropelam.
- Transferência de comanda (troca o titular, mantém o histórico).

### Fechamento e pagamento
- Pagamento parcial **por item** (não por valor livre) — quem paga escolhe
  quais linhas está cobrindo; o valor é sempre calculado a partir dos itens
  escolhidos, nunca aceito do cliente.
- Um item já pago trava: não cancela, não muda quantidade.
- Fechar comanda exige saldo pendente zerado.
- Cupom em tela (logo, comanda, cliente, itens, pago/pendente, pagamentos)
  com folha de impressão própria — já funciona hoje em qualquer impressora
  comum ou salvando em PDF, independente da impressora térmica.

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

### Identidade visual do PDV
- Repaginado pra parecer ferramenta de operação, não o site de marca:
  paleta mais fria, formas retangulares em vez de pílulas, números em
  monoespaçada (IBM Plex Mono). O cardápio público e o admin continuam
  com a identidade de marca — isso foi só na tela interna.

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
nesta ordem:

- [x] `migrations/002_pdv.sql` — funcionários, clientes, comandas, itens,
      pagamentos, despesas, estoque; `price_cents` e `sector` no catálogo.
- [x] `migrations/003_print_queue.sql` — `printed_at` em `tab_items`.
- [x] `migrations/004_cancel_authorization.sql` — `canceled_by` em `tab_items`.
- [x] `migrations/005_kanban_status.sql` — status `pronto` (recria a tabela,
      SQLite não deixa alterar um CHECK existente).

Se alguma tela der erro estranho (ex: "status inválido" ao marcar item como
pronto), o primeiro lugar a checar é se `005` realmente rodou.

---

## O que falta

Em ordem de prioridade real, não a ordem do roteiro original:

### 1. Testar a ponte de impressão numa Elgin i9 de verdade — **bloqueado até ter o PC configurado**
Ponto mais provável de precisar ajuste no primeiro teste real: acentuação
(ç, ã) saindo errada — o `README.md` já documenta o plano B de uma linha
(`stripAccents: true` no `config.json`). Qualquer outro erro, a mensagem
aparece na janela do terminal — copia e cola aqui.

### 2. Fase 4 do roteiro original — nunca começada
- Estoque simples (contagem manual, sem baixa automática por venda).
- Financeiro simples: boletos e despesas fixas do bar, com vencimento.

### 3. Solto de sessões anteriores (fora do PDV, mas ainda pendente)
- Apagar o OAuth App do GitHub e o Worker `brisa-cms-oauth` órfãos — o
  client secret deles foi exposto no chat lá no início do projeto, antes
  do PDV existir. Nunca confirmado como apagado.
- Os subdomínios `bio.`, `admin.`, `cardapio.` no Cloudflare ficaram sem
  uso depois que tudo passou a ser por caminho (`/bio`, `/admin`, `/pdv`).
  Não atrapalham, mas podem ser removidos.

### 4. Buraco pequeno, de baixo risco
- Reduzir a quantidade de um item lançado (não cancelar, só diminuir)
  hoje não exige senha de gerência — só cancelar exige. Não tem botão pra
  isso na tela ainda, então não é alcançável por ninguém usando o app
  normalmente, mas a API aceitaria se alguém chamasse direto. Mencionado,
  nunca fechado porque não foi pedido.

---

## Como continuar

```bash
# rodar os testes do PDV (SQLite real, não mock)
node test/pdv.test.mjs
node test/routing.test.mjs

# rodar os testes da ponte de impressão
cd print-bridge && npm test
```

Todo commit nesta branch segue o padrão: código + teste automatizado que
prova o comportamento + (quando mexe no schema) uma migração numerada em
`migrations/`, com o SQL sempre entregue pra rodar manualmente no D1
Console — não existe deploy automático de schema neste projeto.

Se for outra sessão do Claude retomando: lê este arquivo inteiro antes de
mexer em qualquer coisa. O código já reflete tudo que está marcado como
pronto acima — não precisa (nem deve) reconstruir nada disso.
