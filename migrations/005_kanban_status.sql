-- Um quarto estágio entre "preparando" e "entregue": o item fica "pronto"
-- quando o setor termina de fazer, e só vira "entregue" quando o garçom
-- de fato leva pra mesa — são pessoas diferentes fechando cada etapa.
--
-- SQLite não deixa alterar um CHECK existente com ALTER TABLE, então a
-- tabela é recriada com a lista de status maior e os dados são copiados.
-- Roda uma vez no D1 (brisaloungebar-db), depois de 004_cancel_authorization.sql.

CREATE TABLE tab_items_new (
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
                   CHECK (status IN ('pendente', 'preparando', 'pronto', 'entregue', 'cancelado')),
  printed_at       TEXT,
  canceled_by      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO tab_items_new (
  id, tab_id, item_id, name, unit_price_cents, qty, sector, note,
  waiter_id, waiter_name, status, printed_at, canceled_by, created_at
)
SELECT
  id, tab_id, item_id, name, unit_price_cents, qty, sector, note,
  waiter_id, waiter_name, status, printed_at, canceled_by, created_at
FROM tab_items;

DROP TABLE tab_items;
ALTER TABLE tab_items_new RENAME TO tab_items;

CREATE INDEX IF NOT EXISTS idx_tab_items_tab    ON tab_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_tab_items_sector ON tab_items(sector, status);
