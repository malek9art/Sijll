/* ====== صفحة التحقق من المستندات عبر QR ======
 * وضعان للتحقق:
 *  1) محلي: عند توفر قاعدة البيانات (جهاز المُصدِر) — فحص كامل للمستند.
 *  2) مستقل: من بيانات مضمّنة في رمز QR نفسه (تعمل على أي جهاز دون التطبيق)
 *     عبر بصمة المستند الرقمية (SHA-256) — تُحسب وتُقارن لحظياً.
 * رمز QR يحمل رابط صفحة التحقق المستقلة verify.html (خارج النظام).
 */
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { ShieldCheck, XCircle, BadgeCheck, ArrowRight, ExternalLink, Copy, Check, Fingerprint } from "lucide-react";
import { Logo } from "@/components/Logo";
import { documentsService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useHashRoute, useNavigate } from "@/lib/router";
import { Badge, Button, Card } from "@/components/ui";
import { DOC_TYPES, type DocType } from "@/lib/types";
import { buildDocVerifyUrl, docVerifyCanonical, fmtDate, sha256Hex, toDigits } from "@/lib/utils";

export function VerifyPage({ number }: { number: string }) {
  const { settings } = useApp();
  const navigate = useNavigate();
  const route = useHashRoute();
  const arabic = settings.arabicDigits;
  const doc = useLiveQuery(() => documentsService.byNumber(number), [number]);
  const [qr, setQr] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [copied, setCopied] = useState(false);

  /* بيانات مضمّنة في الرابط (قادمة من رمز QR أو مشاركة) */
  const embedded = useMemo(() => {
    const p = route.search;
    if (!p.get("v") || !p.get("n") || !p.get("x")) return null;
    return {
      n: p.get("n") || "",
      t: (p.get("t") as DocType) || "custom",
      h: p.get("h") || "",
      d: p.get("d") || "",
      a: p.get("a") || "",
      c: p.get("c") || "",
      o: p.get("o") || "",
      s: p.get("s") || "0",
      x: p.get("x") || "",
    };
  }, [route.search]);

  /* التحقق من بصمة المستند الرقمية للبيانات المضمّنة */
  const [embeddedOk, setEmbeddedOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (embedded) {
      computeDigestMatches(embedded)
        .then((ok) => { if (!cancelled) setEmbeddedOk(ok); })
        .catch(() => { if (!cancelled) setEmbeddedOk(false); });
    }
    return () => { cancelled = true; };
  }, [embedded]);
  /* عند غياب بيانات مضمّنة تكون النتيجة محايدة دائماً */
  const verifyState = embedded ? embeddedOk : null;

  useEffect(() => {
    if (!doc) return;
    buildDocVerifyUrl(doc, settings.orgName, doc.signatures?.length || 0)
      .then((url) => { setVerifyUrl(url); return QRCode.toDataURL(url, { width: 132, margin: 1 }); })
      .then(setQr)
      .catch(() => setQr(""));
  }, [doc, settings.orgName]);

  const copyUrl = async () => {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* الحافظة غير متاحة */ }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <Logo size={64} className="mx-auto drop-shadow-lg" />
          <h1 className="mt-3 text-xl font-black text-slate-900 dark:text-white">خدمة التحقق من المستندات</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">منصة سجل · تطوير Malek Logic</p>
        </div>

        <Card className="p-6 text-center">
          {doc ? (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <BadgeCheck size={30} />
              </div>
              <p className="mt-3 text-lg font-black text-emerald-600 dark:text-emerald-400">مستند صحيح وموثق</p>
              <p className="mt-1 text-xs text-slate-400">رقم التحقق: {toDigits(doc.number, arabic)}</p>
              {qr && <img src={qr} alt="QR" className="mx-auto mt-4 h-24 w-24" />}
              <div className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4 text-right text-[13px] dark:bg-slate-800/60">
                <p className="flex justify-between"><span className="text-slate-400">نوع المستند</span><b>{DOC_TYPES[doc.type].icon} {DOC_TYPES[doc.type].label}</b></p>
                <p className="flex justify-between"><span className="text-slate-400">العنوان</span><b className="max-w-52 truncate">{doc.title}</b></p>
                <p className="flex justify-between"><span className="text-slate-400">تاريخ التحرير</span><b>{fmtDate(doc.date, arabic)}</b></p>
                <p className="flex justify-between"><span className="text-slate-400">تاريخ الاعتماد</span><b>{fmtDate(doc.createdAt, arabic)}</b></p>
                <p className="flex justify-between"><span className="text-slate-400">التواقيع الموثقة</span>
                  <b className="flex items-center gap-1 text-emerald-600"><Fingerprint size={13} /> {toDigits(doc.signatures?.length || 0, arabic)} توقيع</b>
                </p>
                <p className="flex justify-between"><span className="text-slate-400">الحالة</span>
                  <Badge className={doc.status === "final" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                    {doc.status === "final" ? "معتمد ونهائي" : "مسودة"}
                  </Badge>
                </p>
              </div>
              {verifyUrl && (
                <div className="mt-4 space-y-2">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(verifyUrl, "_blank", "noopener")}>
                    <ExternalLink size={14} /> فتح صفحة التحقق المستقلة
                  </Button>
                  <Button size="sm" variant="ghost" className="w-full" onClick={copyUrl}>
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copied ? "تم النسخ" : "نسخ رابط التحقق"}
                  </Button>
                </div>
              )}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck size={13} className="text-brand-600" />
                صادر من {settings.orgName} — {settings.orgCity}
              </p>
            </>
          ) : embedded ? (
            <EmbeddedResult
              fields={embedded}
              ok={verifyState}
              arabic={arabic}
              onOpen={() => {
                const standalone = new URL("verify.html", window.location.href);
                standalone.search = route.search.toString();
                window.open(standalone.href, "_blank", "noopener");
              }}
            />
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                <XCircle size={30} />
              </div>
              <p className="mt-3 text-lg font-black text-rose-600 dark:text-rose-400">تعذر التحقق من المستند</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                الرقم <b dir="ltr">{toDigits(number, arabic)}</b> غير موجود في قاعدة البيانات المحلية.
                إن كنت تملك رمز QR أو رابط تحقق من جهة أخرى، جرّب <b>صفحة التحقق المستقلة</b> التي تعمل دون التطبيق.
              </p>
            </>
          )}
          <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("dashboard")}><ArrowRight size={15} /> العودة للتطبيق</Button>
        </Card>

        <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
          امسح رمز QR المطبوع على المستند لفتح صفحة التحقق المستقلة تلقائياً، أو أدخل رقم التحقق في التطبيق.
        </p>
      </div>
    </div>
  );
}

/* ====== التحقق من بصمة المستند الرقمية (SHA-256) للبيانات المضمّنة ====== */
async function computeDigestMatches(f: { n: string; t: string; h: string; d: string; a: string; c: string; o: string; s: string; x: string }): Promise<boolean> {
  try {
    const canonical = docVerifyCanonical({ n: f.n, t: f.t, h: f.h, d: f.d, a: f.a, c: f.c, o: f.o, s: f.s });
    const hex = await sha256Hex(canonical);
    return hex.slice(0, 16) === f.x;
  } catch {
    return false;
  }
}

function EmbeddedResult({ fields, ok, arabic, onOpen }: {
  fields: { n: string; t: string; h: string; d: string; a: string; c: string; o: string; s: string };
  ok: boolean | null;
  arabic: boolean;
  onOpen: () => void;
}) {
  const valid = ok === true;
  return (
    <>
      <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${valid ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"}`}>
        {valid ? <BadgeCheck size={30} /> : <ShieldCheck size={30} />}
      </div>
      <p className={`mt-3 text-lg font-black ${valid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
        {ok === null ? "جارٍ التحقق..." : valid ? "بيانات المستند سليمة ومطابقة للبصمة الرقمية" : "تحذير: البيانات لا تطابق البصمة الرقمية"}
      </p>
      <p className="mt-1 text-xs text-slate-400">رقم التحقق: {toDigits(fields.n, arabic)}</p>
      <div className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4 text-right text-[13px] dark:bg-slate-800/60">
        <p className="flex justify-between"><span className="text-slate-400">نوع المستند</span><b>{DOC_TYPES[fields.t as DocType]?.icon || "📄"} {DOC_TYPES[fields.t as DocType]?.label || "مستند"}</b></p>
        <p className="flex justify-between"><span className="text-slate-400">العنوان</span><b className="max-w-52 truncate">{fields.h || "—"}</b></p>
        <p className="flex justify-between"><span className="text-slate-400">تاريخ التحرير</span><b>{fmtDate(fields.d, arabic)}</b></p>
        <p className="flex justify-between"><span className="text-slate-400">المبلغ</span><b dir="ltr">{fields.a ? `${fields.a} ${fields.c}` : "—"}</b></p>
        <p className="flex justify-between"><span className="text-slate-400">الجهة المصدرة</span><b className="max-w-52 truncate">{fields.o || "—"}</b></p>
        <p className="flex justify-between"><span className="text-slate-400">التواقيع الموثقة</span><b>{toDigits(fields.s || "0", arabic)}</b></p>
      </div>
      {!valid && ok !== null && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11.5px] leading-6 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          لا يُنصح بالاعتماد على هذا المستند — يبدو أن بيانات الرمز تعرضت للتعديل أو التلف بعد إصداره.
        </p>
      )}
      <Button size="sm" variant="outline" className="mt-4 w-full" onClick={onOpen}>
        <ExternalLink size={14} /> فتح صفحة التحقق المستقلة
      </Button>
    </>
  );
}
