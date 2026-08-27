// Regression test for the PDV API routes (login, funcionários, clientes).
//
// Run with:  node test/pdv.test.mjs
//
// Exercises src/index.js's real fetch handler against a real SQLite database
// (node:sqlite, in-memory) shaped like D1's query API — not a mock of the
// logic, the actual route code running the actual SQL.

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import worker from '../src/index.js';
import { hashPassword } from '../src/auth.js';

const ROOT = '/home/user/brisaloungebar';

function makeD1(db) {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      return {
        bind(...a) { args = a; return this; },
        async all() { return { results: stmt.all(...args) }; },
        async first() { const r = stmt.get(...args); return r === undefined ? null : r; },
        async run() { const info = stmt.run(...args); return { success: true, meta: info }; },
      };
    },
    // Real D1 runs a batch as one atomic unit. node:sqlite has no async
    // driver-level transaction API exposed here, so this wraps the calls in
    // BEGIN/COMMIT by hand — good enough to prove the route asks for
    // all-or-nothing, even though it isn't D1's own implementation.
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

const BASE_SCHEMA = `
CREATE TABLE sections (id TEXT PRIMARY KEY, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE groups (id TEXT PRIMARY KEY, section_id TEXT NOT NULL, title TEXT NOT NULL,
  unit TEXT, note TEXT, keywords TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE items (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL,
  unit TEXT, price TEXT NOT NULL, note TEXT, tags TEXT, active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE admin_users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE admin_sessions (token TEXT PRIMARY KEY, admin_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE login_attempts (username TEXT PRIMARY KEY, fail_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT);
`;

const db = new DatabaseSync(':memory:');
db.exec(BASE_SCHEMA);

// migrations/002_pdv.sql assumes an existing 'items' row set for the price
// backfill's WHERE clause to run against — an empty table is fine, it just
// backfills zero rows. Strip the two non-idempotent ALTERs' guard comment
// isn't needed since this is a single fresh run.
db.exec(fs.readFileSync(`${ROOT}/migrations/002_pdv.sql`, 'utf8'));
db.exec(fs.readFileSync(`${ROOT}/migrations/003_print_queue.sql`, 'utf8'));
db.exec(fs.readFileSync(`${ROOT}/migrations/004_cancel_authorization.sql`, 'utf8'));
db.exec(fs.readFileSync(`${ROOT}/migrations/005_kanban_status.sql`, 'utf8'));

const env = { DB: makeD1(db), ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } };

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('ok    ' + label); }
  else { fail++; console.log('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

function req(method, path, { body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  return worker.fetch(
    new Request('https://brisaloungebar.com.br' + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    }),
    env, {}
  );
}

function cookieFrom(res) {
  const sc = res.headers.get('Set-Cookie') || '';
  return sc.split(';')[0];
}

async function main() {
  // ---------------------------------------------------------------- seed
  const managerId = 'emp_seed_mgr';
  db.prepare(
    'INSERT INTO employees (id, name, username, password_hash, role) VALUES (?,?,?,?,?)'
  ).run(managerId, 'Hércules', 'hercules', await hashPassword('senhaforte1'), 'gerente');

  // -------------------------------------------------------------- login
  let res = await req('POST', '/api/pdv/login', { body: { username: 'hercules', password: 'errada' } });
  check('login com senha errada -> 401', res.status === 401, res.status);

  res = await req('POST', '/api/pdv/login', { body: { username: 'hercules', password: 'senhaforte1' } });
  check('login correto -> 200', res.status === 200, res.status);
  const mgrCookie = cookieFrom(res);
  check('login correto seta cookie de sessão', mgrCookie.startsWith('brisa_pdv_session='), mgrCookie);

  res = await req('GET', '/api/pdv/me');
  check('/me sem cookie -> 401', res.status === 401, res.status);

  res = await req('GET', '/api/pdv/me', { cookie: mgrCookie });
  let me = await res.json();
  check('/me com cookie -> dados do gerente', me.name === 'Hércules' && me.role === 'gerente', JSON.stringify(me));

  // ----------------------------------------------------- cadastro (gerente)
  res = await req('POST', '/api/pdv/employees', {
    cookie: mgrCookie,
    body: { name: 'João Garçom', username: 'joao', password: 'senha123', role: 'garcom' },
  });
  check('gerente cadastra garçom -> 200', res.status === 200, res.status);
  const joaoId = (await res.json()).id;

  res = await req('POST', '/api/pdv/employees', {
    cookie: mgrCookie,
    body: { name: 'Dup', username: 'joao', password: 'outrasenha', role: 'caixa' },
  });
  check('usuário duplicado -> 400', res.status === 400, res.status);

  res = await req('POST', '/api/pdv/employees', {
    cookie: mgrCookie,
    body: { name: 'Curta', username: 'curta', password: '123', role: 'caixa' },
  });
  check('senha curta -> 400', res.status === 400, res.status);

  // --------------------------------------------- garçom não gerencia gente
  res = await req('POST', '/api/pdv/login', { body: { username: 'joao', password: 'senha123' } });
  const joaoCookie = cookieFrom(res);
  check('garçom loga normalmente -> 200', res.status === 200, res.status);

  res = await req('GET', '/api/pdv/employees', { cookie: joaoCookie });
  check('garçom não lista funcionários -> 403', res.status === 403, res.status);

  res = await req('POST', '/api/pdv/employees', {
    cookie: joaoCookie,
    body: { name: 'X', username: 'x', password: 'senha123', role: 'garcom' },
  });
  check('garçom não cadastra funcionário -> 403', res.status === 403, res.status);

  // ------------------------------------------------ desativar funcionário
  res = await req('PUT', `/api/pdv/employees/${joaoId}`, {
    cookie: mgrCookie,
    body: { name: 'João Garçom', role: 'garcom', active: false },
  });
  check('gerente desativa João -> 200', res.status === 200, res.status);

  res = await req('POST', '/api/pdv/login', { body: { username: 'joao', password: 'senha123' } });
  check('João desativado não loga mais -> 401', res.status === 401, res.status);

  res = await req('GET', '/api/pdv/employees', { cookie: mgrCookie });
  let list = await res.json();
  const joaoRow = list.employees.find(e => e.id === joaoId);
  check('João aparece inativo na listagem', joaoRow && joaoRow.active === 0, JSON.stringify(joaoRow));

  // João foi desativado acima — e sua sessão morreu junto, de propósito.
  // O resto do teste usa uma garçonete nova e ativa no lugar dele.
  res = await req('POST', '/api/pdv/employees', {
    cookie: mgrCookie,
    body: { name: 'Carla Garçonete', username: 'carla', password: 'senha123', role: 'garcom' },
  });
  res = await req('POST', '/api/pdv/login', { body: { username: 'carla', password: 'senha123' } });
  const carlaCookie = cookieFrom(res);

  // -------------------------------------------------------------- clientes
  res = await req('POST', '/api/pdv/customers', {
    cookie: mgrCookie,
    body: { name: 'Maria Silva', phone: '11988887777', birthDate: '1990-05-20' },
  });
  check('cadastra cliente -> 200', res.status === 200, res.status);

  res = await req('POST', '/api/pdv/customers', {
    cookie: mgrCookie,
    body: { name: 'Marcos Souza', phone: '11999990000' },
  });
  check('cadastra segundo cliente -> 200', res.status === 200, res.status);
  const marcosId = (await res.json()).id;

  res = await req('GET', '/api/pdv/customers?q=mar', { cookie: mgrCookie });
  let custs = (await res.json()).customers;
  check('busca por "mar" acha os dois', custs.length === 2, JSON.stringify(custs.map(c => c.name)));

  res = await req('GET', '/api/pdv/customers?q=9888', { cookie: mgrCookie });
  custs = (await res.json()).customers;
  check('busca por telefone acha só a Maria', custs.length === 1 && custs[0].name === 'Maria Silva', JSON.stringify(custs));

  res = await req('GET', '/api/pdv/customers', { cookie: carlaCookie });
  check('funcionário comum também acessa clientes -> não 403', res.status !== 403, res.status);

  res = await req('GET', '/api/pdv/customers', { cookie: joaoCookie });
  check('sessão revogada não acessa clientes -> 401', res.status === 401, res.status);

  res = await req('PUT', `/api/pdv/customers/${marcosId}`, {
    cookie: mgrCookie,
    body: { name: 'Marcos Souza Jr.', phone: '11999990000', birthDate: '1985-01-01' },
  });
  check('edita cliente -> 200', res.status === 200, res.status);
  const marcosRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(marcosId);
  check('edição persistiu o novo nome', marcosRow.name === 'Marcos Souza Jr.', marcosRow.name);

  // --------------------------------------------------- regressão: /api/menu
  // A migração mexeu na tabela items (price_cents); o endpoint público de
  // menu não deve notar diferença nenhuma.
  db.prepare(`INSERT INTO sections (id,title,sort_order) VALUES ('drinks','Drinks Brisa',0)`).run();
  db.prepare(`INSERT INTO groups (id,section_id,title,sort_order) VALUES ('g1','drinks','Gin',0)`).run();
  db.prepare(`INSERT INTO items (id,group_id,name,price,active,sort_order) VALUES ('i1','g1','Gin Eternity','R$15,00',1,0)`).run();
  res = await req('GET', '/api/menu');
  const menu = await res.json();
  check('/api/menu segue funcionando após a migração',
    res.status === 200 && menu.sections[0].groups[0].items[0].price === 'R$15,00',
    JSON.stringify(menu));

  // ---------------------------------------------------- catálogo p/ lançar
  // Um item de cada setor, com price_cents já preenchido (não depende do
  // backfill da migração, que já rodou antes dessas linhas existirem).
  db.prepare(`INSERT INTO groups (id,section_id,title,sector,sort_order) VALUES ('g_tab','drinks','Narguilé','tabacaria',1)`).run();
  db.prepare(`INSERT INTO items (id,group_id,name,price,price_cents,active,sort_order) VALUES ('i_gin','g1','Gin Eternity 2','R$15,00',1500,1,1)`).run();
  db.prepare(`INSERT INTO items (id,group_id,name,price,price_cents,active,sort_order) VALUES ('i_rosh','g_tab','Rosh','R$20,00',2000,1,0)`).run();
  db.prepare(`INSERT INTO items (id,group_id,name,price,active,sort_order) VALUES ('i_semcents','g1','Sem preço em centavos','R$0,00',2,1)`).run();

  res = await req('GET', '/api/pdv/catalog', { cookie: mgrCookie });
  const catalog = await res.json();
  const ginGroup = catalog.sections.flatMap(s => s.groups).find(g => g.id === 'g1');
  check('catálogo traz o setor do grupo', ginGroup.sector === 'bar_cozinha', ginGroup.sector);
  const catalogItemIds = catalog.sections.flatMap(s => s.groups).flatMap(g => g.items).map(i => i.id);
  check('item sem price_cents não aparece pro garçom lançar', !catalogItemIds.includes('i_semcents'), catalogItemIds);

  // -------------------------------------------------------------- comandas
  res = await req('POST', '/api/pdv/tabs', { cookie: carlaCookie, body: { label: 'Mesa 7' } });
  check('garçom abre comanda -> 200', res.status === 200, res.status);
  const tabId = (await res.json()).id;

  res = await req('POST', `/api/pdv/tabs/${tabId}/items`, { cookie: carlaCookie, body: { itemId: 'i_gin', qty: 2 } });
  check('lança 2 Gin Eternity -> 200', res.status === 200, res.status);
  res = await req('POST', `/api/pdv/tabs/${tabId}/items`, { cookie: carlaCookie, body: { itemId: 'i_rosh' } });
  check('lança 1 Rosh -> 200', res.status === 200, res.status);

  res = await req('GET', `/api/pdv/tabs/${tabId}`, { cookie: mgrCookie });
  let detail = await res.json();
  check('total da comanda = 2×1500 + 2000', detail.totalCents === 5000, detail.totalCents);
  check('cada item leva o nome do garçom', detail.items.every(i => i.waiter_name === 'Carla Garçonete'), JSON.stringify(detail.items.map(i => i.waiter_name)));
  const ginLineId = detail.items.find(i => i.item_id === 'i_gin').id;
  const roshLineId = detail.items.find(i => i.item_id === 'i_rosh').id;

  // ------------------------------------------------------------- setores
  res = await req('GET', '/api/pdv/sector/bar_cozinha', { cookie: mgrCookie });
  let sectorItems = (await res.json()).items;
  check('fila do bar mostra só o Gin, não o Rosh', sectorItems.length === 1 && sectorItems[0].item_id === 'i_gin', JSON.stringify(sectorItems));
  check('fila do bar leva o nome da comanda', sectorItems[0].tab_label === 'Mesa 7', sectorItems[0].tab_label);

  res = await req('GET', '/api/pdv/sector/tabacaria', { cookie: mgrCookie });
  sectorItems = (await res.json()).items;
  check('fila da tabacaria mostra só o Rosh', sectorItems.length === 1 && sectorItems[0].item_id === 'i_rosh', JSON.stringify(sectorItems));

  // ------------------------------------------------- fila de impressão
  res = await req('GET', '/api/pdv/sector/bar_cozinha/print-queue', { cookie: mgrCookie });
  let printQueue = (await res.json()).items;
  check('fila de impressão do bar traz o Gin, ainda não impresso', printQueue.length === 1 && printQueue[0].item_id === 'i_gin', JSON.stringify(printQueue));

  res = await req('POST', `/api/pdv/tab-items/${ginLineId}/mark-printed`, { cookie: mgrCookie });
  check('marca o Gin como impresso -> 200', res.status === 200, res.status);

  res = await req('GET', '/api/pdv/sector/bar_cozinha/print-queue', { cookie: mgrCookie });
  printQueue = (await res.json()).items;
  check('Gin some da fila de impressão depois de marcado', printQueue.length === 0, JSON.stringify(printQueue));

  res = await req('GET', '/api/pdv/sector/bar_cozinha', { cookie: mgrCookie });
  check('mas o Gin continua na tela do setor (impressão e tela são coisas diferentes)',
    (await res.json()).items.some(i => i.item_id === 'i_gin'), 'sumiu da tela');

  // quadro de 4 colunas: novo -> em produção -> aguardando garçom -> entregue
  res = await req('PUT', `/api/pdv/tab-items/${ginLineId}`, { cookie: mgrCookie, body: { status: 'preparando' } });
  check('marca Gin como preparando -> 200', res.status === 200, res.status);

  res = await req('GET', '/api/pdv/sector/bar_cozinha', { cookie: mgrCookie });
  sectorItems = (await res.json()).items;
  check('Gin em preparando ainda aparece no quadro', sectorItems.find(i => i.item_id === 'i_gin')?.status === 'preparando', JSON.stringify(sectorItems));

  res = await req('PUT', `/api/pdv/tab-items/${ginLineId}`, { cookie: mgrCookie, body: { status: 'pronto' } });
  check('marca Gin como pronto -> 200', res.status === 200, res.status);

  res = await req('PUT', `/api/pdv/tab-items/${ginLineId}`, { cookie: mgrCookie, body: { status: 'entregue' } });
  check('marca Gin como entregue -> 200', res.status === 200, res.status);

  res = await req('GET', '/api/pdv/sector/bar_cozinha', { cookie: mgrCookie });
  sectorItems = (await res.json()).items;
  check('Gin entregue continua visível no quadro (coluna Entregue)',
    sectorItems.find(i => i.item_id === 'i_gin')?.status === 'entregue', JSON.stringify(sectorItems));

  // cancelar exige usuário e senha de gerência — o garçom não consegue sozinho
  res = await req('PUT', `/api/pdv/tab-items/${roshLineId}`, { cookie: carlaCookie, body: { status: 'cancelado' } });
  check('cancelar sem credencial de gerência -> 401', res.status === 401, res.status);

  res = await req('PUT', `/api/pdv/tab-items/${roshLineId}`, {
    cookie: carlaCookie, body: { status: 'cancelado', managerUsername: 'hercules', managerPassword: 'senha-errada' },
  });
  check('cancelar com senha de gerência errada -> 401', res.status === 401, res.status);

  res = await req('PUT', `/api/pdv/tab-items/${roshLineId}`, {
    cookie: carlaCookie, body: { status: 'cancelado', managerUsername: 'carla', managerPassword: 'senha123' },
  });
  check('credencial de quem não é gerente não autoriza -> 401', res.status === 401, res.status);

  res = await req('PUT', `/api/pdv/tab-items/${roshLineId}`, {
    cookie: carlaCookie, body: { status: 'cancelado', managerUsername: 'hercules', managerPassword: 'senhaforte1' },
  });
  check('cancela o Rosh com senha de gerência correta -> 200', res.status === 200, res.status);

  res = await req('GET', '/api/pdv/sector/tabacaria', { cookie: mgrCookie });
  check('Rosh cancelado nunca aparece no quadro', !(await res.json()).items.some(i => i.item_id === 'i_rosh'), 'apareceu cancelado');

  // item cancelado não conta no total
  res = await req('GET', `/api/pdv/tabs/${tabId}`, { cookie: mgrCookie });
  detail = await res.json();
  check('total recalcula sem o item cancelado', detail.totalCents === 3000, detail.totalCents);
  const roshRow = db.prepare('SELECT canceled_by FROM tab_items WHERE id = ?').get(roshLineId);
  check('fica registrado qual gerente autorizou o cancelamento', roshRow.canceled_by === managerId, roshRow.canceled_by);

  // ------------------------------------------------ transferência (renomear)
  res = await req('PUT', `/api/pdv/tabs/${tabId}`, { cookie: carlaCookie, body: { label: 'Hércules' } });
  check('transferir comanda (renomear) -> 200', res.status === 200, res.status);
  res = await req('GET', `/api/pdv/tabs/${tabId}`, { cookie: mgrCookie });
  detail = await res.json();
  check('histórico de itens sobrevive à transferência', detail.items.length === 2, detail.items.length);

  // --------------------------------------------------- lista de comandas
  res = await req('GET', '/api/pdv/tabs', { cookie: mgrCookie });
  let openTabs = (await res.json()).tabs;
  check('comanda aberta aparece na listagem com o total certo',
    openTabs.some(t => t.id === tabId && t.totalCents === 3000), JSON.stringify(openTabs));

  // ------------------------------------------------- pagamento parcial por item
  res = await req('POST', `/api/pdv/tabs/${tabId}/payments`, {
    cookie: carlaCookie, body: { tabItemIds: [roshLineId], method: 'pix' },
  });
  check('não cobra item cancelado -> 400', res.status === 400, res.status);

  res = await req('POST', `/api/pdv/tabs/${tabId}/payments`, {
    cookie: carlaCookie, body: { tabItemIds: [ginLineId], method: 'metodo-invalido' },
  });
  check('forma de pagamento inválida -> 400', res.status === 400, res.status);

  res = await req('POST', `/api/pdv/tabs/${tabId}/payments`, {
    cookie: carlaCookie, body: { tabItemIds: [ginLineId], method: 'pix', payerName: 'Cliente A' },
  });
  check('paga o Gin via pix -> 200', res.status === 200, res.status);
  let payBody = await res.json();
  check('valor do pagamento calculado a partir do item (não confiado do cliente)', payBody.amountCents === 3000, payBody.amountCents);

  res = await req('GET', `/api/pdv/tabs/${tabId}`, { cookie: mgrCookie });
  detail = await res.json();
  check('pendingCents zera depois do pagamento', detail.pendingCents === 0, detail.pendingCents);
  check('paidCents reflete o pagamento', detail.paidCents === 3000, detail.paidCents);
  check('item pago aparece marcado', detail.items.find(i => i.id === ginLineId).paid === true, JSON.stringify(detail.items));

  res = await req('POST', `/api/pdv/tabs/${tabId}/payments`, {
    cookie: carlaCookie, body: { tabItemIds: [ginLineId], method: 'dinheiro' },
  });
  check('não paga o mesmo item duas vezes -> 400', res.status === 400, res.status);

  res = await req('PUT', `/api/pdv/tab-items/${ginLineId}`, { cookie: carlaCookie, body: { status: 'cancelado' } });
  check('não cancela item já pago -> 400', res.status === 400, res.status);
  res = await req('PUT', `/api/pdv/tab-items/${ginLineId}`, { cookie: carlaCookie, body: { qty: 5 } });
  check('não muda quantidade de item já pago -> 400', res.status === 400, res.status);

  // ------------------------------------------------------- fechar comanda
  res = await req('POST', `/api/pdv/tabs/${tabId}/close`, { cookie: carlaCookie });
  check('fecha comanda com saldo zerado -> 200', res.status === 200, res.status);

  res = await req('POST', `/api/pdv/tabs/${tabId}/close`, { cookie: carlaCookie });
  check('não fecha de novo uma comanda já fechada -> 400', res.status === 400, res.status);

  // uma comanda nova, só pra provar que fechar com saldo pendente é barrado
  res = await req('POST', '/api/pdv/tabs', { cookie: carlaCookie, body: { label: 'Mesa 9' } });
  const tab2Id = (await res.json()).id;
  await req('POST', `/api/pdv/tabs/${tab2Id}/items`, { cookie: carlaCookie, body: { itemId: 'i_gin' } });
  res = await req('POST', `/api/pdv/tabs/${tab2Id}/close`, { cookie: carlaCookie });
  check('não fecha comanda com saldo pendente -> 400', res.status === 400, res.status);

  // ---------------------------------------------- comanda fechada é travada
  res = await req('POST', `/api/pdv/tabs/${tabId}/items`, { cookie: carlaCookie, body: { itemId: 'i_gin' } });
  check('não lança item em comanda fechada -> 400', res.status === 400, res.status);
  res = await req('PUT', `/api/pdv/tabs/${tabId}`, { cookie: carlaCookie, body: { label: 'Outro nome' } });
  check('não transfere comanda fechada -> 400', res.status === 400, res.status);
  res = await req('POST', `/api/pdv/tabs/${tabId}/payments`, {
    cookie: carlaCookie, body: { tabItemIds: [ginLineId], method: 'pix' },
  });
  check('não lança pagamento em comanda fechada -> 400', res.status === 400, res.status);

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
