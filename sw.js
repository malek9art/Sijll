/* سجل — Service Worker: استراتيجية Offline-First كاملة
 *
 * 1) التثبيت: تخزين الملفات الأساسية + استخراج كل أصول البناء (JS/CSS)
 *    من index.html وتخزينها — ضمان عمل كامل دون إنترنت من أول زيارة.
 * 2) الملاحة (HTML): شبكة أولاً مع السقوط لآخر نسخة مخزنة عند الانقطاع.
 * 3) الموارد (JS/CSS/صور): المخزن أولاً مع تحديث الخلفية — سرعة فائقة
 *    وسلامة كاملة دون إنترنت.
 * 4) خطوط قوقل العربية: تخزين دائم — تبقى الخطوط كما هي دون اتصال.
 * 5) عند وجود تحديث جديد: إشعار المستخدم بشريط «تحديث متاح».
 */
const CACHE = "sajil-v5";
const CORE = ["./", "./index.html", "./verify.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable.png", "./favicon.svg", "./logo.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(async () => {
        /* تخزين مسبق لكل أصول البناء (JS/CSS) المذكورة في index.html —
           دون ذلك ينهار التطبيق دون إنترنت بعد مسح ذاكرة المتصفح المؤقتة. */
        try {
          const res = await fetch("./index.html");
          if (res && res.ok) {
            const html = await res.text();
            const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
            const uniq = [...new Set(assets)].map((a) => new URL(a, self.location.href).href);
            const cache = await caches.open(CACHE);
            /* كل ملف على حدة — فشل ملف لا يُسقط التثبيت كاملاً */
            await Promise.allSettled(uniq.map((u) => cache.add(u)));
          }
        } catch {
          /* الأصول ستُخزَّن أيضاً عند أول طلب (استراتيجية runtime) */
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const hadOld = keys.some((k) => k !== CACHE);
        return Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
          .then(() => self.clients.claim())
          .then(() => {
            /* إشعار التحديث فقط عند ترقية من نسخة سابقة — لا في أول تثبيت */
            if (!hadOld) return;
            return self.clients.matchAll({ type: "window" }).then((clients) => {
              for (const client of clients) {
                client.postMessage({ type: "SAJIL_UPDATE_AVAILABLE" });
              }
            });
          });
      })
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!isFont && url.origin !== self.location.origin) return;

  /* الخطوط: المخزن أولاً مع تخزين دائم عند أول تحميل */
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

  /* الملاحة (صفحات HTML): شبكة أولاً — التحديثات تصل فوراً،
     ودون إنترنت تُعاد آخر نسخة مخزنة (تطبيق SPA يعمل بالكامل). */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          return (await caches.match("./index.html")) || (await caches.match("./"));
        })
    );
    return;
  }

  /* موارد التطبيق (JS/CSS/صور): المخزن أولاً ثم الشبكة مع تحديث الخلفية */
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
