-- Pessoas dentro de uma comanda: mesa 5 pode ter 4 pessoas, cada uma com
-- seus próprios pedidos. Cada item lançado pode ser amarrado a uma pessoa
-- (guest_id) — sem isso, "quem pediu essa dose mesmo?" vira adivinhação
-- na hora de dividir a conta.
--
-- Abrir uma comanda agora exige o nome de pelo menos uma pessoa (ver
-- POST /api/pdv/tabs) — essa pessoa vira a primeira linha aqui. Mais
-- gente na mesa entra depois via POST /api/pdv/tabs/:id/guests.
--
-- guest_id em tab_items é opcional de propósito: um balde de cerveja pode
-- ser da mesa inteira, sem dono só dele.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 007_venue_settings.sql.

CREATE TABLE IF NOT EXISTS tab_guests (
  id         TEXT PRIMARY KEY,
  tab_id     TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tab_guests_tab ON tab_guests(tab_id);

ALTER TABLE tab_items ADD COLUMN guest_id TEXT REFERENCES tab_guests(id);
