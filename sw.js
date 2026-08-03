/* سجل — Service Worker: استراتيجية Offline-First مع تخزين خطوط قوقل */
const CACHE = "sajil-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-512.png", "./favicon.svg", "./logo.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!isFont && url.origin !== self.location.origin) return;

  /* الخطوط: شبكة أولاً مع تخزين دائم، والسقوط للمخزن عند انقطاع الاتصال */
  if (isFont) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  /* موارد التطبيق: المخزن أولاً ثم الشبكة مع تحديث الخلفية */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
