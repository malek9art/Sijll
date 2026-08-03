/* اختبارات hashPin / verifyPin (C-05) */
import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, hashCode } from "@/lib/utils";

describe("hashPin + verifyPin", () => {
  it("ينتج hash بصيغة pbkdf2$", async () => {
    const h = await hashPin("1234");
    expect(h).toMatch(/^pbkdf2\$100000\$.+\$.+$/);
  });

  it("نفس PIN يُنتج hash مختلف (salt عشوائي)", async () => {
    const h1 = await hashPin("1234");
    const h2 = await hashPin("1234");
    expect(h1).not.toEqual(h2);
  });

  it("يتحقق بنجاح من PIN صحيح", async () => {
    const h = await hashPin("5678");
    const result = await verifyPin("5678", h);
    expect(result.ok).toBe(true);
    expect(result.needsUpgrade).toBe(false);
  });

  it("يرفض PIN خاطئ", async () => {
    const h = await hashPin("5678");
    const result = await verifyPin("9999", h);
    expect(result.ok).toBe(false);
  });

  it("التوافق العكسي: hashCode القديم مقبول مع needsUpgrade=true", async () => {
    const oldHash = hashCode("1234");
    const result = await verifyPin("1234", oldHash);
    expect(result.ok).toBe(true);
    expect(result.needsUpgrade).toBe(true);
  });

  it("التوافق العكسي: PIN خاطئ مع hash قديم يُرفض", async () => {
    const oldHash = hashCode("1234");
    const result = await verifyPin("9999", oldHash);
    expect(result.ok).toBe(false);
  });

  it("hash malformed يُرفض", async () => {
    const result = await verifyPin("1234", "pbkdf2$invalid");
    expect(result.ok).toBe(false);
  });
});
