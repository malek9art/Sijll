/* ====== صفحة التحقق من المستندات عبر QR ====== */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { ShieldCheck, XCircle, BadgeCheck, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { documentsService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useNavigate } from "@/lib/router";
import { Badge, Button, Card } from "@/components/ui";
import { DOC_TYPES } from "@/lib/types";
import { fmtDate, toDigits } from "@/lib/utils";

export function VerifyPage({ number }: { number: string }) {
  const { settings } = useApp();
  const navigate = useNavigate();
  const arabic = settings.arabicDigits;
  const doc = useLiveQuery(() => documentsService.byNumber(number), [number]);
  const [qr, setQr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(`sajil://verify/${number}`, { width: 120, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [number]);

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
                <p className="flex justify-between"><span className="text-slate-400">الحالة</span>
                  <Badge className={doc.status === "final" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                    {doc.status === "final" ? "معتمد ونهائي" : "مسودة"}
                  </Badge>
                </p>
              </div>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck size={13} className="text-brand-600" />
                صادر من {settings.orgName} — {settings.orgCity}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                <XCircle size={30} />
              </div>
              <p className="mt-3 text-lg font-black text-rose-600 dark:text-rose-400">تعذر التحقق من المستند</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                الرقم <b dir="ltr">{toDigits(number, arabic)}</b> غير موجود في قاعدة البيانات، أو أن المستند صادر من جهة أخرى.
              </p>
            </>
          )}
          <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("dashboard")}><ArrowRight size={15} /> العودة للتطبيق</Button>
        </Card>

        <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
          للتحقق من أي مستند صادر من سجل، امسح رمز QR المطبوع على المستند أو أدخل رقم التحقق.
        </p>
      </div>
    </div>
  );
}
