/* ====== بصمة الإصبع المُرسمة في المستند ======
 * عندما يوثّق الموقّع المستند بحساس البصمة (WebAuthn)، تُرسم في صندوق
 * توقيعه بصمة إبهام واقعية كأنه بَصَّم بالحبر على ورقة خارجية.
 *
 * ⚠️ ملاحظة أمنية صريحة: المتصفحات لا تسمح أبداً بالوصول إلى صورة
 * البصمة الحقيقية (تصميم WebAuthn لحماية الخصوصية). لذلك تُولَّد هذه
 * البصمة رقمياً بشكل واقعي (نقوش حلقية، انكسارات، لطخات حبر) وتكون:
 *   • ثابتة: نفس الموقّع (نفس الاعتماد) يحصل على نفس البصمة دائماً
 *     في كل مستنداته — تماماً كبصمته الحقيقية.
 *   • فريدة: كل موقّع مختلف يحصل على بصمة مختلفة.
 *   • مرتبطة بالوثيقة: البصمة تُشتق من الاعتماد البيومتري الموثق.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** تحويل نص إلى بذرة عددية (FNV-1a) */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const W = 180;
const H = 220;

/** توليد رسم SVG لبصمة إبهام واقعية من بذرة ثابتة */
export function fingerprintSVG(seed: string): string {
  const rnd = mulberry32(hashSeed(seed));
  const patterns: Array<"whorl" | "loop" | "arch"> = ["whorl", "loop", "arch"];
  const pattern = patterns[Math.floor(rnd() * patterns.length)];
  const rotation = (rnd() - 0.5) * 18; // ميلان طبيعي كضغطة إصبع
  const cx = W / 2 + (rnd() - 0.5) * 10;
  const cy = H / 2 + (rnd() - 0.5) * 8;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
  out.push(
    `<defs><radialGradient id="smudge" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#101b2d" stop-opacity="0.08"/>` +
      `<stop offset="65%" stop-color="#101b2d" stop-opacity="0.035"/>` +
      `<stop offset="100%" stop-color="#101b2d" stop-opacity="0"/>` +
      `</radialGradient></defs>`
  );
  /* لطخة الحبر الخفيفة خلف البصمة — أثر الضغط على الورق */
  out.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(W * 0.46).toFixed(1)}" ry="${(H * 0.43).toFixed(1)}" fill="url(#smudge)"/>`);

  const group: string[] = [];
  group.push(`<g transform="rotate(${rotation.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">`);

  const ridgeCount = 26 + Math.floor(rnd() * 8);
  const baseR = 5;
  const spacing = 3.4;

  const addRidge = (r: number, a0: number, a1: number, coreShiftY = 0) => {
    const rx = r * (0.92 + rnd() * 0.14);
    const ry = r * (1.05 + rnd() * 0.18);
    const rot = (rnd() - 0.5) * 0.3;
    const cyy = cy + coreShiftY;
    const span = a1 - a0;
    const steps = Math.max(10, Math.floor((span / (Math.PI * 2)) * 64 * (r / 50 + 0.6)));
    const pts: string[] = [];
    let skip = -1;
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (span * i) / steps;
      if (t < skip) continue;
      const ang = t + rot;
      const jx = (rnd() - 0.5) * 2.2;
      const jy = (rnd() - 0.5) * 2.2;
      const x = cx + Math.cos(ang) * rx + jx;
      const y = cyy + Math.sin(ang) * ry * 0.9 + jy;
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
      /* انكسارات طبيعية في النقوش (minutiae) */
      if (rnd() < 0.09) skip = t + 0.18 + rnd() * 0.4;
    }
    if (pts.length < 4) return;
    const opacity = (0.72 + rnd() * 0.24).toFixed(2);
    const width = (2.3 + rnd() * 1.1).toFixed(1);
    group.push(
      `<path d="M ${pts.join(" L ")}" fill="none" stroke="#16202f" stroke-width="${width}" ` +
        `stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`
    );
  };

  if (pattern === "whorl") {
    /* حلقات متحدة المركز مع انزياح خفيف — البصمة الملتفّة */
    for (let i = 0; i < ridgeCount; i++) addRidge(baseR + i * spacing, 0, Math.PI * 2);
  } else if (pattern === "loop") {
    /* أقواس متداخلة مفتوحة الأسفل — البصمة الحلقية */
    for (let i = 0; i < ridgeCount; i++) {
      const r = baseR + i * spacing;
      addRidge(r, 0.15 * Math.PI, 0.85 * Math.PI, i * 0.9);
    }
    addRidge(7, 0.05 * Math.PI, 0.95 * Math.PI, 2);
  } else {
    /* موجات متتابعة — البصمة القوسية */
    for (let i = 0; i < ridgeCount; i++) {
      addRidge(baseR + i * spacing * 1.12, 0.22 * Math.PI, 0.78 * Math.PI, i * 0.4);
    }
    addRidge(16, -0.22 * Math.PI, 0.05 * Math.PI, -8);
    addRidge(20, -0.22 * Math.PI, 0.05 * Math.PI, 12);
  }

  /* ذرات حبر متناثرة خفيفة */
  for (let i = 0; i < 7; i++) {
    const x = cx + (rnd() - 0.5) * W * 0.7;
    const y = cy + (rnd() - 0.5) * H * 0.7;
    group.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.4 + rnd() * 0.8).toFixed(1)}" ` +
        `fill="#16202f" opacity="${(0.15 + rnd() * 0.3).toFixed(2)}"/>`
    );
  }

  group.push("</g>");
  out.push(...group, "</svg>");
  return out.join("");
}

const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** بيانات صورة البصمة (PNG عبر Canvas في المتصفح، أو SVG كاحتياط) */
export async function fingerprintDataUrl(seed: string, width = W * 2, height = H * 2): Promise<string> {
  const svg = fingerprintSVG(seed);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return svgDataUrl(svg);
    const img = new Image();
    img.src = svgDataUrl(svg);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("فشل رسم البصمة"));
    });
    /* خلفية بيضاء كأنها ورقة، ثم رسم البصمة */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return svgDataUrl(svg);
  }
}
