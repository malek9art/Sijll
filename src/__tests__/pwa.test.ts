/* اختبارات PWA: التثبيت والعمل دون إنترنت (C-04)
 * يشغّل ملف public/sw.js الحقيقي في بيئة معزولة (mocks لـ caches/fetch)
 * ويتحقق من:
 *   1) التخزين المسبق للملفات الأساسية + أصول البناء المستخرجة من index.html
 *   2) فتح التطبيق دون إنترنت (الملاحة تُعاد من المخزن)
 *   3) تحميل JS/CSS دون إنترنت بعد أول زيارة
 *   4) تخزين خطوط قوقل ودون إنترنت
 *   5) إشعار التحديث عند الترقية فقط (وليس أول تثبيت)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SW_PATH = resolve(__dirname, "../../public/sw.js");

/* ====== بيئة معزولة لعامل الخدمة ====== */
const BASE = "https://example.com/Sijll/";
const ORIGIN = "https://example.com";

interface MockResponse {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  clone(): MockResponse;
  text(): Promise<string>;
}

function makeResponse(body: string, status = 200): MockResponse {
  /* غلاف صريح (لا نعتمد على Response العالمي — بيئة jsdom غير موثوقة بها) */
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "",
    body,
    clone(): MockResponse { return this; },
    text(): Promise<string> { return Promise.resolve(this.body); },
  };
}

class MockCache {
  store = new Map<string, MockResponse>();
  async add(url: string): Promise<void> {
    const res = await doFetch(url);
    if (!res.ok) throw new Error(`فشل تخزين ${url}`);
    /* كما يفعل المتصفح: تُخزَّن المفاتيح بعناوين مطلقة نسبةً لموقع عامل الخدمة */
    this.store.set(normKey(url), res);
  }
  async addAll(urls: string[]): Promise<void> {
    for (const u of urls) await this.add(u);
  }
  async put(req: unknown, res: MockResponse): Promise<void> {
    this.store.set(normKey(req), res);
  }
  async match(req: unknown, opts?: { ignoreSearch?: boolean }): Promise<MockResponse | undefined> {
    let key = normKey(req);
    if (opts?.ignoreSearch) key = key.split("?")[0];
    return this.store.get(key);
  }
  async keys(): Promise<string[]> { return [...this.store.keys()]; }
}

class MockCacheStorage {
  caches = new Map<string, MockCache>();
  async open(name: string): Promise<MockCache> {
    if (!this.caches.has(name)) this.caches.set(name, new MockCache());
    return this.caches.get(name)!;
  }
  async match(req: unknown, opts?: { ignoreSearch?: boolean }): Promise<MockResponse | undefined> {
    for (const c of this.caches.values()) {
      const hit = await c.match(req, opts);
      if (hit) return hit;
    }
    return undefined;
  }
  async keys(): Promise<string[]> { return [...this.caches.keys()]; }
  async delete(name: string): Promise<boolean> { return this.caches.delete(name); }
}

let online = true;
const routes = new Map<string, string>();
routes.set("/Sijll/", `<!doctype html><html><head><script src="./assets/index-abc123.js"></script><link href="./assets/index-xyz789.css" rel="stylesheet"></head><body>سجل</body></html>`);
routes.set("/Sijll/index.html", routes.get("/Sijll/")!);
routes.set("/Sijll/verify.html", "<!doctype html><html><body>تحقق</body></html>");
routes.set("/Sijll/manifest.webmanifest", "{}");
routes.set("/Sijll/icons/icon-192.png", "PNG192");
routes.set("/Sijll/icons/icon-512.png", "PNG512");
routes.set("/Sijll/icons/icon-maskable.png", "PNGMASK");
routes.set("/Sijll/favicon.svg", "<svg/>");
routes.set("/Sijll/logo.svg", "<svg/>");
routes.set("/Sijll/assets/index-abc123.js", "console.log('app');");
routes.set("/font.woff2", "WOFFDATA");
routes.set("/Sijll/assets/index-xyz789.css", "body{}");

const normKey = (req: unknown): string => {
  const raw = typeof req === "string" ? req : (req as { url: string }).url;
  const u = new URL(raw, BASE);
  return u.href.split("#")[0];
};

async function doFetch(input: unknown): Promise<MockResponse> {
  if (!online) throw new TypeError("فشل الشبكة — دون اتصال");
  const url = normKey(input);
  const path = new URL(url).pathname;
  const body = routes.get(path);
  if (body === undefined) return makeResponse("404", 404);
  return makeResponse(body);
}

interface SWEvent {
  request?: unknown;
  respondWith?: (p: Promise<unknown>) => void;
  waitUntil?: (p: Promise<unknown>) => void;
  responsePromise?: Promise<unknown>;
}

let listeners: Record<string, (e: SWEvent) => void>;
let postMessages: unknown[];
let skipped = false;
let cacheStorage: MockCacheStorage;

async function bootSW(): Promise<void> {
  const code = readFileSync(SW_PATH, "utf8");
  listeners = {};
  postMessages = [];
  skipped = false;
  cacheStorage = new MockCacheStorage();
  const self = {
    location: { href: `${BASE}index.html`, origin: ORIGIN },
    addEventListener: (t: string, fn: (e: SWEvent) => void) => { listeners[t] = fn; },
    skipWaiting: () => { skipped = true; },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([{ postMessage: (m: unknown) => postMessages.push(m) }]),
    },
  };
  const fn = new Function("self", "caches", "fetch", "URL", "Response", "Request", code);
  fn(self, cacheStorage, doFetch, URL, (globalThis as { Response?: unknown }).Response, (globalThis as { Request?: unknown }).Request);
}

function fire(name: string, ev: SWEvent): Promise<void> {
  return new Promise((resolvePromise) => {
    ev.respondWith = (p) => { ev.responsePromise = p; };
    ev.waitUntil = (p) => { void p.then(() => resolvePromise()).catch(() => resolvePromise()); };
    listeners[name](ev);
    /* إن لم يُسجَّل waitUntil (مثل fetch) نُحل فوراً */
    setTimeout(() => resolvePromise(), 0);
  });
}

/** انتظار استقرار وعد الاستجابة الفعلي */
async function settled(p: Promise<unknown> | undefined): Promise<unknown> {
  return p ? await p : undefined;
}

describe("PWA — التثبيت والعمل دون إنترنت", () => {
  beforeAll(async () => { await bootSW(); });

  it("يخزّن مسبقاً الملفات الأساسية + أصول البناء (JS/CSS) عند التثبيت", async () => {
    online = true;
    await fire("install", {});
    await new Promise((r) => setTimeout(r, 10));
    const cache = await cacheStorage.open("sajil-v5");
    const keys = await cache.keys();
    /* الأساسيات */
    expect(keys.some((k) => k.endsWith("/Sijll/index.html"))).toBe(true);
    expect(keys.some((k) => k.endsWith("/Sijll/verify.html"))).toBe(true);
    expect(keys.some((k) => k.endsWith("/Sijll/manifest.webmanifest"))).toBe(true);
    expect(keys.some((k) => k.includes("icon-192.png"))).toBe(true);
    expect(keys.some((k) => k.includes("icon-512.png"))).toBe(true);
    expect(keys.some((k) => k.includes("icon-maskable.png"))).toBe(true);
    /* أصول البناء المستخرجة من index.html — قلب العمل دون إنترنت */
    expect(keys.some((k) => k.endsWith("/Sijll/assets/index-abc123.js"))).toBe(true);
    expect(keys.some((k) => k.endsWith("/Sijll/assets/index-xyz789.css"))).toBe(true);
    expect(skipped).toBe(true);
  });

  it("يفتح التطبيق دون إنترنت — الملاحة تُعاد من المخزن", async () => {
    online = false;
    const ev: SWEvent = { request: { method: "GET", mode: "navigate", url: `${BASE}` } };
    await fire("fetch", ev);
    const res = (await settled(ev.responsePromise)) as MockResponse;
    expect(res).toBeDefined();
    expect((await res.text())).toContain("سجل");
  });

  it("يحمل أصول JS/CSS دون إنترنت بعد أول زيارة", async () => {
    online = true;
    const ev1: SWEvent = { request: { method: "GET", mode: "no-cors", url: `${BASE}assets/index-abc123.js` } };
    await fire("fetch", ev1);
    expect(((await settled(ev1.responsePromise)) as MockResponse).ok).toBe(true);

    online = false;
    const ev2: SWEvent = { request: { method: "GET", mode: "no-cors", url: `${BASE}assets/index-abc123.js` } };
    await fire("fetch", ev2);
    const res = (await settled(ev2.responsePromise)) as MockResponse;
    expect(await res.text()).toBe("console.log('app');");
  });

  it("يحفظ ملفات CSS في المخزن ويخدمها دون إنترنت", async () => {
    online = true;
    const ev1: SWEvent = { request: { method: "GET", mode: "no-cors", url: `${BASE}assets/index-xyz789.css` } };
    await fire("fetch", ev1);
    online = false;
    const ev2: SWEvent = { request: { method: "GET", mode: "no-cors", url: `${BASE}assets/index-xyz789.css` } };
    await fire("fetch", ev2);
    expect(((await settled(ev2.responsePromise)) as MockResponse).ok).toBe(true);
  });

  it("يخزّن خطوط قوقل ويخدمها دون إنترنت", async () => {
    online = true;
    const fontUrl = "https://fonts.gstatic.com/font.woff2";
    const ev1: SWEvent = { request: { method: "GET", mode: "no-cors", url: fontUrl } };
    await fire("fetch", ev1);
    online = false;
    const ev2: SWEvent = { request: { method: "GET", mode: "no-cors", url: fontUrl } };
    await fire("fetch", ev2);
    const res = (await ev2.responsePromise) as MockResponse;
    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
  });

  it("لا يُشعر بالتحديث في أول تثبيت، ويُشعر عند الترقية من نسخة سابقة", async () => {
    online = true;
    /* أول تثبيت: لا توجد نسخ قديمة */
    await fire("activate", { waitUntil: (p) => { void p; } });
    expect(postMessages.length).toBe(0);

    /* ترقية: توجد نسخة قديمة (sajil-v4) */
    await cacheStorage.open("sajil-v4");
    await new Promise((r) => setTimeout(r, 5));
    await fire("activate", { waitUntil: (p) => { void p; } });
    await new Promise((r) => setTimeout(r, 5));
    expect(postMessages.length).toBe(1);
    expect(postMessages[0]).toEqual({ type: "SAJIL_UPDATE_AVAILABLE" });
    expect((await cacheStorage.keys()).includes("sajil-v4")).toBe(false);
  });

  it("يمرر الطلبات غير GET دون تدخل", async () => {
    const ev: SWEvent = { request: { method: "POST", url: `${BASE}api` } };
    let called = false;
    listeners.fetch(ev);
    expect(ev.responsePromise).toBeUndefined();
    expect(called).toBe(false);
  });
});
