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
    './scripts/admob.js?v=5',
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
        fetch(event.request).then((response) => {
            // Network first: return network response and cache it
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
            return response;
        }).catch(() => {
            // Fallback to cache if network fails
            return caches.match(event.request);
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
