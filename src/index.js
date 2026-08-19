import {
  verifyPassword, createSession, getSessionAdmin, deleteSession,
  getCookie, sessionCookie, clearCookie,
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

/* ===================== ROUTING ===================== */

// Each subdomain serves a different page at its root. The bare domain
// (and www) falls through to the menu.
const SUBDOMAIN_HOME = {
  bio: '/bio.html',
  admin: '/admin.html',
  cardapio: '/index.html',
};

// Clean paths that work on every hostname, so links never depend on
// which subdomain the visitor happens to be on.
const PATH_ALIAS = {
  '/bio': '/bio.html',
  '/admin': '/admin.html',
  '/cardapio': '/index.html',
};

function resolveAsset(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/') {
    const sub = url.hostname.split('.')[0].toLowerCase();
    return SUBDOMAIN_HOME[sub] || null;
  }
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
