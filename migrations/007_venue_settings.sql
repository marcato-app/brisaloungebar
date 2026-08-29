-- Dados do negócio que aparecem no cupom de venda (não fiscal): nome,
-- CNPJ, endereço, telefone, rodapé. Chave/valor em vez de colunas fixas
-- de propósito — é mais fácil adicionar um campo novo depois sem outra
-- migração, e só existe uma linha por chave mesmo (um bar só).
--
-- Seedado com o que já estava hardcoded no cupom, pra não mudar nada na
-- tela até o gerente editar pela primeira vez.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 006_table_number.sql.

CREATE TABLE IF NOT EXISTS venue_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO venue_settings (key, value) VALUES
  ('business_name',   'Brisa Lounge Bar'),
  ('cnpj',            ''),
  ('address',         ''),
  ('phone',           ''),
  ('receipt_footer',  'brisaloungebar.com.br')
ON CONFLICT(key) DO NOTHING;
