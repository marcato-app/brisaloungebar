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

  res = await req('GET', '/api/pdv/customers', { cookie: joaoCookie === undefined ? mgrCookie : joaoCookie });
  check('funcionário comum também acessa clientes -> não 403', res.status !== 403, res.status);

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

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
