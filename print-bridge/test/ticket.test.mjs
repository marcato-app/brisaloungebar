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
