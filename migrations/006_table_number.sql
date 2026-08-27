-- Mapa de mesas: cada comanda pode carregar o número da mesa que a abriu.
-- NULL continua existindo de propósito — comanda de balcão/avulsa (cliente
-- no bar, viagem) não tem mesa nenhuma, e a tela de Comandas trata isso como
-- uma seção separada da grade.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 005_kanban_status.sql.

ALTER TABLE tabs ADD COLUMN table_number INTEGER;
