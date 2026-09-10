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

  // Nome do compartilhamento de cada impressora, configurado pelo gerente na
  // tela de Configurações do PDV. Devolve null quando o servidor não sabe
  // responder (versão antiga, sem a migração 010) — quem chama volta pro
  // config.json nesse caso.
  async function printerShares() {
    let res;
    try {
      res = await authedFetch('/api/pdv/printers');
    } catch (err) {
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.printers)) return null;
    const out = {};
    for (const p of data.printers) if (p.share) out[p.sector] = p.share;
    return out;
  }

  // Conta pro PDV que a impressão falhou. É o que faz a tela conseguir dizer
  // "papel acabou" em vez de só mostrar a fila crescendo sem explicação.
  // Nunca deixa vazar erro: se nem isso funcionar, o que importa é o ciclo
  // seguinte continuar tentando imprimir.
  async function reportError(sector, message) {
    try {
      await authedFetch('/api/pdv/printers/' + sector + '/status', {
        method: 'POST',
        body: JSON.stringify({ error: String(message || '').slice(0, 300) }),
      });
    } catch (err) {
      /* sem rede pra avisar que não tem rede — segue a vida */
    }
  }

  return { login, printQueue, markPrinted, printerShares, reportError };
}

module.exports = { makeClient };
