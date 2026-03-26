const CACHE_NAME = 'speed-escape-3d-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles/style.css?v=5',
    './scripts/main.js?v=5',
    './scripts/engine.js?v=5',
    './scripts/car.js?v=5',
    './scripts/environment.js?v=5',
    './scripts/entities.js?v=5',
    './scripts/audio.js?v=5',
    './scripts/ads.js?v=5',
    './assets/icons/icon-512.svg',
    './assets/arcade-racing.jpg',
    './privacy.html',
    './terms.html',
    './config/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                // Ignore fetch errors in stale-while-revalidate unless there's no cache
                if (!cachedResponse) throw error;
            });

            // Return the cached response immediately if available, otherwise wait for the network response
            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
