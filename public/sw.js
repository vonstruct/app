// Minimale service worker: nodig om de app op Android te kunnen installeren. Bewaart niets offline (altijd de nieuwste versie).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
