/* ====== المعاينة الحية — نفس لغة الطباعة مع نمط ورقي/رقمي ====== */
import DOMPurify from "dompurify";
import { BadgeCheck, FileSignature } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useApp } from "@/lib/store";
import type { TemplatePrintProfile } from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/utils";

interface DocumentPreviewProps {
  title: string;
  html: string;
  number?: string;
  date?: string;
  profile: TemplatePrintProfile;
  missingCount?: number;
}

export function DocumentPreview({ title, html, number, date, profile, missingCount = 0 }: DocumentPreviewProps) {
  const { settings } = useApp();
  const safeHtml = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onclick", "onload"],
  });
  const paper = profile.defaultMode === "paper";

  return (
    <div className="document-preview-frame">
      <article className={`sheet document-preview-sheet ${paper ? "document-paper-mode" : "document-digital-mode"}`} dir="rtl">
        {profile.showSystemHeader && (
          <header className="document-preview-header">
            <div>
              <p className="sheet-org-name">{settings.orgName || "اسم المصدر"}</p>
              {settings.orgAddress && <p className="sheet-org-line">{settings.orgAddress}</p>}
              {settings.orgPhone && <p className="sheet-org-line">هاتف: {settings.orgPhone}</p>}
              {number && <p className="sheet-org-line">رقم المستند: {number}</p>}
            </div>
            {profile.showLogo && <div className="text-center"><Logo size={52} /><p className="mt-1 text-[8px] font-bold text-slate-500">منصة سجل</p></div>}
          </header>
        )}

        <div className="document-preview-meta">
          {profile.showDigitalVerification ? <BadgeCheck size={14} /> : <FileSignature size={14} />}
          <span>{profile.showDigitalVerification ? "معاينة مستند رقمي موثق" : "معاينة نسخة ورقية رسمية"}</span>
          {date && <span className="mr-auto">{fmtDate(date, settings.arabicDigits)}</span>}
        </div>

        <h1 className="doc-title">{title || "عنوان المستند"}</h1>
        <div className="doc-title-rule" />
        {missingCount > 0 && <div className="document-preview-warning">يوجد {missingCount} متغير مطلوب لم تتم تعبئته بعد.</div>}
        <div className="doc-body" dangerouslySetInnerHTML={{ __html: safeHtml || "<p>ابدأ بكتابة نص المستند…</p>" }} />

        <div className="document-preview-signatures">
          {["الطرف الأول", "الطرف الثاني", "الشاهد الأول", "الشاهد الثاني"].map((role) => (
            <div key={role} className="sign-box">
              <p className="text-[10.5px] font-bold text-slate-600">{role}</p>
              <div className="sign-line" />
              <p className="text-[10px] text-slate-500">التوقيع والختم والبصمة</p>
            </div>
          ))}
        </div>

        {profile.showSystemFooter && (
          <footer className="sheet-foot">
            <p><span className="foot-brand">سجل</span> — معاينة قبل الطباعة</p>
            <p>تاريخ المعاينة: {fmtDate(todayISO(), settings.arabicDigits)}</p>
          </footer>
        )}
      </article>
    </div>
  );
}
