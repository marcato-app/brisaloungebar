-- Fila de impressão: separa "a cozinha já viu isso na tela" (status) de
-- "isso já saiu no papel" (printed_at). São coisas diferentes — o pedido
-- aparece na tela na hora, mas só vira ticket impresso quando a ponte de
-- impressão (rodando na máquina ligada na impressora) buscar e confirmar.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 002_pdv.sql.

ALTER TABLE tab_items ADD COLUMN printed_at TEXT;
