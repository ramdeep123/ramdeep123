// Offline cache for the web build (the Android app ships its files in the APK).
const CACHE = 'kaya-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './css/fonts.css',
  './js/app.js', './js/core.js', './js/store.js', './js/ui.js', './js/charts.js', './js/config.js', './js/native.js', './js/payments.js',
  './js/engine/util.js', './js/engine/figure.js', './js/engine/exercises.js', './js/engine/formcheck.js', './js/engine/pose.js',
  './js/engine/routine.js', './js/engine/nutrition.js', './js/engine/foods.js', './js/engine/breath.js', './js/engine/subscription.js',
  './js/engine/voice.js', './js/engine/orb.js',
  './js/views/onboarding.js', './js/views/today.js', './js/views/train.js', './js/views/exercise.js', './js/views/coach.js',
  './js/views/fuel.js', './js/views/mind.js', './js/views/you.js', './js/views/pass.js',
  './assets/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// cache-first for same-origin files (the big pose model is cached on first use)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
