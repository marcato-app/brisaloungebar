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

/* ===================== PDV: ESTOQUE (contagem manual) ===================== */
// Sem baixa automática por venda, de propósito (ver migrations/002_pdv.sql).
// Só caixa e gerente mexem — quem passa o dia lançando pedido não é quem
// confere prateleira.

route('GET', '/api/pdv/stock', async (request, env) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const { results } = await env.DB.prepare('SELECT * FROM stock_items ORDER BY name').all();
  return json({ stock: results });
});

route('POST', '/api/pdv/stock', async (request, env) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return badRequest('Informe o nome');
  const qty = Number(b.qty);
  if (!Number.isFinite(qty) || qty < 0) return badRequest('Quantidade inválida');
  let minQty = null;
  if (b.minQty !== undefined && b.minQty !== null && b.minQty !== '') {
    minQty = Number(b.minQty);
    if (!Number.isFinite(minQty)) return badRequest('Quantidade mínima inválida');
  }
  const id = genId('stock');
  await env.DB.prepare(
    'INSERT INTO stock_items (id, name, unit, qty, min_qty) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, (b.unit || '').trim() || null, qty, minQty).run();
  return json({ id });
});

route('PUT', '/api/pdv/stock/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return badRequest('Informe o nome');
  const qty = Number(b.qty);
  if (!Number.isFinite(qty) || qty < 0) return badRequest('Quantidade inválida');
  let minQty = null;
  if (b.minQty !== undefined && b.minQty !== null && b.minQty !== '') {
    minQty = Number(b.minQty);
    if (!Number.isFinite(minQty)) return badRequest('Quantidade mínima inválida');
  }
  const current = await env.DB.prepare('SELECT id FROM stock_items WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'Item de estoque não encontrado' }, { status: 404 });
  await env.DB.prepare(
    `UPDATE stock_items SET name=?, unit=?, qty=?, min_qty=?, updated_at=datetime('now') WHERE id=?`
  ).bind(name, (b.unit || '').trim() || null, qty, minQty, params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: FINANCEIRO (despesas) ===================== */
// Não é contabilidade, é controle de vencimento — boletos e contas fixas do
// bar. Dinheiro saindo é informação de caixa/gerente, não de garçom.

const EXPENSE_STATUS_FILTERS = ['aberta', 'paga', 'all'];

route('GET', '/api/pdv/expenses', async (request, env) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'aberta';
  if (!EXPENSE_STATUS_FILTERS.includes(status)) return badRequest('Status inválido');
  let query = 'SELECT * FROM expenses';
  if (status === 'aberta') query += ' WHERE paid_at IS NULL';
  else if (status === 'paga') query += ' WHERE paid_at IS NOT NULL';
  query += status === 'paga' ? ' ORDER BY paid_at DESC' : ' ORDER BY (due_date IS NULL), due_date';
  const { results } = await env.DB.prepare(query).all();
  return json({ expenses: results });
});

route('POST', '/api/pdv/expenses', async (request, env) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const description = (b.description || '').trim();
  const amountCents = Number(b.amountCents);
  if (!description) return badRequest('Informe a descrição');
  if (!Number.isInteger(amountCents) || amountCents <= 0) return badRequest('Valor inválido');
  const id = genId('exp');
  await env.DB.prepare(
    'INSERT INTO expenses (id, description, amount_cents, due_date, recurring, category) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, description, amountCents, b.dueDate || null, b.recurring ? 1 : 0, (b.category || '').trim() || null).run();
  return json({ id });
});

route('PUT', '/api/pdv/expenses/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env, ['caixa', 'gerente']);
  if (!me) return forbidden();
  const b = await request.json().catch(() => ({}));
  const description = (b.description || '').trim();
  const amountCents = Number(b.amountCents);
  if (!description) return badRequest('Informe a descrição');
  if (!Number.isInteger(amountCents) || amountCents <= 0) return badRequest('Valor inválido');
  const current = await env.DB.prepare('SELECT id FROM expenses WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'Despesa não encontrada' }, { status: 404 });
  // paid é um toggle: marcar não sobrescreve um paid_at que já existia (então
  // reabrir e marcar de novo não perde a data original de quando foi paga de
  // fato), e desmarcar sempre limpa.
  await env.DB.prepare(
    `UPDATE expenses SET description=?, amount_cents=?, due_date=?, recurring=?, category=?,
       paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, datetime('now')) ELSE NULL END
     WHERE id=?`
  ).bind(description, amountCents, b.dueDate || null, b.recurring ? 1 : 0, (b.category || '').trim() || null, b.paid ? 1 : 0, params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: CATÁLOGO PARA LANÇAMENTO ===================== */
// Diferente de /api/menu (texto pronto pra exibir), isto devolve o que o
// garçom precisa pra lançar: id do item, preço em centavos e o setor do
// grupo — é daqui que tab_items copia name/unit_price_cents/sector.

route('GET', '/api/pdv/catalog', async (request, env) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const { results: sections } = await env.DB.prepare('SELECT * FROM sections ORDER BY sort_order').all();
  const { results: groups } = await env.DB.prepare('SELECT * FROM groups ORDER BY sort_order').all();
  const { results: items } = await env.DB.prepare('SELECT * FROM items WHERE active = 1 ORDER BY sort_order').all();

  const groupsBySection = {};
  for (const g of groups) (groupsBySection[g.section_id] ||= []).push({ ...g, items: [] });
  const groupById = {};
  for (const list of Object.values(groupsBySection)) for (const g of list) groupById[g.id] = g;
  for (const it of items) {
    const g = groupById[it.group_id];
    if (!g || it.price_cents == null) continue;
    g.items.push({ id: it.id, name: it.name, unit: it.unit || undefined, priceCents: it.price_cents });
  }

  return json({
    sections: sections.map(s => ({
      id: s.id,
      title: s.title,
      groups: (groupsBySection[s.id] || []).map(g => ({
        id: g.id, title: g.title, sector: g.sector, items: g.items,
      })),
    })),
  });
});

/* ===================== PDV: COMANDAS ===================== */

async function tabWithTotal(env, tabId) {
  const tab = await env.DB.prepare(
    `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
       FROM tabs t LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.id = ?`
  ).bind(tabId).first();
  if (!tab) return null;
  const { results: items } = await env.DB.prepare(
    'SELECT * FROM tab_items WHERE tab_id = ? ORDER BY created_at'
  ).bind(tabId).all();
  const { results: payments } = await env.DB.prepare(
    'SELECT * FROM payments WHERE tab_id = ? ORDER BY paid_at'
  ).bind(tabId).all();
  const { results: allocations } = await env.DB.prepare(
    `SELECT pa.tab_item_id FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id WHERE p.tab_id = ?`
  ).bind(tabId).all();
  const paidItemIds = new Set(allocations.map(a => a.tab_item_id));

  const itemsOut = items.map(i => ({ ...i, paid: paidItemIds.has(i.id) }));
  const totalCents = itemsOut
    .filter(i => i.status !== 'cancelado')
    .reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0);
  // A soma dos pagamentos, não a soma dos itens marcados como pagos — é o
  // dinheiro que de fato entrou, e as duas coisas deveriam sempre bater
  // porque o valor de cada pagamento já nasce calculado a partir dos itens
  // que ele cobre (veja POST /tabs/:id/payments).
  const paidCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);

  return { ...tab, items: itemsOut, payments, totalCents, paidCents, pendingCents: totalCents - paidCents };
}

route('POST', '/api/pdv/tabs', async (request, env) => {
  // Duas portas pra abrir comanda: tocar numa mesa do mapa (manda
  // tableNumber, o label "Mesa N" nasce sozinho) ou "Balcão/Avulso" (manda
  // label, sem mesa nenhuma — tableNumber fica null de propósito).
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));

  let tableNumber = null;
  if (b.tableNumber !== undefined && b.tableNumber !== null && b.tableNumber !== '') {
    tableNumber = Number(b.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) return badRequest('Número de mesa inválido');
  }

  const label = (b.label || '').trim() || (tableNumber ? `Mesa ${tableNumber}` : '');
  if (!label) return badRequest('Dê um nome pra comanda (mesa, cliente...)');

  if (tableNumber !== null) {
    const occupied = await env.DB.prepare(
      `SELECT id FROM tabs WHERE table_number = ? AND status = 'aberta'`
    ).bind(tableNumber).first();
    if (occupied) return badRequest('Essa mesa já está ocupada');
  }

  const id = genId('tab');
  await env.DB.prepare(
    'INSERT INTO tabs (id, label, customer_id, opened_by, table_number) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, label, b.customerId || null, me.id, tableNumber).run();
  return json({ id });
});

route('GET', '/api/pdv/tabs', async (request, env) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'aberta';
  const { results: tabs } = status === 'all'
    ? await env.DB.prepare(
        `SELECT t.*, c.name AS customer_name FROM tabs t
          LEFT JOIN customers c ON c.id = t.customer_id ORDER BY t.opened_at DESC LIMIT 100`
      ).all()
    : await env.DB.prepare(
        `SELECT t.*, c.name AS customer_name FROM tabs t
          LEFT JOIN customers c ON c.id = t.customer_id
         WHERE t.status = ? ORDER BY t.opened_at DESC`
      ).bind(status).all();

  // Total, pago e "tudo entregue?" por comanda, num só round-trip cada em
  // vez de N+1 — é o que o mapa de mesas precisa pra colorir cada mesa
  // (ocupada = ainda tem item a caminho; aguardando pagamento = já entregou
  // tudo, só falta fechar a conta).
  const { results: totals } = await env.DB.prepare(
    `SELECT tab_id, SUM(unit_price_cents * qty) AS total_cents, COUNT(*) AS item_count,
            SUM(CASE WHEN status != 'entregue' THEN 1 ELSE 0 END) AS not_delivered
       FROM tab_items WHERE status != 'cancelado' GROUP BY tab_id`
  ).all();
  const { results: paidRows } = await env.DB.prepare(
    `SELECT tab_id, SUM(amount_cents) AS paid_cents FROM payments GROUP BY tab_id`
  ).all();
  const totalByTab = Object.fromEntries(totals.map(t => [t.tab_id, t]));
  const paidByTab = Object.fromEntries(paidRows.map(p => [p.tab_id, p.paid_cents]));

  return json({
    tabs: tabs.map(t => {
      const agg = totalByTab[t.id];
      const totalCents = agg ? agg.total_cents : 0;
      const paidCents = paidByTab[t.id] || 0;
      const allDelivered = !!agg && agg.item_count > 0 && agg.not_delivered === 0;
      return { ...t, totalCents, paidCents, pendingCents: totalCents - paidCents, allDelivered };
    }),
  });
});

route('GET', '/api/pdv/tabs/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const tab = await tabWithTotal(env, params.id);
  if (!tab) return json({ error: 'Comanda não encontrada' }, { status: 404 });
  return json(tab);
});

route('PUT', '/api/pdv/tabs/:id', async (request, env, params) => {
  // Transferência de comanda: troca o titular (label / cliente), sem
  // mexer no histórico de itens e pagamentos — por decisão, não divide
  // a comanda em duas.
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const label = (b.label || '').trim();
  if (!label) return badRequest('Dê um nome pra comanda');
  const tab = await env.DB.prepare('SELECT status FROM tabs WHERE id = ?').bind(params.id).first();
  if (!tab) return json({ error: 'Comanda não encontrada' }, { status: 404 });
  if (tab.status !== 'aberta') return badRequest('Essa comanda já está fechada');
  await env.DB.prepare('UPDATE tabs SET label = ?, customer_id = ? WHERE id = ?')
    .bind(label, b.customerId || null, params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: LANÇAMENTO DE PEDIDO ===================== */
// O nome do garçom e o setor são copiados do catálogo/sessão no momento do
// lançamento, não referenciados ao vivo — é assim que a comanda de hoje não
// muda de valor se o cardápio for editado amanhã, e o histórico continua
// mostrando quem atendeu mesmo que o funcionário seja desligado depois.

route('POST', '/api/pdv/tabs/:id/items', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const qty = Number.isInteger(b.qty) && b.qty > 0 ? b.qty : 1;
  if (!b.itemId) return badRequest('Informe o item');

  const tab = await env.DB.prepare('SELECT status FROM tabs WHERE id = ?').bind(params.id).first();
  if (!tab) return json({ error: 'Comanda não encontrada' }, { status: 404 });
  if (tab.status !== 'aberta') return badRequest('Essa comanda já está fechada');

  const item = await env.DB.prepare(
    `SELECT i.name, i.price_cents, g.sector FROM items i
       JOIN groups g ON g.id = i.group_id
      WHERE i.id = ? AND i.active = 1`
  ).bind(b.itemId).first();
  if (!item || item.price_cents == null) return badRequest('Item inválido');

  const id = genId('ti');
  await env.DB.prepare(
    `INSERT INTO tab_items (id, tab_id, item_id, name, unit_price_cents, qty, sector, note, waiter_id, waiter_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, params.id, b.itemId, item.name, item.price_cents, qty, item.sector, (b.note || '').trim() || null, me.id, me.name).run();
  return json({ id });
});

route('PUT', '/api/pdv/tab-items/:id', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const current = await env.DB.prepare('SELECT * FROM tab_items WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'Item não encontrado' }, { status: 404 });

  const qty = b.qty !== undefined ? b.qty : current.qty;
  const status = b.status !== undefined ? b.status : current.status;
  if (!Number.isInteger(qty) || qty <= 0) return badRequest('Quantidade inválida');
  if (!['pendente', 'preparando', 'pronto', 'entregue', 'cancelado'].includes(status)) return badRequest('Status inválido');

  // Um item já pago tem seu valor travado num pagamento que já aconteceu.
  // Mudar a quantidade ou cancelar depois disso desencontraria o que foi
  // cobrado do que a comanda passa a valer — a preparação continua livre
  // pra mudar (pendente/preparando/entregue), só isso aqui é bloqueado.
  if (qty !== current.qty || status === 'cancelado') {
    const paid = await env.DB.prepare('SELECT 1 FROM payment_allocations WHERE tab_item_id = ?').bind(params.id).first();
    if (paid) return badRequest('Esse item já foi pago — não dá pra mudar quantidade ou cancelar');
  }

  // Cancelar um item só sai com usuário e senha de um gerente — é o controle
  // contra "cancela e embolsa" que todo bar de verdade precisa. Só cobra essa
  // autorização na transição PARA cancelado, não em toda edição de um item
  // que já estava cancelado antes.
  let canceledBy = current.canceled_by;
  if (status === 'cancelado' && current.status !== 'cancelado') {
    if (!b.managerUsername || !b.managerPassword) {
      return json({ error: 'Cancelar item exige usuário e senha de gerência' }, { status: 401 });
    }
    const manager = await env.DB.prepare(
      `SELECT * FROM employees WHERE username = ? AND role = 'gerente' AND active = 1`
    ).bind(b.managerUsername).first();
    const ok = manager && (await verifyPassword(b.managerPassword, manager.password_hash));
    if (!ok) return json({ error: 'Usuário ou senha de gerência inválidos' }, { status: 401 });
    canceledBy = manager.id;
  }

  await env.DB.prepare('UPDATE tab_items SET qty = ?, status = ?, canceled_by = ? WHERE id = ?')
    .bind(qty, status, canceledBy, params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: PAGAMENTO E FECHAMENTO ===================== */
// Pagamento parcial por item: quem paga escolhe quais linhas da comanda está
// cobrindo, não um valor solto. O valor do pagamento é sempre calculado a
// partir dos itens escolhidos — nunca aceito do cliente — porque é isso que
// garante que "quanto foi pago" e "o que foi pago" nunca se desencontrem.

const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'outro'];

route('POST', '/api/pdv/tabs/:id/payments', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const ids = [...new Set(Array.isArray(b.tabItemIds) ? b.tabItemIds.filter(Boolean) : [])];
  if (!ids.length) return badRequest('Selecione ao menos um item');
  if (!PAYMENT_METHODS.includes(b.method)) return badRequest('Forma de pagamento inválida');

  const tab = await env.DB.prepare('SELECT status FROM tabs WHERE id = ?').bind(params.id).first();
  if (!tab) return json({ error: 'Comanda não encontrada' }, { status: 404 });
  if (tab.status !== 'aberta') return badRequest('Essa comanda já está fechada');

  const placeholders = ids.map(() => '?').join(',');
  const { results: items } = await env.DB.prepare(
    `SELECT id, unit_price_cents, qty, status FROM tab_items WHERE tab_id = ? AND id IN (${placeholders})`
  ).bind(params.id, ...ids).all();
  if (items.length !== ids.length) return badRequest('Algum item não pertence a esta comanda');
  if (items.some(i => i.status === 'cancelado')) return badRequest('Não dá pra cobrar um item cancelado');

  const { results: already } = await env.DB.prepare(
    `SELECT tab_item_id FROM payment_allocations WHERE tab_item_id IN (${placeholders})`
  ).bind(...ids).all();
  if (already.length) return badRequest('Um desses itens já foi pago em outro lançamento');

  const amountCents = items.reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0);
  const paymentId = genId('pay');
  const stmts = [
    env.DB.prepare(
      'INSERT INTO payments (id, tab_id, amount_cents, method, payer_name, received_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(paymentId, params.id, amountCents, b.method, (b.payerName || '').trim() || null, me.id),
    ...ids.map(itemId =>
      env.DB.prepare('INSERT INTO payment_allocations (payment_id, tab_item_id) VALUES (?, ?)').bind(paymentId, itemId)
    ),
  ];
  // batch() roda tudo como uma unidade só: ou o pagamento e as alocações
  // entram juntos, ou nenhum entra — nunca um pagamento órfão sem saber
  // quais itens ele cobriu.
  await env.DB.batch(stmts);
  return json({ id: paymentId, amountCents });
});

route('POST', '/api/pdv/tabs/:id/close', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const tab = await tabWithTotal(env, params.id);
  if (!tab) return json({ error: 'Comanda não encontrada' }, { status: 404 });
  if (tab.status !== 'aberta') return badRequest('Essa comanda já está fechada');
  if (tab.pendingCents > 0) return badRequest('Ainda tem saldo pendente nessa comanda');
  await env.DB.prepare(
    `UPDATE tabs SET status = 'fechada', closed_at = datetime('now'), closed_by = ? WHERE id = ?`
  ).bind(me.id, params.id).run();
  return json({ ok: true });
});

/* ===================== PDV: TELAS DE SETOR ===================== */
// Bar/Cozinha e Tabacaria: qualquer funcionário logado pode ver a fila do
// setor — por decisão, sem login individual por estação. O gerente cria um
// usuário compartilhado pra cada estação na tela de Funcionários se quiser.

route('GET', '/api/pdv/sector/:sector', async (request, env, params) => {
  // Um quadro, quatro colunas: novo, em produção, aguardando garçom,
  // entregue. Cancelado nunca aparece aqui — foi anulado, não é mais pedido
  // de ninguém. O cliente decide como agrupar por status; aqui só filtra
  // o que ainda faz sentido mostrar num quadro ao vivo.
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  if (!['bar_cozinha', 'tabacaria'].includes(params.sector)) return badRequest('Setor inválido');
  const { results } = await env.DB.prepare(
    `SELECT ti.*, t.label AS tab_label FROM tab_items ti
       JOIN tabs t ON t.id = ti.tab_id
      WHERE ti.sector = ? AND ti.status != 'cancelado' AND t.status = 'aberta'
      ORDER BY ti.created_at`
  ).bind(params.sector).all();
  return json({ items: results });
});

/* ================== PDV: FILA DE IMPRESSÃO (ponte local) ================== */
// A tela de setor (acima) mostra tudo que está pendente/preparando, sempre.
// A fila de impressão é outra coisa: só o que ainda não saiu no papel — é
// nela que a máquina ligada na impressora física vai bater, marcar como
// impresso, e nunca mais ver de novo.

route('GET', '/api/pdv/sector/:sector/print-queue', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  if (!['bar_cozinha', 'tabacaria'].includes(params.sector)) return badRequest('Setor inválido');
  const { results } = await env.DB.prepare(
    `SELECT ti.*, t.label AS tab_label FROM tab_items ti
       JOIN tabs t ON t.id = ti.tab_id
      WHERE ti.sector = ? AND ti.printed_at IS NULL AND ti.status != 'cancelado' AND t.status = 'aberta'
      ORDER BY ti.created_at`
  ).bind(params.sector).all();
  return json({ items: results });
});

route('POST', '/api/pdv/tab-items/:id/mark-printed', async (request, env, params) => {
  const me = await requireEmployee(request, env);
  if (!me) return unauthorized();
  const current = await env.DB.prepare('SELECT id FROM tab_items WHERE id = ?').bind(params.id).first();
  if (!current) return json({ error: 'Item não encontrado' }, { status: 404 });
  await env.DB.prepare(`UPDATE tab_items SET printed_at = datetime('now') WHERE id = ?`).bind(params.id).run();
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
