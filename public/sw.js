/* Agent Commerce — minimal app-shell service worker (PWA MVP). */
const CACHE = 'agent-commerce-shell-v1'
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Never cache API / health / discovery — commerce state must hit the network.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/.well-known') ||
    url.pathname === '/openapi.json'
  ) {
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          void caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          return cached || caches.match('/offline.html')
        }),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith('/icons/') || url.pathname.endsWith('.webmanifest'))) {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(async () => {
          if (url.pathname === '/offline.html') {
            return caches.match('/offline.html')
          }
          throw new Error('offline')
        })
    }),
  )
})
