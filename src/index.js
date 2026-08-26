import {
  verifyPassword, createSession, getSessionAdmin, deleteSession,
  getCookie, sessionCookie, clearCookie,
  hashPassword, createEmployeeSession, getSessionEmployee, deleteEmployeeSession,
  pdvCookieName, pdvSessionCookie, clearPdvCookie,
} from './auth.js';

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function unauthorized() {
  return json({ error: 'Não autenticado' }, { status: 401 });
}

function genId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function requireAdmin(request, env) {
  const token = getCookie(request, 'brisa_admin_session');
  return getSessionAdmin(env.DB, token);
}

async function requireEmployee(request, env, roles) {
  const token = getCookie(request, pdvCookieName());
  const employee = await getSessionEmployee(env.DB, token);
  if (!employee) return null;
  if (roles && !roles.includes(employee.role)) return null;
  return employee;
}

function forbidden() {
  return json({ error: 'Sem permissão para isso' }, { status: 403 });
}

const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const parts = r.pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);
    if (parts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        params[parts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (parts[i] !== pathParts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

/* ===================== PUBLIC: MENU ===================== */

route('GET', '/api/menu', async (request, env) => {
  const { results: sections } = await env.DB.prepare('SELECT * FROM sections ORDER BY sort_order').all();
  const { results: groups } = await env.DB.prepare('SELECT * FROM groups ORDER BY sort_order').all();
  const { results: items } = await env.DB.prepare('SELECT * FROM items WHERE active = 1 ORDER BY sort_order').all();

  const groupsBySection = {};
  for (const g of groups) {
    (groupsBySection[g.section_id] ||= []).push({
      title: g.title,
      unit: g.unit || undefined,
      note: g.note || undefined,
      keywords: g.keywords || undefined,
      items: [],
      _id: g.id,
    });
  }
  const groupById = {};
  for (const list of Object.values(groupsBySection)) {
    for (const g of list) groupById[g._id] = g;
  }
  for (const it of items) {
    const g = groupById[it.group_id];
    if (!g) continue;
    g.items.push({
      name: it.name,
      unit: it.unit || undefined,
      price: it.price,
      note: it.note || undefined,
      tags: it.tags || undefined,
    });
  }

  const out = {
    sections: sections.map(s => ({
      id: s.id,
      title: s.title,
      groups: (groupsBySection[s.id] || []).map(({ _id, ...g }) => g),
    })),
  };
  return json(out, { headers: { 'Cache-Control': 'no-store' } });
});

/* ===================== ADMIN AUTH ===================== */

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

route('POST', '/api/admin/login', async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return badRequest('Informe usuário e senha');

  const attempt = await env.DB.prepare('SELECT * FROM login_attempts WHERE username = ?').bind(username).first();
  if (attempt && attempt.locked_until && new Date(attempt.locked_until) > new Date()) {
    return json({ error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }, { status: 429 });
  }

  const admin = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
  const ok = admin && (await verifyPassword(password, admin.password_hash));
  if (!ok) {
    const failCount = (attempt ? attempt.fail_count : 0) + 1;
    const lockedUntil = failCount >= LOGIN_MAX_ATTEMPTS
      ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString()
      : null;
    await env.DB.prepare(
      `INSERT INTO login_attempts (username, fail_count, locked_until) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET fail_count = excluded.fail_count, locked_until = excluded.locked_until`
    ).bind(username, failCount, lockedUntil).run();
    return json({ error: 'Usuário ou senha inválidos' }, { status: 401 });
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE username = ?').bind(username).run();
  const { token, expiresAt } = await createSession(env.DB, admin.id);
  return json({ ok: true, username: admin.username }, {
    headers: { 'Set-Cookie': sessionCookie(token, expiresAt) },
  });
});

route('POST', '/api/admin/logout', async (request, env) => {
  const token = getCookie(request, 'brisa_admin_session');
  await deleteSession(env.DB, token);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
});

route('GET', '/api/admin/me', async (request, env) => {
  const admin = await requireAdmin(request, env);
  if (!admin) return unauthorized();
  return json({ username: admin.username });
});

/* ===================== ADMIN: MENU EDITING ===================== */

route('GET', '/api/admin/menu', async (request, env) => {
  if (!(await requireAdmin(request, env))) return unauthorized();
  const { results: sections } = await env.DB.prepare('SELECT * FROM sections ORDER BY sort_order').all();
  const { results: groups } = await env.DB.prepare('SELECT * FROM groups ORDER BY sort_order').all();
  const { results: items } = await env.DB.prepare('SELECT * FROM items ORDER BY sort_order').all();

  const groupsBySection = {};
  for (const g of groups) (groupsBySection[g.section_id] ||= []).push({ ...g, items: [] });
  const groupById = {};
  for (const list of Object.values(groupsBySection)) for (const g of list) groupById[g.id] = g;
  for (const it of items) groupById[it.group_id]?.items.push(it);

  return json({
    sections: sections.map(s => ({ ...s, groups: groupsBySection[s.id] || [] })),
  });
});

route('PUT', '/api/admin/items/:id', async (request, env, params) => {
  if (!(await requireAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  if (!b.name || !b.price) return badRequest('Informe nome e preço');
  await env.DB.prepare(
    'UPDATE items SET name=?, unit=?, price=?, note=?, tags=?, active=? WHERE id=?'
  ).bind(
    b.name, b.unit || '', b.price, b.note || '', b.tags || '',
    b.active === false ? 0 : 1, params.id
  ).run();
  return json({ ok: true });
});

route('POST', '/api/admin/items', async (request, env) => {
  if (!(await requireAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  if (!b.name || !b.price || !b.groupId) return badRequest('Informe grupo, nome e preço');
  const group = await env.DB.prepare('SELECT id FROM groups WHERE id = ?').bind(b.groupId).first();
  if (!group) return badRequest('Grupo inválido');
  const { results } = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM items WHERE group_id = ?').bind(b.groupId).all();
  const sortOrder = (results[0]?.m ?? -1) + 1;
  const id = genId('item');
  await env.DB.prepare(
    'INSERT INTO items (id, group_id, name, unit, price, note, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, b.groupId, b.name, b.unit || '', b.price, b.note || '', b.tags || '', sortOrder).run();
  return json({ id });
});

route('DELETE', '/api/admin/items/:id', async (request, env, params) => {
  if (!(await requireAdmin(request, env))) return unauthorized();
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: LOGIN DE FUNCIONÁRIO ===================== */
// Mesma trava de tentativas do admin, mas contra a tabela de funcionários —
// login_attempts é compartilhada por username, então um usuário não pode
// ser admin e funcionário ao mesmo tempo sob o mesmo nome.

route('POST', '/api/pdv/login', async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return badRequest('Informe usuário e senha');

  const attempt = await env.DB.prepare('SELECT * FROM login_attempts WHERE username = ?').bind(username).first();
  if (attempt && attempt.locked_until && new Date(attempt.locked_until) > new Date()) {
    return json({ error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }, { status: 429 });
  }

  const employee = await env.DB.prepare('SELECT * FROM employees WHERE username = ? AND active = 1').bind(username).first();
  const ok = employee && (await verifyPassword(password, employee.password_hash));
  if (!ok) {
    const failCount = (attempt ? attempt.fail_count : 0) + 1;
    const lockedUntil = failCount >= LOGIN_MAX_ATTEMPTS
      ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000).toISOString()
      : null;
    await env.DB.prepare(
      `INSERT INTO login_attempts (username, fail_count, locked_until) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET fail_count = excluded.fail_count, locked_until = excluded.locked_until`
    ).bind(username, failCount, lockedUntil).run();
    return json({ error: 'Usuário ou senha inválidos' }, { status: 401 });
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE username = ?').bind(username).run();
  const { token, expiresAt } = await createEmployeeSession(env.DB, employee.id);
  return json({ ok: true, name: employee.name, role: employee.role }, {
    headers: { 'Set-Cookie': pdvSessionCookie(token, expiresAt) },
  });
});

route('POST', '/api/pdv/logout', async (request, env) => {
  const token = getCookie(request, pdvCookieName());
  await deleteEmployeeSession(env.DB, token);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearPdvCookie() } });
});

route('GET', '/api/pdv/me', async (request, env) => {
  const employee = await requireEmployee(request, env);
  if (!employee) return unauthorized();
  return json({ id: employee.id, name: employee.name, username: employee.username, role: employee.role });
});

/* ===================== PDV: FUNCIONÁRIOS (só gerente) ===================== */
// Sem DELETE de propósito: um funcionário que sai é desativado, não apagado —
// os pedidos que ele lançou continuam com o nome dele no histórico.

route('GET', '/api/pdv/employees', async (request, env) => {
  const me = await requireEmployee(request, env, ['gerente']);
  if (!me) return forbidden();
  const { results } = await env.DB.prepare(
    'SELECT id, name, username, role, active, created_at FROM employees ORDER BY active DESC, name'
  ).all();
  return json({ employees: results });
});

route('POST', '/api/pdv/employees', async (request, env) => {
  const me = await requireEmployee(request, env, ['gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  const username = (b.username || '').trim().toLowerCase();
  const password = b.password || '';
  const role = b.role;
  if (!name || !username || !password) return badRequest('Informe nome, usuário e senha');
  if (password.length < 6) return badRequest('Senha precisa ter pelo menos 6 caracteres');
  if (!['garcom', 'caixa', 'gerente'].includes(role)) return badRequest('Cargo inválido');

  const clash = await env.DB.prepare('SELECT id FROM employees WHERE username = ?').bind(username).first();
  if (clash) return badRequest('Já existe um funcionário com esse usuário');

  const id = genId('emp');
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO employees (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, username, passwordHash, role).run();
  return json({ id });
});

route('PUT', '/api/pdv/employees/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env, ['gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  const role = b.role;
  if (!name) return badRequest('Informe o nome');
  if (!['garcom', 'caixa', 'gerente'].includes(role)) return badRequest('Cargo inválido');
  const active = b.active === false ? 0 : 1;

  if (b.password) {
    if (b.password.length < 6) return badRequest('Senha precisa ter pelo menos 6 caracteres');
    const passwordHash = await hashPassword(b.password);
    await env.DB.prepare('UPDATE employees SET name=?, role=?, active=?, password_hash=? WHERE id=?')
      .bind(name, role, active, passwordHash, params.id).run();
  } else {
    await env.DB.prepare('UPDATE employees SET name=?, role=?, active=? WHERE id=?')
      .bind(name, role, active, params.id).run();
  }
  return json({ ok: true });
});

/* ===================== PDV: CLIENTES ===================== */
// Qualquer funcionário logado pode ver e cadastrar — é o garçom abrindo
// comanda que mais vai usar isso, não só o gerente.

route('GET', '/api/pdv/customers', async (request, env, params, ctx) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const rows = q
    ? await env.DB.prepare(
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 30'
      ).bind(`%${q}%`, `%${q}%`).all()
    : await env.DB.prepare('SELECT * FROM customers ORDER BY name LIMIT 100').all();
  return json({ customers: rows.results });
});

route('POST', '/api/pdv/customers', async (request, env) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return badRequest('Informe o nome');
  const id = genId('cust');
  await env.DB.prepare(
    'INSERT INTO customers (id, name, phone, birth_date, note) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, (b.phone || '').trim(), b.birthDate || null, (b.note || '').trim()).run();
  return json({ id });
});

route('PUT', '/api/pdv/customers/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return badRequest('Informe o nome');
  await env.DB.prepare(
    'UPDATE customers SET name=?, phone=?, birth_date=?, note=? WHERE id=?'
  ).bind(name, (b.phone || '').trim(), b.birthDate || null, (b.note || '').trim(), params.id).run();
  return json({ ok: true });
});

/* ===================== ROUTING ===================== */

// The asset store already answers /bio and /admin with bio.html and
// admin.html, and / with index.html, so those need no help here. Only
// /cardapio has no file of its own; point it at the root rather than at
// /index.html, because asking for the .html form earns a redirect back
// to the extensionless one.
const PATH_ALIAS = {
  '/cardapio': '/',
};

function resolveAsset(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return PATH_ALIAS[path] || null;
}

/* ===================== ENTRY ===================== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      const asset = resolveAsset(url);
      if (asset) {
        const rewritten = new URL(request.url);
        rewritten.pathname = asset;
        return env.ASSETS.fetch(new Request(rewritten, request));
      }
      return env.ASSETS.fetch(request);
    }

    const match = matchRoute(request.method, url.pathname);
    if (!match) return json({ error: 'Não encontrado' }, { status: 404 });
    try {
      return await match.handler(request, env, match.params, ctx);
    } catch (err) {
      return json({ error: 'Erro interno', detail: String((err && err.message) || err) }, { status: 500 });
    }
  },
};
