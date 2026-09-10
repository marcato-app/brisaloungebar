-- Impressoras: nome do compartilhamento no Windows sai do config.json do PC e
-- passa a viver aqui, editável em Configurações. Assim o gerente troca uma
-- impressora sem precisar de bloco de notas no PC — a ponte lê da API.
--
-- Os valores abaixo são os nomes que o print-bridge/README.md manda criar.
-- Quem já tem a ponte rodando com outro nome no config.json continua
-- funcionando: a ponte só usa o que vem da API quando a API responde.
INSERT INTO venue_settings (key, value) VALUES ('printer_bar_cozinha', '\\localhost\ELGIN_BAR')
ON CONFLICT(key) DO NOTHING;
INSERT INTO venue_settings (key, value) VALUES ('printer_tabacaria', '\\localhost\ELGIN_TABACARIA')
ON CONFLICT(key) DO NOTHING;

-- Sinal de vida da ponte, por setor. Sem isto, uma impressora que parou de
-- noite só é descoberta pelo papel que não sai — a cozinha fica sem pedido e
-- ninguém sabe por quê.
--
-- last_seen_at é gravado toda vez que a ponte pergunta pela fila (ela
-- pergunta a cada poucos segundos, então "faz muito tempo" == parou).
-- last_error guarda o motivo da última falha de impressão, e é limpo no
-- primeiro sucesso seguinte.
CREATE TABLE IF NOT EXISTS printer_status (
  sector          TEXT PRIMARY KEY,
  last_seen_at    TEXT,
  last_printed_at TEXT,
  last_error      TEXT,
  last_error_at   TEXT
);
