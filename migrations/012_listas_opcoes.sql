-- Sabores e escolhas saem do texto solto e viram cadastro de verdade.
--
-- Até aqui, "Escolha uma fruta: Limão, Morango, Abacaxi, Maracujá ou Kiwi"
-- era texto livre no campo de observação, repetido em cada produto. Criar um
-- sabor novo exigia editar todos os lugares onde a frase aparecia — e o PDV
-- não tinha como oferecer as opções ao garçom, porque não sabia que aquilo
-- era uma escolha e não uma descrição.

/* ------------------------------------------------------------ as listas
   Uma lista é reutilizável de propósito: "Frutas" serve as 4 caipirinhas E
   a Batida Brisa. É isso que faz um sabor novo aparecer em todos os lugares
   de uma edição só — que era o pedido. */
CREATE TABLE IF NOT EXISTS option_lists (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS option_values (
  id          TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL REFERENCES option_lists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- Acréscimo em centavos, pra opção que custa a mais (ex: aluguel do
  -- narguilé na primeira). 0 na imensa maioria.
  price_cents INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_option_values_list ON option_values(list_id, sort_order);

/* ------------------------------------------------ onde cada lista é pedida
   target_type diz se a escolha vale pro grupo inteiro (a fruta vale pras 4
   caipirinhas) ou só pra um produto (o sabor do Gin Eternity é só dele).

   min_choices/max_choices cobrem os três casos reais do cardápio: escolha
   obrigatória de 1 (fruta), opcional (0..1), e várias (os 4 gelos do combo).

   Um mesmo produto pode ter mais de uma linha aqui — o Gin Premium pede
   sabor E gin, que são duas escolhas independentes. */
CREATE TABLE IF NOT EXISTS option_groups (
  id           TEXT PRIMARY KEY,
  list_id      TEXT NOT NULL REFERENCES option_lists(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('group', 'item')),
  target_id    TEXT NOT NULL,
  label        TEXT NOT NULL,
  min_choices  INTEGER NOT NULL DEFAULT 1,
  max_choices  INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_option_groups_target ON option_groups(target_type, target_id);

/* -------------------------------------- o que o cliente escolheu, guardado
   Guardado como linha e não como texto colado no item porque "qual sabor de
   narguilé sai mais" é a primeira pergunta que um bar com 22 sabores faz —
   e em texto livre isso não tem resposta.

   O nome é copiado no momento do pedido (não referenciado ao vivo), pela
   mesma razão que o preço do item é copiado: renomear um sabor amanhã não
   pode reescrever o que foi pedido ontem. */
CREATE TABLE IF NOT EXISTS tab_item_options (
  id          TEXT PRIMARY KEY,
  tab_item_id TEXT NOT NULL REFERENCES tab_items(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tab_item_options ON tab_item_options(tab_item_id);
