/* ===== أدوات مساعدة عامة ===== */

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export function toDigits(input: string | number, arabic: boolean): string {
  const s = String(input);
  return arabic ? toArabicDigits(s) : s;
}

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function fmtDate(iso: string, arabic = true, withTime = false): string {
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return iso;
  const day = arabic ? toArabicDigits(d.getDate()) : String(d.getDate());
  const year = arabic ? toArabicDigits(d.getFullYear()) : String(d.getFullYear());
  let out = `${day} ${AR_MONTHS[d.getMonth()]} ${year}`;
  if (withTime) {
    const hh = arabic ? toArabicDigits(String(d.getHours()).padStart(2, "0")) : String(d.getHours()).padStart(2, "0");
    const mm = arabic ? toArabicDigits(String(d.getMinutes()).padStart(2, "0")) : String(d.getMinutes()).padStart(2, "0");
    out += ` — ${hh}:${mm}`;
  }
  return out;
}

export function hijriDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return "";
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string): number {
  const parseLocal = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((parseLocal(iso) - parseLocal(todayISO())) / 86400000);
}

/* ===== تحويل المبالغ إلى كلمات عربية ===== */
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = HUNDREDS[h] || "";
  if (h && rest) s += " و";
  if (rest > 0) {
    if (rest < 20) s += ONES[rest];
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      s += o ? `${ONES[o]} و${TENS[t]}` : TENS[t];
    }
  }
  return s;
}

function toWords(n: number): string {
  if (n === 0) return "صفر";
  const scales: [number, string, string, string][] = [
    [1e9, "مليار", "ملياران", "مليارات"],
    [1e6, "مليون", "مليونان", "ملايين"],
    [1e3, "ألف", "ألفان", "آلاف"],
  ];
  let result = "";
  for (const [value, single, dual, plural] of scales) {
    const q = Math.floor(n / value);
    n %= value;
    if (q === 0) continue;
    let part: string;
    if (q === 1) part = single;
    else if (q === 2) part = dual;
    else if (q <= 10) part = `${threeDigits(q)} ${plural}`;
    else part = `${threeDigits(q)} ${single}ًا`;
    result += result ? ` و${part}` : part;
  }
  if (n > 0) result += result ? ` و${threeDigits(n)}` : threeDigits(n);
  return result;
}

export function amountToWordsAr(amount: number, currencyName = "ريال يمني"): string {
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 100);
  let s = `${toWords(whole)} ${currencyName}`;
  if (frac > 0) s += ` و${toWords(frac)} هللة`;
  return `${s} فقط لا غير`;
}

/* ===== أرقام ومالية ===== */
export function fmtMoney(amount: number, currency = "YER", arabic = true, decimals = 0): string {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(amount);
  const num = arabic ? toArabicDigits(formatted) : formatted;
  return `${currencySymbol(currency)} ${num}`;
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = { YER: "ر.ي", SAR: "ر.س", USD: "$", EUR: "€" };
  return map[currency] || currency;
}

export function toBase(amount: number, currency: string, rates: Record<string, number>, base: string): number {
  const rate = rates[currency] || 1;
  const baseRate = rates[base] || 1;
  return (amount * rate) / baseRate;
}

/* ===== ملفات ===== */
export function downloadJSON(filename: string, data: unknown, encrypt = false, passphrase = ""): void {
  const payload = { app: "sajil", exportedAt: new Date().toISOString(), data };
  const blobPromise: Promise<Blob> = encrypt
    ? encryptJSON(JSON.stringify(payload), passphrase).then((enc) => new Blob([enc], { type: "application/octet-stream" }))
    : Promise.resolve(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  blobPromise.then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsText(file);
  });
}

/* ===== تشفير AES-GCM عبر Web Crypto ===== */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJSON(text: string, passphrase: string): Promise<string> {
  const salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  const payload = new Uint8Array(16 + 12 + cipher.byteLength);
  payload.set(salt, 0);
  payload.set(iv, 16);
  payload.set(new Uint8Array(cipher), 28);
  return btoa(String.fromCharCode(...payload));
}

export async function decryptJSON(b64: string, passphrase: string): Promise<string> {
  const bin = atob(b64);
  const raw = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  const salt = raw.slice(0, 16);
  const iv = raw.slice(16, 28);
  const data = raw.slice(28);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return dec.decode(plain);
}

export function hashCode(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/* ====== تشفير PIN آمن عبر PBKDF2-SHA256 ======
 * يُنتج hash بصيغة: "pbkdf2$<iterations>$<salt_base64>$<hash_base64>"
 *salt عشوائي 16 بايت + 100,000 تكرار — يستغرق ~50-100ms لكل محاولة (مقاوم لـ brute-force).
 */
const PIN_ITERATIONS = 100_000;
const PIN_SALT_LEN = 16;
const PIN_KEY_LEN = 256;

function u8ToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToU8(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** تشفير PIN جديد (PBKDF2-SHA256) */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_LEN));
  const material = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PIN_ITERATIONS, hash: "SHA-256" },
    material, PIN_KEY_LEN,
  );
  return `pbkdf2$${PIN_ITERATIONS}$${u8ToB64(salt)}$${u8ToB64(new Uint8Array(bits))}`;
}

/**
 * التحقق من PIN ضد hash مخزّن.
 * يدعم التنسيقين: PBKDF2 الجديد (`pbkdf2$...`) وhashCode القديم (للتوافق العكسي).
 * يُرجع `{ ok, needsUpgrade }` — `needsUpgrade = true` يعني أن الـ hash بتنسيق قديم ويجب إعادة تشفيره.
 */
export async function verifyPin(pin: string, stored: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return { ok: false, needsUpgrade: false };
    const iterations = parseInt(parts[1], 10);
    const salt = b64ToU8(parts[2]);
    const expected = parts[3];
    const material = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material, PIN_KEY_LEN,
    );
    const computed = u8ToB64(new Uint8Array(bits));
    /* مقارنة ثابتة الوقت (timing-safe) */
    if (computed.length !== expected.length) return { ok: false, needsUpgrade: false };
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
    return { ok: diff === 0, needsUpgrade: false };
  }
  /* توافق عكسي: hashCode القديم */
  return { ok: hashCode(pin) === stored, needsUpgrade: true };
}

/* ===== عناصر نائبة ===== */
export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "org_name", label: "اسم المنشأة" },
  { key: "org_address", label: "عنوان المنشأة" },
  { key: "org_phone", label: "هاتف المنشأة" },
  { key: "org_license", label: "ترخيص المنشأة" },
  { key: "org_city", label: "مدينة المنشأة" },
  { key: "party_name", label: "اسم الطرف" },
  { key: "party_id", label: "رقم هوية الطرف" },
  { key: "party_phone", label: "هاتف الطرف" },
  { key: "party_address", label: "عنوان الطرف" },
  { key: "party_nationality", label: "جنسية الطرف" },
  { key: "amount", label: "المبلغ (أرقام)" },
  { key: "amount_words", label: "المبلغ (كلمات)" },
  { key: "date_gregorian", label: "التاريخ الميلادي" },
  { key: "date_hijri", label: "التاريخ الهجري" },
  { key: "due_date", label: "تاريخ السداد المتفق عليه" },
  { key: "witness1", label: "الشاهد الأول" },
  { key: "witness2", label: "الشاهد الثاني" },
  { key: "doc_number", label: "رقم المستند" },
  { key: "debt_reason", label: "سبب الدين" },
];
