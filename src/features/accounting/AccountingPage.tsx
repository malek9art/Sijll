/* ====== المحاسبة: دليل الحسابات + قيود اليومية + التقارير ====== */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, Trash2, Scale, BookOpenText, FileBarChart2, Landmark, LineChart,
  Clock3, HandCoins, Wallet, ReceiptText, Users, Printer, Eye, CheckCircle2, XCircle,
} from "lucide-react";
import { db, journalService, accountingService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useHashRoute, useNavigate } from "@/lib/router";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td } from "@/components/ui";
import { ACCOUNT_TYPES, CURRENCIES, CURRENCY_KEYS, type AccountType, type Currency } from "@/lib/types";
import { fmtDate, fmtMoney, toDigits, todayISO, uid } from "@/lib/utils";
import { cn } from "@/utils/cn";

export function AccountingPage() {
  const { settings, toast } = useApp();
  const navigate = useNavigate();
  const route = useHashRoute();
  const arabic = settings.arabicDigits;
  /* فتح تبويب محدد عبر الرابط: accounting?tab=reports (من لوحة التحكم والتقارير) */
  const [tab, setTab] = useState<string>(() => {
    const t = route.search.get("tab");
    return t && ["ledger", "journal", "reports"].includes(t) ? t : "ledger";
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<string | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<string | null>(null);
  const [partyReport, setPartyReport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const entries = useLiveQuery(() => db.journalEntries.orderBy("date").reverse().toArray()) || [];
  const balances = useLiveQuery(() => accountingService.balances(settings.exchangeRates, settings.baseCurrency), [settings.exchangeRates, settings.baseCurrency]) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, page]);

  const totalDebit = balances.reduce((s, b) => s + b.debit + (b.account.type === "asset" || b.account.type === "expense" ? b.opening : 0), 0);
  const totalCredit = balances.reduce((s, b) => s + b.credit + (b.account.type === "liability" || b.account.type === "equity" || b.account.type === "income" ? b.opening : 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const reports: { key: string; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: "trial", label: "ميزان المراجعة", desc: "أرصدة جميع الحسابات في تاريخ محدد", icon: <Scale size={20} /> },
    { key: "balance", label: "الميزانية العمومية", desc: "المركز المالي: الأصول والخصوم وحقوق الملكية", icon: <Landmark size={20} /> },
    { key: "income", label: "قائمة الدخل", desc: "الإيرادات والمصاريف وصافي النتيجة", icon: <LineChart size={20} /> },
    { key: "cashflow", label: "التدفقات النقدية", desc: "الحركة النقدية الداخلة والخارجة", icon: <Wallet size={20} /> },
    { key: "aging", label: "تقادم الديون", desc: "تحليل الذمم المدينة حسب فترات التأخير", icon: <Clock3 size={20} /> },
    { key: "collections", label: "تقرير التحصيل", desc: "إجمالي المحصل من الذمم حسب الفترات", icon: <HandCoins size={20} /> },
    { key: "payments", label: "تقرير المدفوعات", desc: "تفصيل كامل لجميع المدفوعات المسجلة", icon: <ReceiptText size={20} /> },
    { key: "party", label: "كشف حساب طرف", desc: "حركة طرف (عميل/مورد) مع الرصيد", icon: <Users size={20} /> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="المحاسبة"
        description="محاسبة مزدوجة القيد: دليل الحسابات، قيود اليومية، والتقارير المالية"
        actions={
          <Button onClick={() => setEntryOpen(true)}><Plus size={17} /> قيد جديد</Button>
        }
      />

      <Tabs
        tabs={[
          { key: "ledger", label: "دفتر الأستاذ", icon: <BookOpenText size={14} /> },
          { key: "journal", label: "قيود اليومية", icon: <Scale size={14} />, count: entries.length },
          { key: "reports", label: "التقارير", icon: <FileBarChart2 size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === "ledger" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="text-slate-500 dark:text-slate-400">إجمالي المدين:</span>
                <span className="font-black text-brand-700 dark:text-brand-300">{fmtMoney(totalDebit, settings.baseCurrency, arabic)}</span>
                <span className="mx-1 text-slate-300">|</span>
                <span className="text-slate-500 dark:text-slate-400">إجمالي الدائن:</span>
                <span className="font-black text-brand-700 dark:text-brand-300">{fmtMoney(totalCredit, settings.baseCurrency, arabic)}</span>
                {balanced ? (
                  <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"><CheckCircle2 size={11} /> متوازن</Badge>
                ) : (
                  <Badge className="bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"><XCircle size={11} /> غير متوازن</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setAccountOpen(true)}><Plus size={14} /> حساب جديد</Button>
            </div>
            <Card className="overflow-hidden">
              <Table headers={["الكود", "الحساب", "النوع", "رصيد افتتاحي", "مدين", "دائن", "الرصيد", ""]} dense>
                {balances.map((b) => (
                  <tr key={b.account.id} className="transition-colors hover:bg-brand-50/40 dark:hover:bg-slate-800/40">
                    <Td className="font-mono text-xs font-bold text-slate-400" dir="ltr">{toDigits(b.account.code, arabic)}</Td>
                    <Td className="font-semibold">
                      {b.account.name}
                      {!b.account.isActive && <span className="mr-2 text-[10px] text-slate-300">(غير نشط)</span>}
                    </Td>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        {ACCOUNT_TYPES[b.account.type].label}
                      </Badge>
                    </Td>
                    <Td className="text-slate-400">{fmtMoney(b.opening, settings.baseCurrency, arabic)}</Td>
                    <Td>{fmtMoney(b.debit, settings.baseCurrency, arabic)}</Td>
                    <Td>{fmtMoney(b.credit, settings.baseCurrency, arabic)}</Td>
                    <Td className={cn("font-black", b.balance > 0 ? "text-brand-700 dark:text-brand-300" : b.balance < 0 ? "text-rose-600" : "text-slate-400")}>
                      {fmtMoney(b.balance, settings.baseCurrency, arabic)}
                    </Td>
                    <Td>
                      <button title="كشف حساب وطباعة" onClick={() => navigate(`print/account/${b.account.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 cursor-pointer">
                        <Printer size={15} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        )}

        {tab === "journal" && (
          <Card className="overflow-hidden">
            {entries.length === 0 ? (
              <EmptyState icon={<Scale size={28} />} title="لا توجد قيود بعد" description="رحّل أول قيد يومية مزدوج القيد لبدء المحاسبة" action={<Button onClick={() => setEntryOpen(true)}><Plus size={16} /> ترحيل قيد</Button>} />
            ) : (
              <>
              <Table headers={["رقم القيد", "التاريخ", "البيان", "عدد الأسطر", "القيمة", ""]} dense>
                {paginatedEntries.map((e) => {
                  const total = e.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-brand-50/40 dark:hover:bg-slate-800/40">
                      <Td className="font-bold text-brand-700 dark:text-brand-300" dir="ltr">{toDigits(e.number, arabic)}</Td>
                      <Td>{fmtDate(e.date, arabic)}</Td>
                      <Td className="max-w-64 truncate text-slate-600 dark:text-slate-300">{e.description}</Td>
                      <Td className="text-slate-400">{toDigits(e.lines.length, arabic)} أسطر</Td>
                      <Td className="font-bold">{fmtMoney(total, e.currency, arabic)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button aria-label="عرض" title="عرض" onClick={() => setViewEntry(e.id)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 cursor-pointer"><Eye size={15} /></button>
                          <button aria-label="حذف" title="حذف" onClick={() => setDeleteEntry(e.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    عرض {toDigits((page - 1) * pageSize + 1, arabic)}–{toDigits(Math.min(page * pageSize, entries.length), arabic)} من {toDigits(entries.length, arabic)} قيد
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← السابق</Button>
                    <span className="min-w-[80px] text-center text-[13px] font-bold text-slate-700 dark:text-slate-200">
                      {toDigits(page, arabic)} / {toDigits(totalPages, arabic)}
                    </span>
                    <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي →</Button>
                  </div>
                </div>
              )}
              </>
            )}
          </Card>
        )}

        {tab === "reports" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {reports.map((r) => (
              <Card key={r.key} className="group p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700" onClick={() => {
                if (r.key === "party") setPartyReport(true);
                else navigate(`print/report/${r.key}`);
              }}>
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{r.icon}</div>
                  <span className="rounded-lg bg-slate-50 p-2 text-slate-300 transition group-hover:bg-brand-50 group-hover:text-brand-600 dark:bg-slate-800 dark:group-hover:bg-brand-500/10">
                    <Printer size={15} />
                  </span>
                </div>
                <p className="mt-4 font-bold text-slate-900 dark:text-white">{r.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{r.desc}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} onDone={() => { setAccountOpen(false); toast("success", "تمت إضافة الحساب"); }} />
      <EntryModal open={entryOpen} onClose={() => setEntryOpen(false)} accounts={accounts} onDone={() => { setEntryOpen(false); toast("success", "تم ترحيل القيد", "تحقق التوازن بين المدين والدائن"); }} />

      {viewEntry && (
        <EntryView entryId={viewEntry} accounts={accounts} onClose={() => setViewEntry(null)} />
      )}

      <Modal open={partyReport} onClose={() => setPartyReport(false)} title="كشف حساب طرف">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">اختر الطرف لعرض كشف حسابه وطباعته:</p>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {parties.map((p) => (
              <button key={p.id} onClick={() => { setPartyReport(false); navigate(`print/report/party?partyId=${p.id}`); }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-right transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                <span className="text-xs text-slate-400">{p.phone || p.idNumber || ""}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {deleteEntry && (
        <Modal open onClose={() => setDeleteEntry(null)} title="حذف القيد">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            هل أنت متأكد من حذف هذا القيد نهائياً؟ سيؤثر ذلك على أرصدة الحسابات المرتبطة.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteEntry(null)}>إلغاء</Button>
            <Button variant="danger" onClick={async () => {
              await journalService.remove(deleteEntry);
              setDeleteEntry(null);
              toast("info", "تم حذف القيد");
            }}><Trash2 size={15} /> حذف نهائي</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ====== نموذج حساب ====== */
function AccountModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [opening, setOpening] = useState("0");

  return (
    <Modal open={open} onClose={onClose} title="إضافة حساب جديد">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="الكود" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: 1400" />
          </Field>
          <Field label="نوع الحساب" required>
            <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="اسم الحساب" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="رصيد افتتاحي">
          <Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button disabled={!code.trim() || !name.trim()} onClick={async () => {
            const exists = await db.accounts.where("code").equals(code.trim()).count();
            if (exists) { toast("error", "الكود مستخدم مسبقاً"); return; }
            await db.accounts.add({ id: uid("acc"), code: code.trim(), name: name.trim(), type, openingBalance: parseFloat(opening) || 0, isActive: true });
            onDone();
          }}><Plus size={16} /> إضافة</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== نموذج قيد ====== */
function EntryModal({ open, onClose, accounts, onDone }: { open: boolean; onClose: () => void; accounts: { id: string; code: string; name: string }[]; onDone: () => void }) {
  const { settings, toast } = useApp();
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);
  const [lines, setLines] = useState([{ accountId: "", debit: "", credit: "" }]);

  const totalD = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalC = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.round((totalD - totalC) * 100) / 100;

  const submit = async () => {
    if (!description.trim()) { toast("error", "أدخل بيان القيد"); return; }
    try {
      await journalService.add({
        date, description: description.trim(), currency,
        lines: lines.map((l) => ({ accountId: l.accountId, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })),
      });
      onDone();
    } catch (e) {
      toast("error", "تعذر ترحيل القيد", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="قيد يومية جديد" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="التاريخ" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="العملة">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCY_KEYS.map((c) => <option key={c} value={c}>{CURRENCIES[c].label}</option>)}
            </Select>
          </Field>
          <Field label="بيان القيد" required className="sm:col-span-1">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح القيد..." />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_130px_130px_40px] gap-2 border-b border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-400 dark:border-slate-800">
            <span>الحساب</span><span>مدين</span><span>دائن</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_130px_130px_40px] items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0 dark:border-slate-800/50">
              <Select value={l.accountId} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)))}>
                <option value="">— اختر الحساب —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </Select>
              <Input type="number" placeholder="0" value={l.debit} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, debit: e.target.value } : x)))} />
              <Input type="number" placeholder="0" value={l.credit} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, credit: e.target.value } : x)))} />
              <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:hover:bg-rose-500/10 cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={() => setLines((ls) => [...ls, { accountId: "", debit: "", credit: "" }])}
            className="m-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10 cursor-pointer">
            <Plus size={13} /> إضافة سطر
          </button>
        </div>

        <div className={cn("flex flex-wrap items-center justify-between rounded-xl px-4 py-3 text-sm font-bold",
          diff === 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300")}>
          <span>المدين: {fmtMoney(totalD, currency, true)} · الدائن: {fmtMoney(totalC, currency, true)}</span>
          <span>{diff === 0 ? "✓ القيد متوازن" : `الفرق: ${fmtMoney(diff, currency, true)}`}</span>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={diff !== 0 || !description.trim() || lines.some((l) => !l.accountId)}><CheckCircle2 size={16} /> ترحيل القيد</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== عرض قيد ====== */
function EntryView({ entryId, accounts, onClose }: { entryId: string; accounts: { id: string; code: string; name: string }[]; onClose: () => void }) {
  const entry = useLiveQuery(() => db.journalEntries.get(entryId), [entryId]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  if (!entry) return null;
  const total = entry.lines.reduce((s, l) => s + l.debit, 0);
  return (
    <Modal open onClose={onClose} title={`قيد ${entry.number}`}>
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{fmtDate(entry.date, true, true)}</span>
          <span className="font-bold">{entry.description}</span>
        </div>
        <Table headers={["الحساب", "مدين", "دائن"]} dense>
          {entry.lines.map((l, i) => (
            <tr key={i}>
              <Td>{accMap.get(l.accountId)?.code} — {accMap.get(l.accountId)?.name || "حذف"}</Td>
              <Td className={l.debit > 0 ? "font-bold text-brand-700 dark:text-brand-300" : "text-slate-300"}>{l.debit > 0 ? fmtMoney(l.debit, entry.currency, true) : "—"}</Td>
              <Td className={l.credit > 0 ? "font-bold text-brand-700 dark:text-brand-300" : "text-slate-300"}>{l.credit > 0 ? fmtMoney(l.credit, entry.currency, true) : "—"}</Td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-black dark:bg-slate-800/50">
            <Td>الإجمالي</Td>
            <Td>{fmtMoney(total, entry.currency, true)}</Td>
            <Td>{fmtMoney(total, entry.currency, true)}</Td>
          </tr>
        </Table>
      </div>
    </Modal>
  );
}
