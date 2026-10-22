const CACHE_NAME = 'vlix-cache-v7';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './config.js',
    './longTermMemory.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
        ))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
