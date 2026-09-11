-- Seed das listas de opções, gerado a partir do cardápio real.
--
-- As ligações procuram grupo/produto PELO NOME, porque os ids de produção
-- não são conhecidos aqui. Nome que não bater simplesmente não insere nada —
-- a migração não quebra, só deixa aquela ligação de fora (dá pra ligar na
-- mão pelo admin depois).
--
-- ON CONFLICT DO NOTHING em tudo: rodar duas vezes não duplica.

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_frutas', 'Frutas (caipirinha e batida)', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_frutas_v0', 'ol_frutas', 'Limão', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_frutas_v1', 'ol_frutas', 'Morango', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_frutas_v2', 'ol_frutas', 'Abacaxi', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_frutas_v3', 'ol_frutas', 'Maracujá', 3)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_frutas_v4', 'ol_frutas', 'Kiwi', 4)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_gin_eternity', 'Sabores Gin Eternity', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gin_eternity_v0', 'ol_gin_eternity', 'Melancia', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gin_eternity_v1', 'ol_gin_eternity', 'Tropical', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gin_eternity_v2', 'ol_gin_eternity', 'Maçã Verde', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gin_eternity_v3', 'ol_gin_eternity', 'Royale', 3)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_redbull', 'Sabores Red Bull', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_redbull_v0', 'ol_redbull', 'Melancia', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_redbull_v1', 'ol_redbull', 'Tropical', 1)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_gins', 'Gins', 3)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gins_v0', 'ol_gins', 'Beefeater', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gins_v1', 'ol_gins', 'Tanqueray', 1)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_jack', 'Sabores Jack Daniel''s', 4)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_jack_v0', 'ol_jack', 'Maçã Verde', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_jack_v1', 'ol_jack', 'Fire', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_jack_v2', 'ol_jack', 'Honey', 2)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_gelos', 'Gelos de sabor', 5)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v0', 'ol_gelos', 'Água', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v1', 'ol_gelos', 'Melancia', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v2', 'ol_gelos', 'Tropical', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v3', 'ol_gelos', 'Maçã Verde', 3)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v4', 'ol_gelos', 'Morango', 4)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_gelos_v5', 'ol_gelos', 'Maracujá', 5)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_beats', 'Skol Beats', 6)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_beats_v0', 'ol_beats', 'Senses', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_beats_v1', 'ol_beats', 'Red Mix', 1)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_refri', 'Refrigerantes', 7)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_refri_v0', 'ol_refri', 'Coca-Cola', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_refri_v1', 'ol_refri', 'Guaraná', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_refri_v2', 'ol_refri', 'Sprite', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_refri_v3', 'ol_refri', 'Fanta', 3)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_agua', 'Água', 8)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_agua_v0', 'ol_agua', 'Sem gás', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_agua_v1', 'ol_agua', 'Com gás', 1)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_ziggy', 'Sabores Ziggy (narguilé)', 9)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v0', 'ol_ziggy', 'Banana Tropical', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v1', 'ol_ziggy', 'Cereja', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v2', 'ol_ziggy', 'Duas Maçã', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v3', 'ol_ziggy', 'Duas Goiaba', 3)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v4', 'ol_ziggy', 'Frutas Amarelas', 4)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v5', 'ol_ziggy', 'Frutas Verdes', 5)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v6', 'ol_ziggy', 'Frutas Roxas', 6)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v7', 'ol_ziggy', 'Limão', 7)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v8', 'ol_ziggy', 'Melancia', 8)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v9', 'ol_ziggy', 'Maracujá', 9)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v10', 'ol_ziggy', 'Menta', 10)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v11', 'ol_ziggy', 'Morango e Laranja', 11)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v12', 'ol_ziggy', 'Sorvete de Pistache', 12)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v13', 'ol_ziggy', 'Tropical', 13)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v14', 'ol_ziggy', 'Tutti Frutti', 14)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v15', 'ol_ziggy', 'Uva', 15)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v16', 'ol_ziggy', 'Yorgut', 16)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v17', 'ol_ziggy', '7 Belo', 17)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v18', 'ol_ziggy', 'Love 66', 18)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v19', 'ol_ziggy', 'Abacaxi Tropical', 19)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v20', 'ol_ziggy', 'Morango Tropical', 20)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_ziggy_v21', 'ol_ziggy', 'Sorvete de Limão', 21)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_lists (id, title, sort_order) VALUES ('ol_porcoes', 'Porções (Completa Design)', 10)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_porcoes_v0', 'ol_porcoes', 'Batata com Cheddar e Bacon', 0)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_porcoes_v1', 'ol_porcoes', 'Calabresa', 1)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_porcoes_v2', 'ol_porcoes', 'Onion Rings', 2)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_values (id, list_id, name, sort_order) VALUES ('ol_porcoes_v3', 'ol_porcoes', 'Frango a Passarinho', 3)
  ON CONFLICT(id) DO NOTHING;

INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_caipi', 'ol_frutas', 'group', id, 'Fruta', 1, 1, 0
    FROM groups WHERE title = 'Caipirinhas'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_batida', 'ol_frutas', 'item', id, 'Fruta', 1, 1, 0
    FROM items WHERE name = 'Batida Brisa'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_eternity', 'ol_gin_eternity', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Gin Eternity'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_ginprem_sab', 'ol_redbull', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Gin Premium & Red Bull'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_ginprem_gin', 'ol_gins', 'item', id, 'Gin', 1, 1, 1
    FROM items WHERE name = 'Gin Premium & Red Bull'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_copao_sab', 'ol_redbull', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Copão Premium & Red Bull'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_copao_gin', 'ol_gins', 'item', id, 'Gin', 1, 1, 1
    FROM items WHERE name = 'Copão Premium & Red Bull'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_jack_copao', 'ol_jack', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Jack Daniel''s Sabores + Red Bull'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_jack_combo', 'ol_jack', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Jack Daniel''s Sabores'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_combo_gelos', 'ol_gelos', 'group', id, 'Gelos (4)', 4, 4, 1
    FROM groups WHERE title = 'Combos'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_narguile', 'ol_ziggy', 'group', id, 'Sabor', 1, 1, 0
    FROM groups WHERE title = 'Narguilé'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_beats', 'ol_beats', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Skol Beats'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_refri', 'ol_refri', 'item', id, 'Sabor', 1, 1, 0
    FROM items WHERE name = 'Refrigerante Lata 350ml'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_agua', 'ol_agua', 'item', id, 'Gás', 1, 1, 0
    FROM items WHERE name = 'Água'
  ON CONFLICT(id) DO NOTHING;
INSERT INTO option_groups (id, list_id, target_type, target_id, label, min_choices, max_choices, sort_order)
  SELECT 'og_completa', 'ol_porcoes', 'item', id, 'Escolha 2 porções', 2, 2, 0
    FROM items WHERE name = 'Completa Design'
  ON CONFLICT(id) DO NOTHING;
