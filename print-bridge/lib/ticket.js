// Monta o ticket ESC/POS de um item — puro: recebe dados, devolve um
// Buffer de bytes. Não abre socket, não escreve arquivo, não fala com
// impressora nenhuma, então dá pra testar sem hardware nenhum por perto.
//
// Referência de comandos: ESC/POS (padrão Epson, que a Elgin i9 segue).

'use strict';
const iconv = require('iconv-lite');

const ESC = 0x1b;
const GS = 0x1d;

const INIT = Buffer.from([ESC, 0x40]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const DOUBLE_ON = Buffer.from([GS, 0x21, 0x11]);
const DOUBLE_OFF = Buffer.from([GS, 0x21, 0x00]);
const FEED = (n) => Buffer.from([ESC, 0x64, n]);
const CUT = Buffer.from([GS, 0x56, 0x01]); // corte parcial — mais compatível que o corte total

// Tabela de code page da Epson: 3 = PC860 (Português). Se os acentos saírem
// errados na impressora real, é aqui que se ajusta primeiro — ou usa
// STRIP_ACCENTS no config pra imprimir sem acento nenhum como plano B.
const CODEPAGE_PC860 = Buffer.from([ESC, 0x74, 0x03]);

const LINE_WIDTH = 32; // 32 colunas é o padrão conservador pra 58mm em fonte normal

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function text(s, opts) {
  opts = opts || {};
  const raw = opts.stripAccents ? stripAccents(s) : String(s || '');
  return iconv.encode(raw, 'cp860');
}

function rule(width) {
  return Buffer.from('-'.repeat(width || LINE_WIDTH) + '\n', 'ascii');
}

function nl() {
  return Buffer.from('\n', 'ascii');
}

/**
 * item: { sectorLabel, tabLabel, name, qty, waiterName, note, time }
 * opts: { stripAccents, lineWidth }
 */
function buildTicket(item, opts) {
  opts = opts || {};
  const width = opts.lineWidth || LINE_WIDTH;
  const t = (s) => text(s, opts);

  const parts = [
    INIT,
    opts.stripAccents ? Buffer.alloc(0) : CODEPAGE_PC860,
    ALIGN_CENTER, BOLD_ON, t(String(item.sectorLabel || '').toUpperCase()), nl(), BOLD_OFF,
    rule(width),
    ALIGN_LEFT,
    DOUBLE_ON, t(item.tabLabel || ''), nl(), DOUBLE_OFF,
    BOLD_ON, t((item.qty || 1) + 'x ' + (item.name || '')), nl(), BOLD_OFF,
  ];

  if (item.note) parts.push(t('  obs: ' + item.note), nl());

  parts.push(
    t('Garcom: ' + (item.waiterName || '-')), nl(),
    t(item.time || ''), nl(),
    rule(width),
    FEED(3),
    CUT
  );

  return Buffer.concat(parts);
}

module.exports = { buildTicket, stripAccents, LINE_WIDTH };
