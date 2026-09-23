-- Sabores novos nos itens que já tinham sabor na descrição (pedido do dono
-- em 2026-09-23): Melancia, Tropical, Morango e Pêssego, Cereja.
--
-- Casa pelo começo do texto ("Sabor:" / "Escolha o sabor:") e não por id
-- ou nome, porque os ids de produção não são conhecidos aqui e os nomes
-- já foram editados no admin. Mocotó ("cheio de sabor") e Suco Del Valle
-- ("Consulte sabores") não começam assim e ficam de fora.
--
-- Só a lista de sabores muda: "(acompanha fruta)" e "· Gin: Beefeater ou
-- Tanqueray" continuam onde já existiam. Rodar duas vezes dá o mesmo.

-- 1) Conferir antes quais itens vão mudar:
-- SELECT id, name, note FROM items WHERE note LIKE 'Sabor:%' OR note LIKE 'Escolha o sabor:%';

-- 2) Aplicar:
UPDATE items
SET note = 'Sabor: Melancia, Tropical, Morango e Pêssego ou Cereja'
  || CASE
       WHEN instr(note, ' (acompanha fruta)') > 0 THEN substr(note, instr(note, ' (acompanha fruta)'))
       WHEN instr(note, ' · ') > 0 THEN substr(note, instr(note, ' · '))
       ELSE ''
     END
WHERE note LIKE 'Sabor:%' OR note LIKE 'Escolha o sabor:%';
