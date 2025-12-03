const CACHE_NAME = 'schicht-pwa-v20';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  // JS Module
  './js/main.js',
  './js/state.js',
  './js/utils.js',
  './js/logic.js',
  './js/ui.js',
  './js/cloud.js',
  // Bilder
  './assets/transit-icon.png',
  './assets/taxi-icon.png'
  // './assets/icon-192.png' (Falls du das Icon hochlädst, hier entkommentieren!)
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

