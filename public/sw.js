const CACHE_NAME = 'posto7-v3';
const STATIC_CACHE = 'posto7-static-v3';

const STATIC_ASSETS = [
  '/',
  '/aplicativo',
  '/manifest.json',
  '/premio',
  '/abastecimento'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => 
              // Remove any old posto7 caches or caches that don't match current versions
              (cacheName.startsWith('posto7-') && cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE)
            )
            .map((cacheName) => {
              console.log('[SW] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API calls - network only (don't cache)
  if (url.pathname.includes('/rest/') || 
      url.pathname.includes('/auth/') ||
      url.hostname.includes('supabase')) {
    return;
  }

  // Static assets and pages - network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before caching
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, return the app shell for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});