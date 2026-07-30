// Yoki的地球Online — Service Worker
// 策略：导航/应用壳「网络优先」，静态资源「缓存优先」
// 目的：服务器上的 index.html / sw.js 更新后，手机下次打开能自动拉取新版本。
const VERSION = 'v2';
const CACHE_NAME = 'yoki-earth-online-' + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting(); // 新版本立即接管，配合 index.html 的刷新提示
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 导航请求（打开页面 / start_url）→ 网络优先，确保拿到最新 index.html
  const isNav = event.request.mode === 'navigate' ||
                url.pathname.endsWith('index.html') ||
                url.pathname.endsWith('/');
  if (isNav) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 同源静态资源 → 缓存优先（离线可用、加载快）
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
