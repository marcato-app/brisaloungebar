-- Carrinho antes da impressora.
--
-- Até aqui, cada item lançado caía na fila de impressão na hora e saía no
-- papel em segundos. Isso torna impossível escolher sabor, revisar o pedido
-- ou corrigir um erro de digitação — o papel já saiu.
--
-- Com sent_at, o item nasce "no carrinho do garçom" (sent_at NULL) e só entra
-- na fila da cozinha quando ele confere e manda. É o que abre espaço pros
-- sabores e pra observação.
ALTER TABLE tab_items ADD COLUMN sent_at TEXT;

-- Tudo que já existe JÁ foi impresso e preparado. Sem este backfill, todo
-- pedido antigo voltaria a aparecer como "não enviado" e a cozinha receberia
-- de novo a noite inteira de ontem.
UPDATE tab_items SET sent_at = created_at WHERE sent_at IS NULL;

-- A fila de impressão e o quadro de setor filtram por sent_at, então vale um
-- índice: é a consulta que a ponte faz a cada 4 segundos, o dia todo.
CREATE INDEX IF NOT EXISTS idx_tab_items_sent ON tab_items(sector, sent_at);
