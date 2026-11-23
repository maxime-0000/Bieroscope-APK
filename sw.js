// Service Worker : cache les fichiers indispensables au démarrage.
const CACHE_NAME = "brewmaster-static-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./style.css",
  "./app.js",
  "./icons/beer-icon-192.png",
  "./icons/beer-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("brewmaster-static-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request);
    }),
  );
});
