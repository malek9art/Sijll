/* ====== خدمة توليد PDF احترافي + المشاركة عبر واتساب ======
 * تعتمد على تحويل ورقة A4 المعروضة (بنفس خطوط النظام العربية) إلى صفحات PDF
 * مما يضمن تشكيلاً عربياً مثالياً ومطابقة بصرية 100٪ للطباعة.
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const A4_W_MM = 210;
const A4_H_MM = 297;

export interface PdfBuildOptions {
  /** جودة العرض — 2 كافية للطباعة، 3 لأعلى دقة */
  scale?: number;
}

/** تحويل عنصر DOM إلى Canvas بدقة عالية */
async function elementToCanvas(el: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
}

/** بناء ملف PDF متعدد الصفحات بمقاس A4 من ورقة معروضة */
export async function buildPDFBlob(el: HTMLElement, options: PdfBuildOptions = {}): Promise<Blob> {
  const scale = options.scale ?? Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const canvas = await elementToCanvas(el, scale);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({
    title: el.dataset.title || "مستند سجل",
    subject: "مستند صادر من منصة سجل",
    creator: "SAJIL — سجل",
    author: el.dataset.org || "سجل",
  });

  const pxPerMm = canvas.width / A4_W_MM;
  const pageHeightPx = Math.floor(A4_H_MM * pxPerMm);

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvas.height - 2) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.94);
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, A4_W_MM, sliceHeight / pxPerMm, undefined, "FAST");

    offsetY += sliceHeight;
    pageIndex++;
  }

  return pdf.output("blob");
}

/** تنظيف اسم الملف من الرموز غير المسموحة */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\n\r\t]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** تنزيل Blob كملف */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

/** توليد وتنزيل PDF */
export async function downloadPDF(el: HTMLElement, filename: string): Promise<void> {
  const blob = await buildPDFBlob(el);
  downloadBlob(blob, safeFileName(filename));
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * مشاركة ملف PDF عبر واتساب:
 * 1) عند دعم Web Share API للملفات (الجوال) — يُشارك الملف مباشرة لاختيار واتساب.
 * 2) خلاف ذلك — يُنزّل الملف ويُفتح واتساب ويب برسالة جاهزة لإرفاقه.
 */
export async function sharePDFviaWhatsApp(
  el: HTMLElement,
  filename: string,
  message: string,
  phone?: string
): Promise<ShareResult> {
  const blob = await buildPDFBlob(el);
  const safe = safeFileName(filename);
  const file = new File([blob], safe, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: safe.replace(/\.pdf$/i, ""), text: message });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      /* المتابعة للخيار البديل */
    }
  }

  downloadBlob(blob, safe);
  const base = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  return "downloaded";
}
