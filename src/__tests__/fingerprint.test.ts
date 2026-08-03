/* اختبارات بصمة الإصبع المُرسمة في المستند (C-03) */
import { describe, it, expect } from "vitest";
import { fingerprintSVG, fingerprintDataUrl, hashSeed, mulberry32 } from "@/lib/fingerprint";

describe("بصمة الإصبع المُرسمة في المستند", () => {
  it("تُنتج بصمة ثابتة لنفس الموقّع (نفس الاعتماد) — كبصمته الحقيقية", () => {
    const a = fingerprintSVG("sajil-fp|cred-1|الطرف الثاني");
    const b = fingerprintSVG("sajil-fp|cred-1|الطرف الثاني");
    expect(a).toBe(b);
    expect(a).toContain("<svg");
  });

  it("تختلف البصمة بين موقّعين مختلفين", () => {
    const a = fingerprintSVG("sajil-fp|cred-1|الطرف الثاني");
    const b = fingerprintSVG("sajil-fp|cred-2|الطرف الثاني");
    const c = fingerprintSVG("sajil-fp|cred-1|الشاهد الأول");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("تتضمن نقوشاً (حواف) وليس مجرد شكل فارغ", () => {
    const svg = fingerprintSVG("sajil-fp|cred-1|الطرف الثاني");
    expect(svg).toContain("<path");
    expect(svg.match(/<path/g)!.length).toBeGreaterThan(10);
    expect(svg).toContain('stroke="#16202f"');
  });

  it("تُنتج بيانات صورة (data URL) قابلة للعرض في المستند", async () => {
    const url = await fingerprintDataUrl("sajil-fp|cred-1|الطرف الثاني");
    expect(url.startsWith("data:image/")).toBe(true);
  });

  it("مولّد الأرقام العشوائية حتمي (deterministic)", () => {
    const a = mulberry32(hashSeed("sajil-fp|cred-1"));
    const seq1 = [a(), a(), a()];
    const b = mulberry32(hashSeed("sajil-fp|cred-1"));
    const seq2 = [b(), b(), b()];
    expect(seq1).toEqual(seq2);
  });
});
