/* ====== محرك الطباعة الاحترافي A4 ====== */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import QRCode from "qrcode";
import { ArrowRight, Printer, BadgeCheck, Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import { db, accountingService, ledgerService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useHashRoute } from "@/lib/router";
import { Button } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { downloadPDF, sharePDFviaWhatsApp } from "@/lib/pdf";
import { CURRENCIES, DEBT_TYPES, DOC_TYPES, PAYMENT_METHODS, type Debt, type JournalEntry, type Payment } from "@/lib/types";
import { amountToWordsAr, currencySymbol, fmtDate, fmtMoney, hijriDate, toBase, toDigits, todayISO } from "@/lib/utils";

export function PrintPage() {
  const route = useHashRoute();
  const { settings, toast } = useApp();
  const [kind, key] = route.segments.slice(1); // doc | debt | account | ledger | report
  const params = route.search;
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  const getSheet = () => document.querySelector<HTMLElement>(".print-root .sheet");
  const titleOf = () => getSheet()?.dataset.title || "مستند";
  const fileNameOf = () => `سجل - ${titleOf()} - ${todayISO()}.pdf`;

  const handlePDF = async () => {
    const el = getSheet();
    if (!el || busy) return;
    setBusy("pdf");
    try {
      await downloadPDF(el, fileNameOf());
      toast("success", "تم تحميل ملف PDF", "جودة طباعة عالية بنفس خطوط النظام العربية");
    } catch {
      toast("error", "تعذر إنشاء ملف PDF", "أعد المحاولة بعد اكتمال تحميل الصفحة");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    const el = getSheet();
    if (!el || busy) return;
    setBusy("share");
    try {
      const message = `${titleOf()}\nصادر من: ${settings.orgName}\nبتاريخ: ${fmtDate(todayISO(), settings.arabicDigits)}\n(مرفق ملف PDF)`;
      const result = await sharePDFviaWhatsApp(el, fileNameOf(), message, phone || undefined);
      if (result === "shared") toast("success", "تمت المشاركة", "اختر واتساب من قائمة المشاركة");
      else if (result === "downloaded") toast("info", "تم تنزيل الملف وفتح واتساب", "أرفق الملف المُنزّل في المحادثة");
    } catch {
      toast("error", "تعذرت المشاركة", "جرّب تحميل الملف ثم إرساله يدوياً");
    } finally {
      setBusy(null);
    }
  };

  let content: ReactNode = null;
  if (kind === "doc" && key) content = <DocSheet id={key} />;
  else if (kind === "debt" && key) content = <DebtSheet id={key} />;
  else if (kind === "account" && key) content = <AccountSheet id={key} />;
  else if (kind === "ledger" && key) content = <LedgerSheet id={key} />;
  else if (kind === "report" && key) content = <ReportSheet kind={key} params={params} />;
  else content = <div className="text-center text-slate-500">لا يوجد محتوى للطباعة</div>;

  return (
    <div className="print-surface">
      <div className="no-print sticky top-3 z-40 mx-auto mb-6 w-fit max-w-[96vw]">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowRight size={15} /> رجوع</Button>
          <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={15} /> طباعة</Button>
          <Button size="sm" onClick={handlePDF} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {busy === "pdf" ? "جارٍ الإنشاء..." : "تحميل PDF"}
          </Button>
          <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1da851]" onClick={handleShare} disabled={busy !== null}>
            {busy === "share" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
            {busy === "share" ? "جارٍ التجهيز..." : "مشاركة واتساب"}
          </Button>
          <button
            onClick={() => setShowPhone((s) => !s)}
            title="تحديد رقم المستلم (اختياري)"
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 cursor-pointer"
          >
            <Share2 size={15} />
          </button>
        </div>
        {showPhone && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
            <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">رقم واتساب المستلم (اختياري):</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              placeholder="9665xxxxxxxx"
              className="h-8 w-44 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-[10px] text-slate-400">مع رمز الدولة بدون +</span>
          </div>
        )}
        <p className="mt-2 text-center text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
          A4 · تصميم عصري · ترويسة وتذييل ثابتان · تكرار رؤوس الجداول · خطوط عربية مطابقة للنظام
        </p>
      </div>
      {content}
    </div>
  );
}

/* ====== الترويسة ====== */
function SheetHeader({ sub, chips }: { sub?: string; chips?: string[] }) {
  const { settings } = useApp();
  const lines: string[] = [];
  if (settings.orgAddress) lines.push(settings.orgCity ? `${settings.orgAddress} — ${settings.orgCity}` : settings.orgAddress);
  const contact: string[] = [];
  if (settings.orgPhone) contact.push(`هاتف: ${settings.orgPhone}`);
  if (settings.orgEmail) contact.push(settings.orgEmail);
  if (contact.length) lines.push(contact.join(" · "));
  if (settings.orgLicense) lines.push(settings.orgLicense);

  return (
    <div className="avoid-break">
      <div className="sheet-head">
        <div className="min-w-0">
          <p className="sheet-org-name">{settings.orgName}</p>
          {lines.map((l, i) => <p key={i} className="sheet-org-line">{l}</p>)}
          {chips && chips.length > 0 && (
            <div className="sheet-meta">
              {chips.map((c, i) => <span key={i} className="sheet-chip">{c}</span>)}
            </div>
          )}
        </div>
        <div className="shrink-0 text-center">
          <Logo size={58} />
          <p className="mt-1 text-[8.5px] font-bold text-slate-500">منصة سجل</p>
        </div>
      </div>
      {sub && <p className="mt-1.5 text-left text-[9.5px] font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}

function SheetFooter() {
  const { settings } = useApp();
  return (
    <div className="sheet-foot avoid-break">
      <p>
        <span className="foot-brand">سجل</span> — {settings.orgName}
        {settings.orgPhone ? ` · هاتف: ${settings.orgPhone}` : ""}
      </p>
      <p>مستند صادر إلكترونياً · تاريخ الإصدار {fmtDate(new Date().toISOString(), true)} · يمكن التحقق من صحته عبر رمز QR عند وجوده</p>
      <p className="mt-0.5 font-bold text-slate-500">تطوير Malek Logic</p>
    </div>
  );
}

function Sheet({ children, title }: { children: ReactNode; title: string }) {
  const { settings } = useApp();
  return (
    <div className="print-root">
      <div className="sheet" data-title={title} data-org={settings.orgName}>
        {children}
      </div>
    </div>
  );
}

/* ====== رمز QR ====== */
function QrBox({ value, label }: { value: string; label: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: 96, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setUrl)
      .catch(() => setUrl(""));
  }, [value]);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-slate-300 bg-white p-1.5">
      {url ? <img src={url} alt="QR" className="h-[66px] w-[66px]" /> : <div className="h-[66px] w-[66px] border border-dashed border-slate-300" />}
      <span className="text-[8.5px] font-bold text-slate-600">{label}</span>
    </div>
  );
}

/* ====== المستند القانوني ====== */
function DocSheet({ id }: { id: string }) {
  const { settings } = useApp();
  const doc = useLiveQuery(() => db.documents.get(id), [id]);
  const party = useLiveQuery(() => (doc?.partyId ? db.parties.get(doc.partyId) : undefined), [doc?.partyId]);
  const arabic = settings.arabicDigits;

  const bodyHtml = useMemo(() => {
    if (!doc) return "";
    const ctx: Record<string, string> = {
      org_name: settings.orgName, org_address: settings.orgAddress, org_phone: settings.orgPhone,
      org_license: settings.orgLicense, org_city: settings.orgCity,
      party_name: party?.name || "________________", party_id: party?.idNumber || "________________",
      party_phone: party?.phone || "________________", party_address: party?.address || "________________",
      party_nationality: party?.nationality || "يمنية",
      amount: doc.amount ? `${fmtMoney(doc.amount, doc.currency, arabic)}` : "________________",
      amount_words: doc.amount ? amountToWordsAr(doc.amount, CURRENCIES[doc.currency].name) : "________________",
      currency: CURRENCIES[doc.currency].label,
      date_gregorian: fmtDate(doc.date, arabic), date_hijri: hijriDate(doc.date),
      due_date: doc.dueDate ? fmtDate(doc.dueDate, arabic) : "________________",
      debt_reason: doc.reason || "________________",
      witness1: doc.parties.find((p) => p.role.includes("الشاهد الأول"))?.name || "________________",
      witness2: doc.parties.find((p) => p.role.includes("الشاهد الثاني"))?.name || "________________",
      doc_number: toDigits(doc.number, arabic),
    };
    return doc.body.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => ctx[k] ?? "________________");
  }, [doc, party, settings, arabic]);

  if (!doc) return <div className="py-20 text-center text-slate-500">جاري تحميل المستند...</div>;

  const paragraphs = bodyHtml.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const debtor = doc.parties.find((p) => p.role.includes("الثاني")) || party;
  const signatories: { role: string; name: string }[] = [
    { role: "الطرف الأول", name: settings.orgName },
    { role: debtor ? "الطرف الثاني" : "المدين", name: (debtor && "name" in debtor ? debtor.name : "") || "________________" },
    ...doc.parties.filter((p) => p.role.includes("الشاهد")).map((p) => ({ role: p.role, name: p.name })),
  ];

  return (
    <Sheet title={doc.title}>
      <SheetHeader
        sub={`رقم المستند: ${toDigits(doc.number, arabic)} — تاريخ الإصدار: ${fmtDate(doc.createdAt, arabic, true)}`}
        chips={[DOC_TYPES[doc.type].label, `رقم ${doc.number}`, doc.status === "final" ? "معتمد" : "مسودة"]}
      />
      <div className="avoid-break info-card mt-3 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <BadgeCheck size={14} className="text-brand-700" />
            <span className="text-[11px] font-bold text-brand-800">مستند موثق إلكترونياً — رمز التحقق: {toDigits(doc.number, arabic)}</span>
          </div>
          <p className="mt-1 text-[10.5px] leading-6 text-slate-600">
            الجهة المصدرة: <b>{settings.orgName}</b>
          </p>
          <p className="text-[10.5px] leading-6 text-slate-600">تاريخ التحرير: {fmtDate(doc.date, arabic)} — الموافق {hijriDate(doc.date)}</p>
        </div>
        <QrBox value={`sajil://verify/${doc.number}`} label={`تحقق ${toDigits(doc.number, arabic)}`} />
      </div>

      <div className="doc-title mt-4">{doc.title}</div>
      <div className="doc-title-rule" />
      <div className="doc-body">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {doc.amount !== undefined && (
        <div className="avoid-break amount-box">
          <p className="text-[12px] font-bold">المبلغ بالكلمات: {doc.amount ? amountToWordsAr(doc.amount, CURRENCIES[doc.currency].name) : "—"}</p>
          <p>المبلغ بالأرقام: <b>({fmtMoney(doc.amount, doc.currency, arabic, 2)})</b> {CURRENCIES[doc.currency].label}</p>
        </div>
      )}

      <div className="avoid-break sign-row">
        {signatories.map((s, i) => (
          <div key={i} className="sign-box">
            <p className="text-[10.5px] font-bold text-slate-600">{s.role}</p>
            <div className="sign-line" />
            <p className="text-[11.5px] font-bold">{s.name}</p>
            <p className="text-[9.5px] text-slate-500">التوقيع والختم</p>
          </div>
        ))}
      </div>

      <div className="avoid-break mt-4 rounded-lg border border-slate-300 bg-slate-50 p-2 text-center text-[9.5px] leading-5 text-slate-600">
        حُرر هذا المستند برضا الطرفين وبكامل الأهلية المعتبرة شرعاً ونظاماً، ويُعتد به سنداً للحقوق الواردة فيه، ولا يتضمن أي فوائد أو زيادة على أصل المبلغ.
      </div>

      <SheetFooter />
    </Sheet>
  );
}

/* ====== كشف حساب ذمة ====== */
function DebtSheet({ id }: { id: string }) {
  const { settings } = useApp();
  const arabic = settings.arabicDigits;
  const debt = useLiveQuery(() => db.debts.get(id), [id]);
  const party = useLiveQuery(() => (debt ? db.parties.get(debt.partyId) : undefined), [debt?.partyId]);
  const pays = useLiveQuery(() => (debt ? db.payments.where("debtId").equals(debt.id).sortBy("date") : Promise.resolve([] as Payment[])), [debt?.id]) || [];

  if (!debt) return <div className="py-20 text-center text-slate-500">جاري التحميل...</div>;
  const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, debt.amount - totalPaid);

  return (
    <Sheet title={`كشف ذمة ${debt.number} - ${party?.name || ""}`}>
      <SheetHeader
        sub={`كشف حساب ذمة — ${toDigits(debt.number, arabic)} — تاريخ الإصدار: ${fmtDate(new Date().toISOString(), arabic)}`}
        chips={[DEBT_TYPES[debt.type].label, `رقم ${debt.number}`, CURRENCIES[debt.currency].label]}
      />
      <p className="doc-title">كشف حساب ذمة</p>
      <p className="doc-subtitle">{party?.name || ""} — رقم {toDigits(debt.number, arabic)}</p>
      <div className="doc-title-rule" />

      <div className="avoid-break info-card">
        <div className="info-grid">
          <p><span>الطرف: </span><b>{party?.name || "—"}</b></p>
          <p><span>نوع الذمة: </span><b>{DEBT_TYPES[debt.type].label}</b></p>
          <p><span>رقم الهوية: </span><b>{party?.idNumber || "—"}</b></p>
          <p><span>تاريخ تسجيل العملية: </span><b>{fmtDate(debt.date, arabic)}</b></p>
          <p><span>الهاتف: </span><b>{party?.phone || "—"}</b></p>
          <p><span>عدد الدفعات المسجلة: </span><b>{toDigits(pays.length, arabic)}</b></p>
        </div>
        <p><span className="text-slate-500">البيان: </span><b>{debt.reason}</b></p>
      </div>

      <div className="avoid-break summary-grid">
        <div className="summary-item"><p className="k">المبلغ الأصلي</p><p className="v">{fmtMoney(debt.amount, debt.currency, arabic, 2)}</p></div>
        <div className="summary-item"><p className="k">إجمالي المسدد</p><p className="v">{fmtMoney(totalPaid, debt.currency, arabic, 2)}</p></div>
        <div className="summary-item accent"><p className="k">المتبقي</p><p className="v">{fmtMoney(remaining, debt.currency, arabic, 2)}</p></div>
      </div>

      <p className="keep-with-next mt-4 text-[11.5px] font-bold text-slate-700">المدفوعات المسجلة (سداد دون فوائد)</p>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>البيان</th><th>الطريقة</th><th>المرجع</th><th>المبلغ</th></tr>
        </thead>
        <tbody>
          {pays.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500">لا توجد مدفوعات مسجلة</td></tr>}
          {pays.map((p: Payment) => (
            <tr key={p.id}><td className="text-center">{fmtDate(p.date, arabic)}</td><td>{p.notes || "دفعة على الحساب"}</td><td className="text-center">{PAYMENT_METHODS[p.method].label}</td><td className="text-center">{p.reference || "—"}</td><td className="text-center">{fmtMoney(p.amount, p.currency, arabic)}</td></tr>
          ))}
          <tr className="total-row"><td colSpan={4}>إجمالي المسدد</td><td className="text-center">{fmtMoney(totalPaid, debt.currency, arabic, 2)}</td></tr>
        </tbody>
      </table>

      <div className="avoid-break amount-box">
        <p className="font-bold text-[12px]">الرصيد المتبقي: {fmtMoney(remaining, debt.currency, arabic, 2)}</p>
        <p>وبالحروف: {amountToWordsAr(remaining, CURRENCIES[debt.currency].name)}</p>
      </div>

      <div className="avoid-break sign-row">
        {[{ role: "ممثل الجهة", name: settings.orgName }, { role: "الطرف", name: party?.name || "________________" }].map((s, i) => (
          <div key={i} className="sign-box">
            <p className="text-[10.5px] font-bold text-slate-600">{s.role}</p>
            <div className="sign-line" />
            <p className="text-[11.5px] font-bold">{s.name}</p>
          </div>
        ))}
      </div>
      <SheetFooter />
    </Sheet>
  );
}

/* ====== كشف حساب ====== */
function AccountSheet({ id }: { id: string }) {
  const { settings } = useApp();
  const arabic = settings.arabicDigits;
  const account = useLiveQuery(() => db.accounts.get(id), [id]);
  const entries = useLiveQuery(() => db.journalEntries.toArray()) || [];

  if (!account) return <div className="py-20 text-center">...جارٍ التحميل</div>;
  const lines = entries
    .flatMap((e) => e.lines.filter((l) => l.accountId === id).map((l) => ({ entry: e, line: l })))
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date));
  let balance = account.openingBalance;
  const isDebitNormal = account.type === "asset" || account.type === "expense";
  const rows = lines.map(({ entry, line }) => {
    const debit = isDebitNormal ? line.debit : line.credit;
    const credit = isDebitNormal ? line.credit : line.debit;
    balance = balance + debit - credit;
    return { entry, debit, credit, balance };
  });
  const totalD = rows.reduce((s, r) => s + r.debit, 0);
  const totalC = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <Sheet title={`كشف حساب ${account.name}`}>
      <SheetHeader
        sub={`كشف حساب: ${account.code} — ${account.name} — حتى ${fmtDate(todayISO(), arabic)}`}
        chips={[`كود ${account.code}`, account.name, CURRENCIES[settings.baseCurrency].label]}
      />
      <table className="mt-4">
        <thead>
          <tr><th>#</th><th>التاريخ</th><th>رقم القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>
        </thead>
        <tbody>
          <tr><td className="text-center">—</td><td className="text-center">—</td><td className="text-center">—</td><td>رصيد افتتاحي</td><td className="text-center">{isDebitNormal ? fmtMoney(account.openingBalance, settings.baseCurrency, arabic) : "—"}</td><td className="text-center">{!isDebitNormal ? fmtMoney(account.openingBalance, settings.baseCurrency, arabic) : "—"}</td><td className="text-center font-bold">{fmtMoney(account.openingBalance, settings.baseCurrency, arabic)}</td></tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-center">{toDigits(i + 1, arabic)}</td>
              <td className="text-center">{fmtDate(r.entry.date, arabic)}</td>
              <td className="text-center">{toDigits(r.entry.number, arabic)}</td>
              <td>{r.entry.description}</td>
              <td className="text-center">{r.debit > 0 ? fmtMoney(r.debit, r.entry.currency, arabic) : "—"}</td>
              <td className="text-center">{r.credit > 0 ? fmtMoney(r.credit, r.entry.currency, arabic) : "—"}</td>
              <td className="text-center font-bold">{fmtMoney(r.balance, settings.baseCurrency, arabic)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="font-bold">إجمالي الحركة</td>
            <td className="text-center font-bold">{fmtMoney(totalD, settings.baseCurrency, arabic)}</td>
            <td className="text-center font-bold">{fmtMoney(totalC, settings.baseCurrency, arabic)}</td>
            <td className="text-center font-bold">{fmtMoney(balance, settings.baseCurrency, arabic)}</td>
          </tr>
        </tbody>
      </table>
      <div className="avoid-break sign-row">
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">أعدّ</p><div className="sign-line" /><p className="text-[11.5px] font-bold">{settings.orgName}</p></div>
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">اعتمد</p><div className="sign-line" /><p className="text-[11.5px] font-bold">المدير المالي</p></div>
      </div>
      <SheetFooter />
    </Sheet>
  );
}

/* ====== كشف الحساب الموحد — دفتر الحسابات ====== */
function LedgerSheet({ id }: { id: string }) {
  const { settings } = useApp();
  const arabic = settings.arabicDigits;
  const account = useLiveQuery(() => db.ledgerAccounts.get(id), [id]);
  const entries = useLiveQuery(() => ledgerService.entriesOf(id), [id]) || [];

  if (!account) return <div className="py-20 text-center text-slate-500">جاري تحميل الكشف...</div>;

  let bal = 0;
  const rows = entries.map((e) => {
    bal = Math.round((bal + e.credit - e.debit) * 100) / 100;
    return { e, bal };
  });
  const credit = entries.reduce((s, e) => s + e.credit, 0);
  const debit = entries.reduce((s, e) => s + e.debit, 0);
  const cur = CURRENCIES[account.currency];
  const fmt = (v: number) => fmtMoney(v, account.currency, arabic, 2);
  let prevGroup = "";

  return (
    <Sheet title={`كشف حساب ${account.name}`}>
      <SheetHeader
        sub={`تاريخ الطباعة: ${fmtDate(new Date().toISOString(), arabic)}`}
        chips={[cur.label, account.type === "receivable" ? "مديونية عليه" : "مديونية علينا", `${toDigits(rows.length, arabic)} عملية`]}
      />

      <p className="doc-title">كشف حساب موحد</p>
      <p className="doc-subtitle">{account.name}</p>
      <div className="doc-title-rule" />

      <div className="avoid-break info-card">
        <div className="info-grid">
          <p><span>صاحب الحساب: </span><b>{account.name}</b></p>
          <p><span>العملة: </span><b>{cur.label} ({cur.symbol})</b></p>
          <p><span>نوع الحساب: </span><b>{account.type === "receivable" ? "مديونية طرف لنا (عليه)" : "مديونية علينا (له)"}</b></p>
          <p><span>عدد العمليات: </span><b>{toDigits(rows.length, arabic)}</b></p>
          {rows.length > 0 && <p><span>من تاريخ: </span><b>{fmtDate(rows[0].e.date, arabic)}</b></p>}
          {rows.length > 0 && <p><span>إلى تاريخ: </span><b>{fmtDate(rows[rows.length - 1].e.date, arabic)}</b></p>}
        </div>
        {account.notes && <p className="mt-1 text-slate-500">{account.notes}</p>}
      </div>

      <div className="avoid-break summary-grid">
        <div className="summary-item"><p className="k">إجمالي الدائن (زيادة)</p><p className="v">{fmt(credit)}</p></div>
        <div className="summary-item"><p className="k">إجمالي المدين (نقص)</p><p className="v">{fmt(debit)}</p></div>
        <div className="summary-item accent"><p className="k">الرصيد المتبقي</p><p className="v">{fmt(bal)}</p></div>
      </div>

      <p className="keep-with-next mt-4 text-[11.5px] font-bold text-slate-700">بيان العمليات التفصيلي</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: "4%" }}>#</th>
            <th style={{ width: "11%" }}>التاريخ</th>
            <th style={{ width: "12%" }}>الجهة المنفذة</th>
            <th style={{ width: "12%" }}>رقم المرجع</th>
            <th style={{ width: "32%" }}>البيان التفصيلي</th>
            <th style={{ width: "9%" }}>دائن</th>
            <th style={{ width: "9%" }}>مدين</th>
            <th style={{ width: "11%" }}>الرصيد المتبقي</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="text-center text-slate-500">لا توجد عمليات مسجلة</td></tr>}
          {rows.map(({ e, bal: rb }, i) => {
            const isGroupStart = !!e.groupId && e.groupId !== prevGroup;
            if (e.groupId) prevGroup = e.groupId;
            return (
              <Fragment key={e.id}>
                {isGroupStart && (
                  <tr className="avoid-break group-row">
                    <td colSpan={8}>◆ {e.groupLabel || "قيد محاسبي مزدوج"} ◆</td>
                  </tr>
                )}
                <tr>
                  <td className="text-center">{toDigits(i + 1, arabic)}</td>
                  <td className="text-center">{fmtDate(e.date, arabic)}</td>
                  <td className="text-center">{e.entity}</td>
                  <td className="text-center" dir="ltr">{e.reference}</td>
                  <td className="text-[10px] leading-5">{e.description}</td>
                  <td className="text-center font-bold">{e.credit > 0 ? fmt(e.credit) : "—"}</td>
                  <td className="text-center font-bold">{e.debit > 0 ? fmt(e.debit) : "—"}</td>
                  <td className="text-center font-bold">{fmt(rb)}</td>
                </tr>
              </Fragment>
            );
          })}
          <tr className="avoid-break total-row">
            <td colSpan={5}>الإجمالي</td>
            <td className="text-center">{fmt(credit)}</td>
            <td className="text-center">{fmt(debit)}</td>
            <td className="text-center">{fmt(bal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="avoid-break amount-box">
        <p className="font-bold text-[12px]">الملخص المالي النهائي</p>
        <p>إجمالي الدائن (زيادة في المديونية): <b>{fmt(credit)}</b> · إجمالي المدين (نقص في المديونية): <b>{fmt(debit)}</b></p>
        <p className="font-bold">الرصيد المتبقي: {fmt(bal)}</p>
        <p>وبالحروف: {amountToWordsAr(bal, cur.name)}</p>
      </div>

      <div className="avoid-break sign-row">
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">صاحب الحساب</p><div className="sign-line" /><p className="text-[11.5px] font-bold">{account.name}</p></div>
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">مصدر الكشف</p><div className="sign-line" /><p className="text-[11.5px] font-bold">{settings.orgName}</p></div>
      </div>

      <SheetFooter />
    </Sheet>
  );
}

/* ====== التقارير ====== */
function ReportSheet({ kind, params }: { kind: string; params: URLSearchParams }) {
  const { settings } = useApp();
  const arabic = settings.arabicDigits;
  const base = settings.baseCurrency;
  const from = params.get("from") || `${new Date().getFullYear()}-01-01`;
  const to = params.get("to") || todayISO();

  /* الأرصدة حتى تاريخ نهاية الفترة — موحّدة بالعملة الأساسية عبر أسعار الصرف */
  const balances = useLiveQuery(() => accountingService.balances(settings.exchangeRates, base, to), [settings.exchangeRates, base, to]) || [];
  const entries = useLiveQuery(() => db.journalEntries.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const party = useLiveQuery(() => (params.get("partyId") ? db.parties.get(params.get("partyId")!) : undefined), [params.get("partyId")]);
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const titles: Record<string, string> = {
    trial: "ميزان المراجعة", balance: "الميزانية العمومية", income: "قائمة الدخل",
    cashflow: "قائمة التدفقات النقدية", aging: "أعمار العمليات المفتوحة",
    collections: "تقرير التحصيل", payments: "تقرير المدفوعات", party: "كشف حساب طرف",
  };
  const title = titles[kind] || "تقرير مالي";
  const inRange = (e: JournalEntry) => e.date >= from && e.date <= to;
  const inRangeP = (p: Payment) => p.date >= from && p.date <= to;
  const fx = (amt: number, cur: string) => toBase(amt, cur, settings.exchangeRates, base);
  /* التقارير اللحظية (ميزان/ميزانية) تُعرض "كما في" تاريخ النهاية، والتدفقية تُعرض عن الفترة */
  const isSnapshot = kind === "trial" || kind === "balance";
  const periodLabel = isSnapshot
    ? `كما في ${fmtDate(to, arabic)}`
    : `الفترة من ${fmtDate(from, arabic)} إلى ${fmtDate(to, arabic)}`;

  let body: ReactNode = null;

  if (kind === "trial") {
    const totalD = balances.reduce((s, b) => s + b.debit + (b.account.type === "asset" || b.account.type === "expense" ? b.opening : 0), 0);
    const totalC = balances.reduce((s, b) => s + b.credit + (b.account.type === "liability" || b.account.type === "equity" || b.account.type === "income" ? b.opening : 0), 0);
    body = (
      <table className="mt-4">
        <thead><tr><th>الكود</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.account.id}>
              <td className="text-center" dir="ltr">{toDigits(b.account.code, arabic)}</td>
              <td>{b.account.name}</td>
              <td className="text-center">{fmtMoney(b.debit + (b.account.type === "asset" || b.account.type === "expense" ? b.opening : 0), base, arabic)}</td>
              <td className="text-center">{fmtMoney(b.credit + (b.account.type === "liability" || b.account.type === "equity" || b.account.type === "income" ? b.opening : 0), base, arabic)}</td>
            </tr>
          ))}
          <tr><td colSpan={2} className="font-bold">الإجمالي</td><td className="text-center font-bold">{fmtMoney(totalD, base, arabic)}</td><td className="text-center font-bold">{fmtMoney(totalC, base, arabic)}</td></tr>
        </tbody>
      </table>
    );
  } else if (kind === "balance") {
    const assets = balances.filter((b) => b.account.type === "asset");
    const liabs = balances.filter((b) => b.account.type === "liability" || b.account.type === "equity");
    const totalA = assets.reduce((s, b) => s + b.balance, 0);
    const totalL = liabs.reduce((s, b) => s + b.balance, 0);
    body = (
      <div className="mt-4">
        <p className="keep-with-next text-[12.5px] font-bold">الأصول</p>
        <table><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>
          {assets.map((b) => <tr key={b.account.id}><td>{b.account.name}</td><td className="text-center">{fmtMoney(b.balance, base, arabic)}</td></tr>)}
          <tr><td className="font-bold">إجمالي الأصول</td><td className="text-center font-bold">{fmtMoney(totalA, base, arabic)}</td></tr>
        </tbody></table>
        <p className="keep-with-next mt-4 text-[12.5px] font-bold">الخصوم وحقوق الملكية</p>
        <table><thead><tr><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>
          {liabs.map((b) => <tr key={b.account.id}><td>{b.account.name}</td><td className="text-center">{fmtMoney(b.balance, base, arabic)}</td></tr>)}
          <tr><td className="font-bold">إجمالي الخصوم وحقوق الملكية</td><td className="text-center font-bold">{fmtMoney(totalL, base, arabic)}</td></tr>
        </tbody></table>
      </div>
    );
  } else if (kind === "income") {
    /* قائمة الدخل تُحتسب من قيود الفترة المحددة فقط (وليس كل الأوقات) */
    const accType = new Map(balances.map((b) => [b.account.id, b.account.type]));
    const accName = new Map(balances.map((b) => [b.account.id, b.account.name]));
    const incAcc = new Map<string, number>();
    const expAcc = new Map<string, number>();
    for (const e of entries.filter(inRange)) {
      for (const l of e.lines) {
        const t = accType.get(l.accountId);
        if (t === "income") incAcc.set(l.accountId, (incAcc.get(l.accountId) || 0) + fx(l.credit - l.debit, e.currency));
        if (t === "expense") expAcc.set(l.accountId, (expAcc.get(l.accountId) || 0) + fx(l.debit - l.credit, e.currency));
      }
    }
    const income = [...incAcc.values()].reduce((s, v) => s + v, 0);
    const expenses = [...expAcc.values()].reduce((s, v) => s + v, 0);
    const net = income - expenses;
    body = (
      <div className="mt-4">
        <table>
          <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
          <tbody>
            <tr><td className="font-bold">الإيرادات</td><td className="text-center font-bold">{fmtMoney(income, base, arabic)}</td></tr>
            {[...incAcc.entries()].map(([id, v]) => <tr key={id}><td className="pr-8">{accName.get(id)}</td><td className="text-center">{fmtMoney(v, base, arabic)}</td></tr>)}
            <tr><td className="font-bold">المصاريف</td><td className="text-center font-bold">{fmtMoney(expenses, base, arabic)}</td></tr>
            {[...expAcc.entries()].map(([id, v]) => <tr key={id}><td className="pr-8">{accName.get(id)}</td><td className="text-center">{fmtMoney(v, base, arabic)}</td></tr>)}
            <tr><td className="font-bold">صافي نتيجة الفترة ({net >= 0 ? "ربح" : "خسارة"})</td><td className="text-center font-bold">{fmtMoney(Math.abs(net), base, arabic)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  } else if (kind === "cashflow") {
    const cashIds = new Set(balances.filter((b) => b.account.code === "1100" || b.account.code === "1200").map((b) => b.account.id));
    const flows = entries.filter(inRange).flatMap((e) =>
      e.lines.filter((l) => cashIds.has(l.accountId)).map((l) => ({ entry: e, inflow: fx(l.debit, e.currency), outflow: fx(l.credit, e.currency) }))
    ).sort((a, b) => a.entry.date.localeCompare(b.entry.date));
    const inflow = flows.reduce((s, f) => s + f.inflow, 0);
    const outflow = flows.reduce((s, f) => s + f.outflow, 0);
    body = (
      <div className="mt-4">
        <table>
          <thead><tr><th>التاريخ</th><th>رقم القيد</th><th>البيان</th><th>داخل</th><th>خارج</th></tr></thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i}><td className="text-center">{fmtDate(f.entry.date, arabic)}</td><td className="text-center">{toDigits(f.entry.number, arabic)}</td><td>{f.entry.description}</td><td className="text-center">{f.inflow > 0 ? fmtMoney(f.inflow, base, arabic) : "—"}</td><td className="text-center">{f.outflow > 0 ? fmtMoney(f.outflow, base, arabic) : "—"}</td></tr>
            ))}
            <tr><td colSpan={3} className="font-bold">الإجمالي</td><td className="text-center font-bold">{fmtMoney(inflow, base, arabic)}</td><td className="text-center font-bold">{fmtMoney(outflow, base, arabic)}</td></tr>
            <tr><td colSpan={5} className="font-bold">صافي التدفق: {fmtMoney(inflow - outflow, base, arabic)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  } else if (kind === "aging") {
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);
    const rows = debts.filter((d) => d.type === "receivable" && d.status !== "settled" && d.status !== "cancelled").map((d) => {
      const rem = Math.max(0, d.amount - (paidMap.get(d.id) || 0));
      const age = Math.max(0, Math.round((Date.now() - new Date(d.date).getTime()) / 86400000));
      return { d, rem, age, b: age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3 };
    }).sort((a, b) => b.age - a.age);
    const buckets = [0, 0, 0, 0];
    rows.forEach((r) => { buckets[r.b] += r.rem; });
    body = (
      <table className="mt-4">
        <thead><tr><th>رقم العملية</th><th>الطرف</th><th>تاريخ التسجيل</th><th>العمر (يوماً)</th><th>حتى ٣٠</th><th>٣١-٦٠</th><th>٦١-٩٠</th><th>+٩٠</th><th>الإجمالي</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.d.id}>
              <td className="text-center" dir="ltr">{toDigits(r.d.number, arabic)}</td>
              <td>{partyMap.get(r.d.partyId)?.name || "—"}</td>
              <td className="text-center">{fmtDate(r.d.date, arabic)}</td>
              <td className="text-center">{toDigits(r.age, arabic)}</td>
              {[0, 1, 2, 3].map((i) => <td key={i} className="text-center">{r.b === i ? fmtMoney(r.rem, r.d.currency, arabic) : "—"}</td>)}
              <td className="text-center font-bold">{fmtMoney(r.rem, r.d.currency, arabic)}</td>
            </tr>
          ))}
          <tr><td colSpan={4} className="font-bold">الإجمالي</td>{buckets.map((b, i) => <td key={i} className="text-center font-bold">{fmtMoney(b, base, arabic)}</td>)}<td className="text-center font-bold">{fmtMoney(buckets.reduce((s, b) => s + b, 0), base, arabic)}</td></tr>
        </tbody>
      </table>
    );
  } else if (kind === "collections") {
    const monthly = new Map<string, number>();
    const rows = payments.filter(inRangeP).sort((a, b) => a.date.localeCompare(b.date));
    rows.forEach((p) => { const k = p.date.slice(0, 7); monthly.set(k, (monthly.get(k) || 0) + p.amount); });
    const total = rows.reduce((s, p) => s + p.amount, 0);
    body = (
      <div className="mt-4">
        <p className="keep-with-next text-[12.5px] font-bold">ملخص شهري</p>
        <table><thead><tr><th>الشهر</th><th>المحصل</th></tr></thead><tbody>
          {[...monthly.entries()].map(([k, v]) => <tr key={k}><td>{fmtDate(`${k}-01`, arabic)}</td><td className="text-center font-bold">{fmtMoney(v, base, arabic)}</td></tr>)}
          <tr><td className="font-bold">الإجمالي</td><td className="text-center font-bold">{fmtMoney(total, base, arabic)}</td></tr>
        </tbody></table>
        <p className="keep-with-next mt-4 text-[12.5px] font-bold">تفاصيل عمليات التحصيل</p>
        <table><thead><tr><th>التاريخ</th><th>الذمة</th><th>الطرف</th><th>الطريقة</th><th>المبلغ</th></tr></thead><tbody>
          {rows.map((p) => { const d = debts.find((x) => x.id === p.debtId); return (
            <tr key={p.id}><td className="text-center">{fmtDate(p.date, arabic)}</td><td className="text-center" dir="ltr">{toDigits(d?.number || "—", arabic)}</td><td>{d ? partyMap.get(d.partyId)?.name || "—" : "—"}</td><td className="text-center">{PAYMENT_METHODS[p.method].label}</td><td className="text-center">{fmtMoney(p.amount, p.currency, arabic)}</td></tr>
          ); })}
        </tbody></table>
      </div>
    );
  } else if (kind === "payments") {
    const rows = payments.filter(inRangeP).sort((a, b) => a.date.localeCompare(b.date));
    const byMethod = new Map<string, number>();
    rows.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.amount));
    const total = rows.reduce((s, p) => s + p.amount, 0);
    body = (
      <div className="mt-4">
        <table>
          <thead><tr><th>التاريخ</th><th>الذمة</th><th>الطرف</th><th>الطريقة</th><th>المرجع</th><th>المبلغ</th></tr></thead>
          <tbody>
            {rows.map((p) => { const d = debts.find((x) => x.id === p.debtId); return (
              <tr key={p.id}><td className="text-center">{fmtDate(p.date, arabic)}</td><td className="text-center" dir="ltr">{toDigits(d?.number || "—", arabic)}</td><td>{d ? partyMap.get(d.partyId)?.name || "—" : "—"}</td><td className="text-center">{PAYMENT_METHODS[p.method].label}</td><td className="text-center">{p.reference || "—"}</td><td className="text-center">{fmtMoney(p.amount, p.currency, arabic)}</td></tr>
            ); })}
            <tr><td colSpan={5} className="font-bold">الإجمالي</td><td className="text-center font-bold">{fmtMoney(total, base, arabic)}</td></tr>
          </tbody>
        </table>
        <p className="keep-with-next mt-4 text-[12.5px] font-bold">توزيع حسب طريقة السداد</p>
        <table><thead><tr><th>الطريقة</th><th>الإجمالي</th></tr></thead><tbody>
          {[...byMethod.entries()].map(([m, v]) => <tr key={m}><td>{PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS].label}</td><td className="text-center font-bold">{fmtMoney(v, base, arabic)}</td></tr>)}
        </tbody></table>
      </div>
    );
  } else if (kind === "party" && party) {
    const partyDebts = debts.filter((d) => d.partyId === party.id && d.status !== "cancelled");
    const rows: { date: string; desc: string; debit: number; credit: number }[] = [];
    for (const d of partyDebts) {
      rows.push({ date: d.date, desc: `عملية ${d.number} — ${d.reason || ""}`, debit: d.type === "receivable" ? d.amount : 0, credit: d.type === "payable" ? d.amount : 0 });
      for (const p of payments.filter((x) => x.debtId === d.id)) {
        rows.push({ date: p.date, desc: `دفعة — ${d.number} (${PAYMENT_METHODS[p.method].label})`, debit: d.type === "payable" ? p.amount : 0, credit: d.type === "receivable" ? p.amount : 0 });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    const final = rows.map((r) => { bal = bal + r.debit - r.credit; return { ...r, bal }; });
    const totalD = rows.reduce((s, r) => s + r.debit, 0);
    const totalC = rows.reduce((s, r) => s + r.credit, 0);
    body = (
      <div className="mt-4">
        <div className="mb-3 rounded border border-slate-400 p-3 text-[11.5px] leading-6">
          <p className="font-bold">{party.name}</p>
          <p>رقم الهوية: {party.idNumber || "—"} · الهاتف: {party.phone || "—"} · العنوان: {party.address || "—"}</p>
        </div>
        <table>
          <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
          <tbody>
            {final.map((r, i) => (
              <tr key={i}><td className="text-center">{fmtDate(r.date, arabic)}</td><td>{r.desc}</td><td className="text-center">{r.debit > 0 ? fmtMoney(r.debit, base, arabic) : "—"}</td><td className="text-center">{r.credit > 0 ? fmtMoney(r.credit, base, arabic) : "—"}</td><td className="text-center font-bold">{fmtMoney(r.bal, base, arabic)}</td></tr>
            ))}
            <tr><td colSpan={2} className="font-bold">الإجمالي</td><td className="text-center font-bold">{fmtMoney(totalD, base, arabic)}</td><td className="text-center font-bold">{fmtMoney(totalC, base, arabic)}</td><td className="text-center font-bold">{fmtMoney(bal, base, arabic)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Sheet title={title}>
      <SheetHeader
        sub={`تاريخ الطباعة: ${fmtDate(new Date().toISOString(), arabic)}`}
        chips={[title, periodLabel, `${CURRENCIES[base].label} (${currencySymbol(base)})`]}
      />
      <p className="doc-title">{title}</p>
      <p className="doc-subtitle">{periodLabel}</p>
      <div className="doc-title-rule" />
      {body}
      <div className="avoid-break sign-row">
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">أعدّ</p><div className="sign-line" /><p className="text-[11.5px] font-bold">{settings.orgName}</p></div>
        <div className="sign-box"><p className="text-[10.5px] font-bold text-slate-600">اعتمد</p><div className="sign-line" /><p className="text-[11.5px] font-bold">المدير المالي</p></div>
      </div>
      <SheetFooter />
    </Sheet>
  );
}

/* أنواع مساعدة */
export type { Debt };
