// Regression test for the routing between the Worker and Cloudflare's
// static-asset store.
//
// Run with:  node test/routing.test.mjs
//
// The asset mock below reproduces html_handling = "auto-trailing-slash":
// HTML is served at its extensionless path and the .html form answers
// with a 301 to it. That detail caused a live redirect loop once — the
// Worker rewrote /bio to /bio.html, the asset store bounced it back to
// /bio, and the browser gave up. visit() follows redirects and fails on
// a repeat, so that shape of bug cannot ship again unnoticed.

import worker from '../src/index.js';
import fs from 'fs';
import path from 'path';

const ROOT = '/home/user/brisaloungebar';
const has = (p) => fs.existsSync(path.join(ROOT, p)) && fs.statSync(path.join(ROOT, p)).isFile();

// Models Cloudflare's asset store with html_handling = "auto-trailing-slash":
// HTML lives at its extensionless path, and the .html form 301s to it.
function assetsFetch(req) {
  const u = new URL(req.url);
  const p = decodeURIComponent(u.pathname);

  if (p === '/index.html') return Response.redirect(new URL('/', u).toString(), 301);
  if (p.endsWith('.html')) {
    const clean = p.slice(0, -'.html'.length);
    if (has(p)) return Response.redirect(new URL(clean, u).toString(), 301);
  }
  if (p === '/') {
    return has('/index.html')
      ? new Response(fs.readFileSync(path.join(ROOT, 'index.html')), { status: 200 })
      : new Response('nf', { status: 404 });
  }
  if (!path.extname(p) && has(p + '.html')) {
    return new Response(fs.readFileSync(path.join(ROOT, p + '.html')), { status: 200 });
  }
  if (has(p)) return new Response(fs.readFileSync(path.join(ROOT, p)), { status: 200 });
  return new Response('nf', { status: 404 });
}

// Does the asset store serve this path directly, without the Worker?
// (run_worker_first = ["/api/*"] means assets win everywhere else.)
function assetFirstHandles(p) {
  if (p.startsWith('/api/')) return false;
  if (p === '/' || p === '/index.html') return true;
  if (p.endsWith('.html')) return has(p);
  if (!path.extname(p) && has(p + '.html')) return true;
  return has(p);
}

const env = { ASSETS: { fetch: async (r) => assetsFetch(r) }, DB: null };

// Walk redirects the way a browser would, through the same front door.
async function visit(startUrl, maxHops = 8) {
  let url = startUrl;
  const seen = [];
  for (let i = 0; i < maxHops; i++) {
    seen.push(url);
    const p = new URL(url).pathname;
    const req = new Request(url, { redirect: 'manual' });
    const res = assetFirstHandles(p)
      ? await assetsFetch(req)
      : await worker.fetch(req, env, {});
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      const next = new URL(loc, url).toString();
      if (seen.includes(next)) return { status: 'LOOP', hops: seen.length, chain: seen.concat(next) };
      url = next;
      continue;
    }
    return { status: res.status, body: res.status === 200 ? await res.text() : '', hops: i, url };
  }
  return { status: 'LOOP', hops: maxHops, chain: seen };
}

function label(html) {
  const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (t.startsWith('Painel')) return 'Painel';
  if (t === 'Brisa Lounge Bar') return 'Bio';
  if (t.includes('Cardápio')) return 'Cardápio';
  return 'DESCONHECIDO(' + t + ')';
}

const D = 'https://brisaloungebar.com.br';
const cases = [
  [`${D}/`,             'Cardápio'],
  [`${D}/cardapio`,     'Cardápio'],
  [`${D}/bio`,          'Bio'],
  [`${D}/admin`,        'Painel'],
  [`${D}/bio.html`,     'Bio'],
  [`${D}/admin.html`,   'Painel'],
  [`${D}/index.html`,   'Cardápio'],
  [`https://www.brisaloungebar.com.br/`,          'Cardápio'],
  [`https://brisaloungebar.gaabmgomes.workers.dev/`,     'Cardápio'],
  [`https://brisaloungebar.gaabmgomes.workers.dev/bio`,  'Bio'],
];

let fail = 0;
for (const [u, want] of cases) {
  const r = await visit(u);
  const got = r.status === 200 ? label(r.body) : String(r.status);
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + u.replace(D, '').padEnd(48) + ' -> ' + got +
    (r.hops ? ` (${r.hops} redir)` : '') + (ok ? '' : '   esperado ' + want));
  if (r.status === 'LOOP') console.log('        ' + r.chain.join('\n        '));
}

for (const u of [`${D}/assets/css/style.css`, `${D}/assets/fonts/jost.woff2`, `${D}/assets/img/logo.png`]) {
  const r = await visit(u);
  const ok = r.status === 200;
  if (!ok) fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + u.replace(D, '').padEnd(48) + ' -> HTTP ' + r.status);
}

console.log(fail === 0 ? '\nTUDO OK — nenhum laço de redirecionamento' : `\n${fail} falhas`);
process.exit(fail ? 1 : 0);
