// Testa lib/api.js com um fetch falso — sem rede de verdade, sem worker de
// verdade, só conferindo que ele monta as chamadas certas e trata sessão
// expirada sozinho.
//
// Run: node test/api.test.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeClient } = require('../lib/api.js');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('ok    ' + label); }
  else { fail++; console.log('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

function fakeResponse({ status, body, cookie }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'set-cookie' ? (cookie || null) : null) },
    json: async () => body,
  };
}

async function main() {
  // ------------------------------------------------------------- login básico
  let calls = [];
  let fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/api/pdv/login')) {
      return fakeResponse({ status: 200, body: { ok: true }, cookie: 'brisa_pdv_session=abc123; Path=/' });
    }
    return fakeResponse({ status: 404, body: { error: 'nf' } });
  };
  let client = makeClient({ baseUrl: 'https://x.test', username: 'impressora', password: 'senha', fetchImpl });
  const cookie = await client.login();
  check('login guarda só o par nome=valor do cookie', cookie === 'brisa_pdv_session=abc123', cookie);

  // -------------------------------------------------------- login com erro
  fetchImpl = async () => fakeResponse({ status: 401, body: { error: 'Usuário ou senha inválidos' } });
  client = makeClient({ baseUrl: 'https://x.test', username: 'x', password: 'y', fetchImpl });
  let threw = null;
  try { await client.login(); } catch (e) { threw = e; }
  check('login com credencial errada lança erro com a mensagem do servidor',
    threw && /inválidos/.test(threw.message), threw && threw.message);

  // ---------------------------------------------------------- printQueue
  calls = [];
  fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/api/pdv/login')) return fakeResponse({ status: 200, body: {}, cookie: 'brisa_pdv_session=tok1; Path=/' });
    if (url.includes('/sector/bar_cozinha/print-queue')) {
      return fakeResponse({ status: 200, body: { items: [{ id: 'ti_1', name: 'Gin' }] } });
    }
    return fakeResponse({ status: 404, body: {} });
  };
  client = makeClient({ baseUrl: 'https://x.test', username: 'impressora', password: 'senha', fetchImpl });
  const items = await client.printQueue('bar_cozinha');
  check('printQueue devolve os itens da resposta', items.length === 1 && items[0].id === 'ti_1', JSON.stringify(items));
  check('printQueue logou sozinho antes (sem chamada de login manual)',
    calls.some(c => c.url.endsWith('/api/pdv/login')));
  check('a chamada de fila carrega o cookie da sessão',
    calls.find(c => c.url.includes('print-queue')).opts.headers.Cookie === 'brisa_pdv_session=tok1');

  // ------------------------------------------------ sessão expirada (401) -> relog
  let loginCount = 0;
  let queueCallCount = 0;
  fetchImpl = async (url) => {
    if (url.endsWith('/api/pdv/login')) {
      loginCount++;
      return fakeResponse({ status: 200, body: {}, cookie: 'brisa_pdv_session=tok' + loginCount + '; Path=/' });
    }
    if (url.includes('print-queue')) {
      queueCallCount++;
      // primeira chamada "expira", segunda (depois do relogin) funciona
      if (queueCallCount === 1) return fakeResponse({ status: 401, body: { error: 'expirado' } });
      return fakeResponse({ status: 200, body: { items: [] } });
    }
    return fakeResponse({ status: 404, body: {} });
  };
  client = makeClient({ baseUrl: 'https://x.test', username: 'impressora', password: 'senha', fetchImpl });
  await client.printQueue('tabacaria'); // login inicial
  await client.printQueue('tabacaria'); // essa recebe 401 e refaz login sozinha
  check('refaz login sozinho quando a sessão expira (401)', loginCount === 2, loginCount);

  // ---------------------------------------------------------- markPrinted
  calls = [];
  fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/api/pdv/login')) return fakeResponse({ status: 200, body: {}, cookie: 'brisa_pdv_session=tok; Path=/' });
    if (url.endsWith('/api/pdv/tab-items/ti_9/mark-printed')) return fakeResponse({ status: 200, body: { ok: true } });
    return fakeResponse({ status: 404, body: {} });
  };
  client = makeClient({ baseUrl: 'https://x.test', username: 'impressora', password: 'senha', fetchImpl });
  await client.markPrinted('ti_9');
  const markCall = calls.find(c => c.url.includes('mark-printed'));
  check('markPrinted chama o endpoint certo com POST', markCall && markCall.opts.method === 'POST', JSON.stringify(markCall));

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
