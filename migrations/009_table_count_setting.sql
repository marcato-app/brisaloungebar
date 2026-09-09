-- Número de mesas do salão sai do código e vira configuração.
--
-- Antes ele era uma constante (TABLE_COUNT = 12) dentro do pdv.html. Com o
-- app nativo lendo o mesmo mapa de mesas, a constante existiria em dois
-- lugares — mudar pra 14 mesas exigiria editar e publicar os dois clientes,
-- e é questão de tempo até um ficar pra trás do outro.
--
-- Aqui o gerente muda em Configurações e os dois pegam sozinhos. O padrão é
-- 12, que é o que já estava no código, então nada muda de comportamento pra
-- quem já usa.
--
-- Roda uma vez no D1 (brisaloungebar-db), depois de 008_tab_guests.sql.

INSERT INTO venue_settings (key, value) VALUES ('table_count', '12')
ON CONFLICT(key) DO NOTHING;
