const CACHE_NAME = 'yoursclinic-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/script.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const allowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => {
          if (!allowlist.includes(key)) {
            return caches.delete(key);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(event.request)
          .then(response => {
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
              return caches.match('/offline.html');
            }
          });
      })
  );
});