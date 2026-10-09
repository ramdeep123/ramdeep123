// Offline cache for the web build (the Android app ships its files in the APK).
// Never caches /api — answers are not stored anywhere but the encrypted vault.
const CACHE = 'kym-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './css/fonts.css',
  './js/app.js', './js/ui.js', './js/core.js', './js/store.js', './js/vault.js', './js/ai.js', './js/art.js', './js/config.js', './js/theme.js',
  './js/engine/util.js', './js/engine/safety.js', './js/engine/content.js', './js/engine/signals.js', './js/engine/beliefs.js',
  './js/engine/analyse.js', './js/engine/mapbuild.js', './js/engine/interview.js', './js/engine/tracking.js', './js/engine/aishape.js', './js/engine/crisis-lines.js',
  './js/views/onboarding.js', './js/views/lock.js', './js/views/crisis.js', './js/views/interview.js', './js/views/mapview.js',
  './js/views/today.js', './js/views/maptab.js', './js/views/toolstab.js', './js/views/tools.js', './js/views/you.js',
  './assets/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
