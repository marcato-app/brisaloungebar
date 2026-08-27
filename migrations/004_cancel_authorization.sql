-- Rastro de quem autorizou o cancelamento de um item — cancelar exige
-- usuário e senha de um gerente, e fica registrado qual gerente foi.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 003_print_queue.sql.

ALTER TABLE tab_items ADD COLUMN canceled_by TEXT;
