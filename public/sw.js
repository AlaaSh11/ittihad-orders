// Self-unregistering cleanup service worker to remove legacy v1 caches
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('Deleting legacy cache:', cache);
          return caches.delete(cache);
        })
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});
