// Regression test for the admin (cardápio) API routes, focado na
// reordenação de categorias e produtos — a única parte nova.
//
// Run with:  node test/admin.test.mjs
//
// Mesmo padrão dos outros testes: SQLite real (node:sqlite), não mock.

import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { hashPassword } from '../src/auth.js';

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

const db = new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE sections (id TEXT PRIMARY KEY, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE groups (id TEXT PRIMARY KEY, section_id TEXT NOT NULL, title TEXT NOT NULL,
  unit TEXT, note TEXT, keywords TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE items (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL,
  unit TEXT, price TEXT NOT NULL, note TEXT, tags TEXT, active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE admin_users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE admin_sessions (token TEXT PRIMARY KEY, admin_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE login_attempts (username TEXT PRIMARY KEY, fail_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT);
`);

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
    new Request('https://brisaloungebar.com.br' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    env, {}
  );
}
function cookieFrom(res) {
  return (res.headers.get('Set-Cookie') || '').split(';')[0];
}
function order(rows) {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order).map(r => r.id);
}

async function main() {
  db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (?,?,?)')
    .run('adm_1', 'brisa', await hashPassword('senhaadmin'));

  let res = await req('POST', '/api/admin/login', { body: { username: 'brisa', password: 'senhaadmin' } });
  check('login do admin -> 200', res.status === 200, res.status);
  const cookie = cookieFrom(res);

  // ---------------------------------------------------------------- seed
  db.exec(`
    INSERT INTO sections (id,title,sort_order) VALUES ('sec_a','Drinks',0),('sec_b','Bebidas',1),('sec_c','Comidas',2);
    INSERT INTO groups (id,section_id,title,sort_order) VALUES
      ('g_a1','sec_a','Caipirinhas',0),('g_a2','sec_a','Gin',1),
      ('g_b1','sec_b','Cerveja',0);
    INSERT INTO items (id,group_id,name,price,sort_order) VALUES
      ('i_1','g_a1','Caipirinha Limão','R$20,00',0),
      ('i_2','g_a1','Caipirinha Morango','R$22,00',1),
      ('i_3','g_a1','Caipirinha Maracujá','R$22,00',2);
  `);

  // ------------------------------------------------------- reordenar seções
  res = await req('PUT', '/api/admin/sections/sec_b/move', { cookie, body: { direction: 'up' } });
  check('move seção pra cima -> 200', res.status === 200, res.status);
  let body = await res.json();
  check('reporta moved:true', body.moved === true, JSON.stringify(body));

  let secs = (await db.prepare('SELECT id, sort_order FROM sections').all());
  check('Bebidas trocou de lugar com Drinks', order(secs)[0] === 'sec_b' && order(secs)[1] === 'sec_a', order(secs));

  res = await req('PUT', '/api/admin/sections/sec_b/move', { cookie, body: { direction: 'up' } });
  body = await res.json();
  check('seção já na ponta não move (moved:false, não é erro)', res.status === 200 && body.moved === false, JSON.stringify(body));

  res = await req('PUT', '/api/admin/sections/sec_x/move', { cookie, body: { direction: 'up' } });
  check('seção inexistente -> 404', res.status === 404, res.status);

  res = await req('PUT', '/api/admin/sections/sec_a/move', { cookie, body: { direction: 'lateral' } });
  check('direção inválida -> 400', res.status === 400, res.status);

  // -------------------------------------------------- reordenar grupos (com escopo)
  res = await req('PUT', '/api/admin/groups/g_a2/move', { cookie, body: { direction: 'up' } });
  check('move grupo dentro da seção -> 200', res.status === 200, res.status);
  let groupsA = order(await db.prepare("SELECT id, sort_order FROM groups WHERE section_id='sec_a'").all());
  check('Gin passou na frente de Caipirinhas', groupsA[0] === 'g_a2' && groupsA[1] === 'g_a1', groupsA);

  // grupo de outra seção não interfere na ordem — g_b1 é o único da sec_b,
  // então tentar mover não deve alterar nada em sec_a
  res = await req('PUT', '/api/admin/groups/g_b1/move', { cookie, body: { direction: 'down' } });
  body = await res.json();
  check('grupo sozinho na própria seção não tem vizinho -> moved:false', body.moved === false, JSON.stringify(body));

  // -------------------------------------------------- reordenar itens (com escopo)
  res = await req('PUT', '/api/admin/items/i_3/move', { cookie, body: { direction: 'up' } });
  check('move item pra cima -> 200', res.status === 200, res.status);
  res = await req('PUT', '/api/admin/items/i_3/move', { cookie, body: { direction: 'up' } });
  check('move item pra cima de novo -> 200', res.status === 200, res.status);
  let itemsA1 = order(await db.prepare("SELECT id, sort_order FROM items WHERE group_id='g_a1'").all());
  check('Maracujá foi parar em primeiro depois de duas subidas', itemsA1[0] === 'i_3', itemsA1);

  // ---------------------------------------------------- sem autenticação
  res = await req('PUT', '/api/admin/items/i_1/move', { body: { direction: 'up' } });
  check('mover sem login -> 401', res.status === 401, res.status);

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
