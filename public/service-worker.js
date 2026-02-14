self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Pass through fetch, but handle failures to avoid unhandled promise rejections.
  event.respondWith(
    fetch(event.request).catch(err => {
      console.error('Service worker fetch failed:', err);
      return new Response('Network unavailable', {
        status: 503,
        statusText: 'Network unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});
