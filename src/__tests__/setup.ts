/* إعداد بيئة الاختبار: polyfills + mocks */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

/* محاكاة crypto.subtle للبيئة jsdom */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
