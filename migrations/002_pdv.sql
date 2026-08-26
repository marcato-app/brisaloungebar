-- PDV do Brisa: funcionários, clientes, comandas, pedidos e pagamentos.
--
-- Roda uma vez no D1 (brisaloungebar-db).
--
-- As tabelas novas usam IF NOT EXISTS e os backfills só tocam linha ainda
-- nula, então são seguros de repetir. Os dois ALTER TABLE abaixo NÃO são:
-- o SQLite não tem "ADD COLUMN IF NOT EXISTS", e repetir o arquivo inteiro
-- para em "duplicate column name". Se precisar reexecutar, apague as duas
-- linhas de ALTER antes — o resto passa limpo.

/* ------------------------------------------------------------------ dinheiro
   O catálogo guarda preço como texto ("R$23,00") porque só precisava exibir.
   O PDV precisa somar, dividir conta e conferir saldo — e conta de bar feita
   em ponto flutuante fecha errado. Daqui pra frente o valor de verdade é
   price_cents (inteiro, em centavos); o texto continua existindo só para o
   cardápio público seguir mostrando exatamente o que sempre mostrou. */
ALTER TABLE items ADD COLUMN price_cents INTEGER;

UPDATE items
SET price_cents = CAST(
  REPLACE(REPLACE(REPLACE(REPLACE(TRIM(price), 'R$', ''), ' ', ''), '.', ''), ',', '')
  AS INTEGER
)
WHERE price_cents IS NULL AND price IS NOT NULL AND TRIM(price) <> '';

/* ------------------------------------------------------------------- setores
   Dois destinos de preparo, como o bar funciona hoje: Bar e Cozinha
   compartilham uma impressora, a Tabacaria tem a dela. O destino é do grupo,
   não do item — narguilé inteiro vai pra tabacaria, o resto vai pro bar. */
ALTER TABLE groups ADD COLUMN sector TEXT NOT NULL DEFAULT 'bar_cozinha';

UPDATE groups SET sector = 'tabacaria' WHERE LOWER(title) LIKE '%narguil%';

/* -------------------------------------------------------------- funcionários
   Tabela própria em vez de reaproveitar admin_users: aqui existe cargo, nome
   de exibição (vai impresso no pedido) e desligamento sem apagar histórico. */
CREATE TABLE IF NOT EXISTS employees (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('garcom', 'caixa', 'gerente')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_sessions (
  token       TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_sessions_exp ON employee_sessions(expires_at);

/* ------------------------------------------------------------------ clientes
   Quem cadastra é o funcionário; o cliente não tem login. O telefone é o que
   se busca na correria, então é ele que ganha índice. */
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  birth_date TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

/* ------------------------------------------------------------------ comandas
   label é o nome que a comanda carrega ("Mesa 4", "Hércules"). Transferir a
   comanda troca label e customer_id — o histórico de itens e pagamentos fica
   preso ao id, então nada se perde na troca de titular. */
CREATE TABLE IF NOT EXISTS tabs (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  status      TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada')),
  opened_by   TEXT REFERENCES employees(id),
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at   TEXT,
  closed_by   TEXT REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_tabs_status ON tabs(status);

/* ------------------------------------------------------------- itens pedidos
   Cada lançamento é uma linha nova, nunca uma edição da comanda inteira —
   é isso que deixa dois garçons lançarem na mesma comanda sem se atropelar.

   name e unit_price_cents são cópias do catálogo no momento do pedido, de
   propósito: se o preço da caipirinha mudar amanhã, a comanda de hoje
   continua valendo o que foi combinado com o cliente. */
CREATE TABLE IF NOT EXISTS tab_items (
  id               TEXT PRIMARY KEY,
  tab_id           TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  item_id          TEXT REFERENCES items(id),
  name             TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty              INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  sector           TEXT NOT NULL DEFAULT 'bar_cozinha',
  note             TEXT,
  waiter_id        TEXT REFERENCES employees(id),
  waiter_name      TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'preparando', 'entregue', 'cancelado')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tab_items_tab    ON tab_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_tab_items_sector ON tab_items(sector, status);

/* --------------------------------------------------------------- pagamentos
   Pagamento parcial por item: um pagamento cobre itens escolhidos, e a
   amarração fica em payment_allocations. O UNIQUE em tab_item_id é a
   trava que impede o mesmo item ser cobrado em dois pagamentos —
   sem ela, a comanda fecharia com saldo errado e ninguém perceberia. */
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  tab_id       TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  method       TEXT NOT NULL CHECK (method IN ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  payer_name   TEXT,
  paid_at      TEXT NOT NULL DEFAULT (datetime('now')),
  received_by  TEXT REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_tab ON payments(tab_id);

CREATE TABLE IF NOT EXISTS payment_allocations (
  payment_id  TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tab_item_id TEXT NOT NULL REFERENCES tab_items(id) ON DELETE CASCADE,
  PRIMARY KEY (payment_id, tab_item_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alloc_item_once ON payment_allocations(tab_item_id);

/* ------------------------------------------------------------------ despesas
   Contas que o bar paga: fornecedor, aluguel, água, luz. Não é
   contabilidade, é controle de vencimento. */
CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  description  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date     TEXT,
  paid_at      TEXT,
  recurring    INTEGER NOT NULL DEFAULT 0,
  category     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_due ON expenses(due_date);

/* -------------------------------------------------------------------- estoque
   Contagem manual por enquanto. Sem baixa automática por venda: isso exigiria
   uma ficha técnica por item do cardápio, que desatualiza sozinha toda vez
   que alguém troca uma dose sem avisar o sistema. */
CREATE TABLE IF NOT EXISTS stock_items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  unit         TEXT,
  qty          REAL NOT NULL DEFAULT 0,
  min_qty      REAL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
