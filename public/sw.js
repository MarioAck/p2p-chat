const CACHE_NAME = 'p2p-chat-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/chat.html',
  '/css/styles.css',
  '/js/signaling.js',
  '/js/webrtc.js',
  '/js/ui.js',
  '/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip WebSocket and non-GET requests
  if (event.request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for same-origin requests
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests (e.g. /room/ABC123), serve cached chat.html
          if (event.request.mode === 'navigate') {
            return caches.match('/chat.html');
          }
        });
      })
  );
});
