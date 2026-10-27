/* Vukoli service worker. It exists for two reasons: Chrome / Edge can install Vukoli as an app (own Dock / taskbar
 * icon), and a closed app shows "Vukoli isn't running" with a Start button instead of the browser's error page.
 * It never caches the app: every request goes to the server as if there were no worker, so a rebuilt UI shows up at
 * once. The one exception is a page load that fails because the server is not running: that gets offline.html.
 * Change CACHE when offline.html changes (the old cache is deleted on activate). */
const CACHE = "vukoli-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads are handled; scripts, styles, the API and WebSockets go to the network untouched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE, { cacheName: CACHE })));
});
