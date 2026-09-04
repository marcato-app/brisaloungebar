// Service worker do PDV — só existe pra deixar o app instalável (ícone na
// tela inicial, abre sem barra de navegador) e pra guardar o "esqueleto"
// da página (HTML, fonte, ícones) em cache, então um wifi ruim no meio do
// rush não trava o carregamento da tela.
//
// De propósito NUNCA cacheia /api/* — comanda, preço, senha de gerência,
// tudo isso tem que vir sempre da rede. Um POS mostrando saldo ou preço
// antigo por causa de cache é pior do que a tela demorar pra carregar.

const CACHE_NAME = 'brisa-pdv-shell-v1';
const SHELL_URLS = [
  '/pdv',
  '/manifest.webmanifest',
  '/assets/fonts/jost.woff2',
  '/assets/img/logo.png',
  '/assets/img/favicon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // sempre rede, nunca cache
  if (url.origin !== self.location.origin) return; // fontes do Google etc. seguem o padrão do navegador

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
