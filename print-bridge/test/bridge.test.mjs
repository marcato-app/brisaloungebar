// Testa o ciclo inteiro (tick/processSector) com um client de API e uma
// "impressora" falsos — confere que imprimir com sucesso marca o item, que
// falha na impressão NÃO marca (fica pra tentar de novo), e que os dois
// setores são processados na mesma passada.
//
// Run: node test/bridge.test.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('ok    ' + label); }
  else { fail++; console.log('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

// bridge.js exige lib/printer.js de verdade (que chamaria cmd.exe). Como
// este é só um teste de orquestração — "chamou o quê, na ordem certa, com
// o resultado certo" — troca o módulo por um dublê antes de carregar
// bridge.js, em vez de arriscar um exec de verdade no ambiente de teste.
const printerPath = require.resolve('../lib/printer.js');
const calls = { printed: [] };
let shouldFail = () => false;

const fakePrinterModule = {
  exports: {
    printToWindowsShare: async (buffer, printerShare) => {
      calls.printed.push({ printerShare, bufferLength: buffer.length });
      if (shouldFail()) throw new Error('impressora offline (simulado)');
    },
  },
};
require.cache[printerPath] = { id: printerPath, filename: printerPath, loaded: true, exports: fakePrinterModule.exports };

const bridgePath = require.resolve('../bridge.js');
const { processSector, tick, resetSharesCache } = require(bridgePath);

function fakeClient({ queues, marked, shares, reported }) {
  return {
    async printQueue(sector) {
      return queues[sector] || [];
    },
    async markPrinted(id) {
      marked.push(id);
    },
    // shares === undefined imita servidor antigo, sem a rota /api/pdv/printers.
    async printerShares() {
      return shares === undefined ? null : shares;
    },
    async reportError(sector, message) {
      (reported || []).push({ sector, message });
    },
  };
}

async function main() {
  // --------------------------------------------------------------- sucesso
  let marked = [];
  let client = fakeClient({
    queues: { bar_cozinha: [{ id: 'ti_1', name: 'Gin', qty: 1, tab_label: 'Mesa 3', waiter_name: 'Carla', created_at: '2026-08-26 20:00:00' }] },
    marked,
  });
  calls.printed = [];
  shouldFail = () => false;

  await processSector(client, { printers: { bar_cozinha: '\\\\localhost\\ELGIN_BAR' } }, 'bar_cozinha');

  check('imprimiu no compartilhamento certo', calls.printed[0]?.printerShare === '\\\\localhost\\ELGIN_BAR', JSON.stringify(calls.printed));
  check('marcou o item como impresso depois do sucesso', marked.includes('ti_1'), marked);

  // ------------------------------------------------------ falha na impressão
  marked = [];
  let reported = [];
  client = fakeClient({
    queues: { tabacaria: [{ id: 'ti_2', name: 'Rosh', qty: 1, tab_label: 'Mesa 5', waiter_name: 'João', created_at: '2026-08-26 20:05:00' }] },
    marked, reported,
  });
  calls.printed = [];
  shouldFail = () => true;

  await processSector(client, { printers: { tabacaria: '\\\\localhost\\ELGIN_TABACARIA' } }, 'tabacaria');

  check('tentou imprimir mesmo assim', calls.printed.length === 1);
  check('NÃO marca como impresso quando a impressão falha (tenta de novo depois)', marked.length === 0, marked);
  check('avisa o PDV que a impressão falhou, com o motivo',
    reported.length === 1 && reported[0].sector === 'tabacaria' && /offline/.test(reported[0].message),
    JSON.stringify(reported));

  // --------------------------------------------------------- setor sem impressora
  marked = [];
  client = fakeClient({ queues: { tabacaria: [{ id: 'ti_3', name: 'X', qty: 1, tab_label: 'Mesa 1', created_at: '2026-08-26 20:00:00' }] }, marked });
  calls.printed = [];
  shouldFail = () => false;

  await processSector(client, { printers: { bar_cozinha: '\\\\localhost\\ELGIN_BAR' } }, 'tabacaria');
  check('setor sem impressora configurada não tenta imprimir nada', calls.printed.length === 0, calls.printed);
  check('e não marca nada como impresso', marked.length === 0, marked);

  // --------------------------------- nome da impressora vindo do PDV
  // O gerente trocou a impressora do bar na tela de Configurações: a ponte
  // tem que usar o nome novo sem ninguém editar config.json no PC.
  resetSharesCache();
  marked = [];
  client = fakeClient({
    queues: { bar_cozinha: [{ id: 'ti_4', name: 'Gin', qty: 1, tab_label: 'Mesa 2', created_at: '2026-08-26 20:00:00' }] },
    marked,
    shares: { bar_cozinha: '\\\\localhost\\ELGIN_NOVA' },
  });
  calls.printed = [];
  shouldFail = () => false;

  await tick(client, { printers: { bar_cozinha: '\\\\localhost\\ELGIN_ANTIGA' } });
  check('usa o compartilhamento configurado no PDV, não o do config.json',
    calls.printed[0]?.printerShare === '\\\\localhost\\ELGIN_NOVA', JSON.stringify(calls.printed));

  // Servidor antigo (sem a rota) não pode quebrar a ponte de quem já tem ela
  // rodando — cai no config.json e imprime igual.
  resetSharesCache();
  marked = [];
  client = fakeClient({
    queues: { bar_cozinha: [{ id: 'ti_5', name: 'Gin', qty: 1, tab_label: 'Mesa 2', created_at: '2026-08-26 20:00:00' }] },
    marked,
  });
  calls.printed = [];

  await tick(client, { printers: { bar_cozinha: '\\\\localhost\\ELGIN_ANTIGA' } });
  check('servidor sem a rota de impressoras: volta pro config.json',
    calls.printed[0]?.printerShare === '\\\\localhost\\ELGIN_ANTIGA', JSON.stringify(calls.printed));

  // O PC é quem diz quais setores ele atende. Impressora que não está no
  // cabo dele não pode começar a imprimir só porque existe no PDV.
  resetSharesCache();
  marked = [];
  client = fakeClient({
    queues: {
      bar_cozinha: [{ id: 'ti_6', name: 'Gin', qty: 1, tab_label: 'Mesa 2', created_at: '2026-08-26 20:00:00' }],
      tabacaria: [{ id: 'ti_7', name: 'Rosh', qty: 1, tab_label: 'Mesa 9', created_at: '2026-08-26 20:00:00' }],
    },
    marked,
    shares: { bar_cozinha: '\\\\localhost\\ELGIN_BAR', tabacaria: '\\\\localhost\\ELGIN_TABACARIA' },
  });
  calls.printed = [];

  await tick(client, { printers: { bar_cozinha: '\\\\localhost\\ELGIN_BAR' } });
  check('PC só imprime os setores que ele tem, mesmo com os dois no PDV',
    calls.printed.length === 1 && marked.length === 1 && marked[0] === 'ti_6',
    JSON.stringify({ printed: calls.printed, marked }));

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
