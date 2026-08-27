// Fala com o PDV pela mesma API que o navegador usa — login de funcionário,
// busca a fila de impressão de um setor, confirma que imprimiu. Guarda o
// cookie de sessão na memória e refaz login sozinho se a sessão expirar.

'use strict';

function makeClient({ baseUrl, username, password, fetchImpl }) {
  const doFetch = fetchImpl || fetch;
  let cookie = null;

  async function login() {
    const res = await doFetch(baseUrl + '/api/pdv/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error('Login falhou: ' + (body.error || res.status));
    }
    const setCookie = res.headers.get('set-cookie') || '';
    cookie = setCookie.split(';')[0];
    if (!cookie) throw new Error('Login não devolveu cookie de sessão');
    return cookie;
  }

  // Toda chamada tenta relogar uma vez se a sessão tiver expirado (401) —
  // isso é o normal depois de muitas horas de PC ligado, não um erro.
  async function authedFetch(path, opts) {
    if (!cookie) await login();
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json', Cookie: cookie }, opts.headers || {});
    let res = await doFetch(baseUrl + path, opts);
    if (res.status === 401) {
      await login();
      opts.headers.Cookie = cookie;
      res = await doFetch(baseUrl + path, opts);
    }
    return res;
  }

  async function printQueue(sector) {
    const res = await authedFetch('/api/pdv/sector/' + sector + '/print-queue');
    if (!res.ok) throw new Error('Falha ao buscar fila de ' + sector + ': HTTP ' + res.status);
    const data = await res.json();
    return data.items;
  }

  async function markPrinted(tabItemId) {
    const res = await authedFetch('/api/pdv/tab-items/' + tabItemId + '/mark-printed', { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao confirmar impressão de ' + tabItemId + ': HTTP ' + res.status);
  }

  return { login, printQueue, markPrinted };
}

module.exports = { makeClient };
