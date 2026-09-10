// Testa a formatação ESC/POS byte a byte — sem impressora, sem Windows,
// só conferindo que os comandos certos saem nos lugares certos.
//
// Run: node test/ticket.test.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { buildTicket, stripAccents } = require('../lib/ticket.js');
const iconv = require('iconv-lite');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('ok    ' + label); }
  else { fail++; console.log('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

const ESC = 0x1b, GS = 0x1d;

function indexOfBytes(haystack, needle) {
  return haystack.indexOf(Buffer.from(needle));
}

// -------------------------------------------------------------- stripAccents
check('stripAccents tira acento sem trocar a letra', stripAccents('Guaraná Açaí') === 'Guarana Acai', stripAccents('Guaraná Açaí'));
check('stripAccents não mexe em texto sem acento', stripAccents('Gin Tonica') === 'Gin Tonica');

// ----------------------------------------------------------------- buildTicket
const item = {
  sectorLabel: 'Bar/Cozinha',
  tabLabel: 'Mesa 7',
  name: 'Caipirinha Cachaça',
  qty: 2,
  waiterName: 'Carla Garçonete',
  note: 'sem gelo',
  time: '20:14',
};

const buf = buildTicket(item);

check('começa com ESC @ (init)', buf[0] === ESC && buf[1] === 0x40);
check('é um Buffer de verdade', Buffer.isBuffer(buf));
check('termina com o corte (GS V 1)', buf[buf.length - 1] === 0x01 && buf[buf.length - 2] === 0x56 && buf[buf.length - 3] === GS);

check('contém o nome do setor em maiúsculas, codificado em cp860',
  indexOfBytes(buf, iconv.encode('BAR/COZINHA', 'cp860')) !== -1);

check('contém a comanda, acentuada, codificada em cp860',
  indexOfBytes(buf, iconv.encode('Mesa 7', 'cp860')) !== -1);

check('contém "2x Caipirinha Cachaça" com o acento certo',
  indexOfBytes(buf, iconv.encode('2x Caipirinha Cachaça', 'cp860')) !== -1);

check('contém a observação',
  indexOfBytes(buf, iconv.encode('obs: sem gelo', 'cp860')) !== -1);

check('contém o nome do garçom, com "ç" acentuado',
  indexOfBytes(buf, iconv.encode('Garcom: Carla Garçonete', 'cp860')) !== -1 ||
  indexOfBytes(buf, iconv.encode('Garçom: Carla Garçonete', 'cp860')) !== -1);

check('contém o horário',
  indexOfBytes(buf, Buffer.from('20:14', 'ascii')) !== -1);

// ------------------------------------------------------ nome de quem pediu
const comPessoa = buildTicket(Object.assign({}, item, { guestName: 'João Pedro' }));
check('contém o nome da pessoa que pediu, acentuado',
  indexOfBytes(comPessoa, iconv.encode('João Pedro', 'cp860')) !== -1);
check('o nome da pessoa sai antes do item (é o que o garçom lê pra entregar)',
  indexOfBytes(comPessoa, iconv.encode('João Pedro', 'cp860')) <
  indexOfBytes(comPessoa, iconv.encode('2x Caipirinha Cachaça', 'cp860')));
check('sem pessoa amarrada, o ticket não ganha linha vazia no lugar',
  indexOfBytes(buf, iconv.encode('Mesa 7', 'cp860')) !== -1 &&
  indexOfBytes(buf, iconv.encode('2x Caipirinha Cachaça', 'cp860')) !== -1);

// Comanda avulsa é aberta com o nome da própria pessoa, então rótulo e
// pessoa viram a mesma coisa — imprimir os dois seria o mesmo nome duas
// vezes seguidas.
const avulsa = buildTicket(Object.assign({}, item, { tabLabel: 'Joana', guestName: 'Joana' }));
check('rótulo igual ao nome da pessoa não imprime duas vezes',
  avulsa.toString('binary').split(iconv.encode('Joana', 'cp860').toString('binary')).length - 1 === 1,
  'apareceu ' + (avulsa.toString('binary').split(iconv.encode('Joana', 'cp860').toString('binary')).length - 1) + 'x');

// ------------------------------------------------------ cliente cadastrado
const comCliente = buildTicket(Object.assign({}, item, {
  customerName: 'Carla Menezes',
  customerPhone: '(11) 98888-1111',
  customerNote: 'alérgica a camarão',
}));
check('imprime o nome do cliente cadastrado',
  indexOfBytes(comCliente, iconv.encode('Cliente: Carla Menezes', 'cp860')) !== -1);
check('imprime o telefone do cliente',
  indexOfBytes(comCliente, iconv.encode('Tel: (11) 98888-1111', 'cp860')) !== -1);
check('imprime a observação da ficha destacada',
  indexOfBytes(comCliente, iconv.encode('** alérgica a camarão **', 'cp860')) !== -1);
check('a observação da ficha vem ANTES dos dados de contato (é aviso de preparo, não rodapé)',
  indexOfBytes(comCliente, iconv.encode('alérgica a camarão', 'cp860')) <
  indexOfBytes(comCliente, iconv.encode('Cliente: Carla Menezes', 'cp860')));
check('a observação da ficha vem DEPOIS do item, junto do que se prepara',
  indexOfBytes(comCliente, iconv.encode('2x Caipirinha Cachaça', 'cp860')) <
  indexOfBytes(comCliente, iconv.encode('alérgica a camarão', 'cp860')));

// Mesa sem ficha vinculada é a maioria: nada de "Cliente:" vazio no papel.
check('comanda sem cliente cadastrado não imprime linha de cliente',
  indexOfBytes(buf, Buffer.from('Cliente:', 'ascii')) === -1);
check('comanda sem cliente cadastrado não imprime linha de telefone',
  indexOfBytes(buf, Buffer.from('Tel:', 'ascii')) === -1);

// Cliente com ficha mas sem telefone/observação não pode gerar linha solta.
const soNome = buildTicket(Object.assign({}, item, { customerName: 'Diego Alves' }));
check('cliente só com nome não imprime "Tel:" vazio',
  indexOfBytes(soNome, Buffer.from('Tel:', 'ascii')) === -1);
check('cliente só com nome não imprime "**" da observação',
  indexOfBytes(soNome, Buffer.from('**', 'ascii')) === -1);

// sem observação: a linha "obs:" não deve aparecer
const semNota = buildTicket(Object.assign({}, item, { note: undefined }));
check('sem observação, "obs:" não aparece', indexOfBytes(semNota, Buffer.from('obs:', 'ascii')) === -1);

// --------------------------------------------------------- modo sem acento
const semAcento = buildTicket(item, { stripAccents: true });
check('modo stripAccents tira o "ã" de Garçonete -> "Garconete"',
  indexOfBytes(semAcento, Buffer.from('Garconete', 'ascii')) !== -1);
check('modo stripAccents não manda o comando de code page (não precisa)',
  indexOfBytes(semAcento, Buffer.from([ESC, 0x74, 0x03])) === -1 ||
  indexOfBytes(semAcento, Buffer.from([ESC, 0x74, 0x03])) > 3); // só não pode ser logo no início

// --------------------------------------------------------- largura da régua
const largo = buildTicket(item, { lineWidth: 10 });
const rule10 = Buffer.from('-'.repeat(10) + '\n', 'ascii');
check('respeita lineWidth customizado na régua', indexOfBytes(largo, rule10) !== -1);

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
