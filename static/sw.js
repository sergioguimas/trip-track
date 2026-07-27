// TripTrack Service Worker — Fase 1.5 (app shell offline)
// Estratégia: cacheia o "casco" do app para que ele abra sem internet.
// Os dados (chamadas /api/) seguem online por enquanto — offline real vem na Fase 2.

const CACHE = 'triptrack-shell-v1';

const APP_SHELL = [
  '/',
  '/historico',
  '/static/style.css',
  '/static/script.js',
  '/static/historico.js',
  '/static/manifest.webmanifest',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/icon-512-maskable.png'
];

// Instala: pré-cacheia o app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Ativa: remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Intercepta requisições GET
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não intercepta a API: dados são online por ora (offline chega na Fase 2)
  if (url.pathname.startsWith('/api/')) return;

  // Navegação (HTML): network-first para pegar a versão fresca quando online,
  // com fallback pro cache quando offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Demais assets (CSS/JS/ícones): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return resp;
      });
    })
  );
});
