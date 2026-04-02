const CACHE_NAME = 'neurix-v2'; // Increment version to force update
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches to ensure users get the latest version
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Claim clients immediately
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy for all requests to ensure the latest code is always loaded
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '⏰ NEURIX Reminder', {
      body: 'NEURIX: Scheduled Task',
      icon: 'https://picsum.photos/seed/neurix/192/192',
      badge: 'https://picsum.photos/seed/neurix/192/192',
      vibrate: [200, 100, 200],
      tag: data.tag || 'neurix-reminder',
      renotify: true,
      timestamp: Date.now(),
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
