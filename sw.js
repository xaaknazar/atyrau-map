var CACHE_NAME = "atyrau-map-v2";
var PRECACHE = ["/", "/index.html", "/css/style.css", "/images/icon-192x192.png", "/images/icon-512x512.png"];

self.addEventListener("install", function (e) {
    e.waitUntil(caches.open(CACHE_NAME).then(function (c) { return c.addAll(PRECACHE); }));
    self.skipWaiting();
});

self.addEventListener("activate", function (e) {
    e.waitUntil(caches.keys().then(function (names) {
        return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    }));
    self.clients.claim();
});

self.addEventListener("fetch", function (e) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
});
