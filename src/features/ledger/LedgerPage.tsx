/* ====== دفتر الحسابات — كشف الحساب الموحد الاحترافي ====== */
import { Fragment, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, Printer, ArrowRight, Trash2, PenLine, NotebookPen, Layers, AlertTriangle, MessageCircle,
} from "lucide-react";
import { db, ledgerService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useHashRoute, useNavigate } from "@/lib/router";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Td, Textarea,
} from "@/components/ui";
import {
  CURRENCIES, CURRENCY_KEYS, LEDGER_ENTITIES,
  type Currency, type LedgerAccount, type LedgerEntry,
} from "@/lib/types";
import { amountToWordsAr, fmtDate, fmtMoney, toDigits, todayISO } from "@/lib/utils";
import { cn } from "@/utils/cn";

export function LedgerPage() {
  const route = useHashRoute();
  const accountId = route.segments[1];
  if (accountId) return <LedgerStatement accountId={accountId} />;
  return <LedgerList />;
}

/* ====== قائمة حسابات الدفتر ====== */
function LedgerList() {
  const { settings, toast } = useApp();
  const navigate = useNavigate();
  const arabic = settings.arabicDigits;
  const accounts = useLiveQuery(() => db.ledgerAccounts.toArray(), []) || [];
  const entries = useLiveQuery(() => db.ledgerEntries.toArray(), []) || [];
  const [accountOpen, setAccountOpen] = useState(false);
  const [deleteFor, setDeleteFor] = useState<LedgerAccount | null>(null);

  const rows = useMemo(() => accounts.map((a) => {
    const es = entries.filter((e) => e.accountId === a.id).sort((x, y) => x.seq - y.seq);
    const credit = es.reduce((s, e) => s + e.credit, 0);
    const debit = es.reduce((s, e) => s + e.debit, 0);
    return { account: a, count: es.length, credit, debit, balance: credit - debit, last: es[es.length - 1]?.date };
  }), [accounts, entries]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="دفتر الحسابات"
        description="كشوف حساب موحدة بمتابعة المديونية: الرقم التسلسلي، التاريخ، الجهة، المرجع، البيان، دائن، مدين، الرصيد المتبقي"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("accounting")}><NotebookPen size={16} /> دفتر الأستاذ المحاسبي</Button>
            <Button onClick={() => setAccountOpen(true)}><Plus size={17} /> حساب جديد</Button>
          </>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<NotebookPen size={28} />}
            title="لا توجد حسابات في الدفتر"
            description="أنشئ حساباً لتتبع مديونية شخص أو جهة بكشف حساب موحد احترافي"
            action={<Button onClick={() => setAccountOpen(true)}><Plus size={16} /> إنشاء حساب</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ account, count, balance, credit, debit, last }) => {
            const neg = balance < 0;
            return (
              <Card key={account.id} className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">{account.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge className={account.type === "receivable" ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                        {account.type === "receivable" ? "مديونية لنا (عليه)" : "مديونية علينا (له)"}
                      </Badge>
                      <Badge className="bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        {CURRENCIES[account.currency].label} ({CURRENCIES[account.currency].symbol})
                      </Badge>
                    </div>
                  </div>
                  <button
                    title="حذف الحساب"
                    onClick={() => setDeleteFor(account)}
                    className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
                  <p className="text-[11px] font-semibold text-slate-400">الرصيد المتبقي {neg ? "(رصيد لصالح الطرف)" : ""}</p>
                  <p className={cn("mt-1 text-xl font-black", neg ? "text-rose-600 dark:text-rose-400" : "text-brand-700 dark:text-brand-300")}>
                    {fmtMoney(Math.abs(balance), account.currency, arabic, 2)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    دائن {fmtMoney(credit, account.currency, arabic, 2)} · مدين {fmtMoney(debit, account.currency, arabic, 2)}
                  </p>
                </div>

                <p className="mt-3 text-[11.5px] text-slate-400">
                  {toDigits(count, arabic)} عملية {last ? `· آخر عملية ${fmtDate(last, arabic)}` : ""}
                </p>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`ledger/${account.id}`)}>
                    <NotebookPen size={13} /> فتح الكشف
                  </Button>
                  <Button size="sm" variant="ghost" title="طباعة / PDF" onClick={() => navigate(`print/ledger/${account.id}`)}>
                    <Printer size={14} />
                  </Button>
                  <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1da851]" title="مشاركة PDF عبر واتساب" onClick={() => navigate(`print/ledger/${account.id}`)}>
                    <MessageCircle size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} onDone={() => { setAccountOpen(false); toast("success", "تم إنشاء الحساب"); }} />

      {deleteFor && (
        <Modal open onClose={() => setDeleteFor(null)} title="حذف حساب الدفتر">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            سيتم حذف حساب <b>{deleteFor.name}</b> وجميع عملياته المسجلة نهائياً. لا يمكن التراجع.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>إلغاء</Button>
            <Button variant="danger" onClick={async () => {
              await ledgerService.removeAccount(deleteFor.id);
              setDeleteFor(null);
              toast("info", "تم حذف الحساب");
            }}><Trash2 size={15} /> حذف نهائي</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ====== كشف الحساب الموحد لحساب واحد ====== */
function LedgerStatement({ accountId }: { accountId: string }) {
  const { settings, toast } = useApp();
  const navigate = useNavigate();
  const arabic = settings.arabicDigits;
  const account = useLiveQuery(() => db.ledgerAccounts.get(accountId), [accountId]);
  const entries = useLiveQuery(() => ledgerService.entriesOf(accountId), [accountId]) || [];
  const [entryOpen, setEntryOpen] = useState(false);
  const [dualOpen, setDualOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LedgerEntry | null>(null);
  const [deleteAccount, setDeleteAccount] = useState(false);

  const rows = useMemo(() => {
    let bal = 0;
    return entries.map((e) => {
      bal = Math.round((bal + e.credit - e.debit) * 100) / 100;
      return { e, bal };
    });
  }, [entries]);

  const totals = useMemo(() => {
    const credit = entries.reduce((s, e) => s + e.credit, 0);
    const debit = entries.reduce((s, e) => s + e.debit, 0);
    return { credit, debit, balance: credit - debit };
  }, [entries]);

  if (!account) {
    return (
      <EmptyState icon={<AlertTriangle size={26} />} title="الحساب غير موجود"
        action={<Button onClick={() => navigate("ledger")}>العودة للدفتر</Button>} />
    );
  }

  const fmt = (v: number) => fmtMoney(v, account.currency, arabic, 2);
  let prevGroup = "";

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate("ledger")} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700 dark:text-slate-400 cursor-pointer">
        <ArrowRight size={16} /> العودة لقائمة الحسابات
      </button>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-l from-brand-800 to-brand-700 p-5 text-white dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">{account.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-white/15 text-white ring-white/25">{CURRENCIES[account.currency].label} ({CURRENCIES[account.currency].symbol})</Badge>
                <Badge className="bg-white/15 text-white ring-white/25">{account.type === "receivable" ? "مديونية لنا (عليه)" : "مديونية علينا (له)"}</Badge>
                <span className="text-[11.5px] text-brand-100">{toDigits(rows.length, arabic)} عملية</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white" onClick={() => navigate(`print/ledger/${account.id}`)}>
                <Printer size={15} /> طباعة / PDF
              </Button>
              <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1da851]" onClick={() => navigate(`print/ledger/${account.id}`)}>
                <MessageCircle size={15} /> مشاركة واتساب
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDualOpen(true)}><Layers size={15} /> قيد مزدوج</Button>
              <Button size="sm" variant="amber" onClick={() => setEntryOpen(true)}><Plus size={15} /> إضافة عملية</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 sm:grid-cols-4">
          {[
            { l: "إجمالي الدائن (زيادة)", v: fmt(totals.credit) },
            { l: "إجمالي المدين (نقص)", v: fmt(totals.debit) },
            { l: "الرصيد المتبقي", v: <span className="font-black">{fmt(totals.balance)}</span> },
            { l: "الرصيد بالكلمات", v: <span className="text-[11px] leading-5 font-semibold">{amountToWordsAr(totals.balance, CURRENCIES[account.currency].name)}</span> },
          ].map((x, i) => (
            <div key={i} className="bg-white p-4 dark:bg-slate-900">
              <p className="text-[11px] font-semibold text-slate-400">{x.l}</p>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{x.v}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
            كشف الحساب الموحد — الأعمدة: <span className="font-medium text-slate-400">الرقم التسلسلي · التاريخ · الجهة المنفذة · رقم المرجع · البيان التفصيلي · دائن · مدين · الرصيد المتبقي</span>
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<NotebookPen size={26} />} title="لا توجد عمليات مسجلة"
            description="أضف أول عملية أو رحّل قيداً محاسبياً مزدوجاً"
            action={<Button onClick={() => setEntryOpen(true)}><Plus size={15} /> إضافة عملية</Button>} />
        ) : (
          <Table headers={["#", "التاريخ", "الجهة المنفذة", "رقم المرجع", "البيان التفصيلي", "دائن", "مدين", "الرصيد المتبقي", ""]} dense>
            {rows.map(({ e, bal }, i) => {
              const isGroupStart = !!e.groupId && e.groupId !== prevGroup;
              if (e.groupId) prevGroup = e.groupId;
              return (
                <Fragment key={e.id}>
                  {isGroupStart && (
                    <tr className="bg-amber-50/80 dark:bg-amber-500/10">
                      <Td colSpan={9} className="py-2 text-center text-[11.5px] font-black text-amber-800 dark:text-amber-300">
                        ◆ {e.groupLabel || "قيد محاسبي مزدوج"} ◆
                      </Td>
                    </tr>
                  )}
                  <tr className={cn("transition-colors hover:bg-brand-50/40 dark:hover:bg-slate-800/40", e.groupId && "bg-amber-50/30 dark:bg-amber-500/5")}>
                    <Td className="font-bold text-slate-400">{toDigits(i + 1, arabic)}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(e.date, arabic)}</Td>
                    <Td className="whitespace-nowrap font-semibold">{e.entity}</Td>
                    <Td dir="ltr" className="text-right font-mono text-[12px] text-slate-500 dark:text-slate-400">{e.reference}</Td>
                    <Td className="max-w-72 min-w-52 leading-6">{e.description}</Td>
                    <Td className={cn("whitespace-nowrap font-bold", e.credit > 0 ? "text-brand-700 dark:text-brand-300" : "text-slate-300 dark:text-slate-600")}>
                      {e.credit > 0 ? fmt(e.credit) : "—"}
                    </Td>
                    <Td className={cn("whitespace-nowrap font-bold", e.debit > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-300 dark:text-slate-600")}>
                      {e.debit > 0 ? fmt(e.debit) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap font-black text-slate-900 dark:text-white">{fmt(bal)}</Td>
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <button title="تعديل" onClick={() => setEditEntry(e)} className="rounded-lg p-1.5 text-slate-300 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-800 cursor-pointer"><PenLine size={14} /></button>
                        <button title="حذف" onClick={() => setDeleteEntry(e)} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </tr>
                </Fragment>
              );
            })}
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <Td colSpan={5} className="font-black text-slate-800 dark:text-slate-100">الإجمالي</Td>
              <Td className="font-black text-brand-700 dark:text-brand-300">{fmt(totals.credit)}</Td>
              <Td className="font-black text-emerald-700 dark:text-emerald-300">{fmt(totals.debit)}</Td>
              <Td className="font-black text-slate-900 dark:text-white">{fmt(totals.balance)}</Td>
              <Td />
            </tr>
          </Table>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          دائن = زيادة في المديونية · مدين = نقص في المديونية · الرصيد يُحتسب تلقائياً بالترتيب الزمني
        </p>
        <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => setDeleteAccount(true)}>
          <Trash2 size={13} /> حذف الحساب
        </Button>
      </div>

      {entryOpen && (
        <EntryModal account={account} onClose={() => setEntryOpen(false)} onDone={() => { setEntryOpen(false); toast("success", "تمت إضافة العملية", "حُدث الرصيد تلقائياً"); }} />
      )}
      {editEntry && (
        <EntryModal account={account} initial={editEntry} onClose={() => setEditEntry(null)} onDone={() => { setEditEntry(null); toast("success", "تم تعديل العملية"); }} />
      )}
      {dualOpen && (
        <DualEntryModal account={account} onClose={() => setDualOpen(false)} onDone={() => { setDualOpen(false); toast("success", "تم ترحيل القيد المزدوج", "حركتان في نفس التاريخ برصيد متتابع"); }} />
      )}
      {deleteEntry && (
        <Modal open onClose={() => setDeleteEntry(null)} title="حذف العملية">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            سيتم حذف عملية «<b>{deleteEntry.description.slice(0, 60)}...</b>» وإعادة احتساب الرصيد.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteEntry(null)}>إلغاء</Button>
            <Button variant="danger" onClick={async () => { await ledgerService.removeEntry(deleteEntry.id); setDeleteEntry(null); toast("info", "تم حذف العملية"); }}><Trash2 size={15} /> حذف</Button>
          </div>
        </Modal>
      )}
      {deleteAccount && (
        <Modal open onClose={() => setDeleteAccount(false)} title="حذف الحساب">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            سيتم حذف حساب <b>{account.name}</b> وجميع عملياته نهائياً.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteAccount(false)}>إلغاء</Button>
            <Button variant="danger" onClick={async () => {
              await ledgerService.removeAccount(account.id);
              toast("info", "تم حذف الحساب");
              navigate("ledger");
            }}><Trash2 size={15} /> حذف نهائي</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ====== نموذج عملية (إضافة / تعديل) ====== */
function EntryModal({ account, initial, onClose, onDone }: { account: LedgerAccount; initial?: LedgerEntry | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [date, setDate] = useState(initial?.date || todayISO());
  const [entity, setEntity] = useState(initial?.entity || "");
  const [reference, setReference] = useState(initial?.reference || "لا يوجد");
  const [description, setDescription] = useState(initial?.description || "");
  const [credit, setCredit] = useState(initial ? String(initial.credit) : "");
  const [debit, setDebit] = useState(initial ? String(initial.debit) : "");
  const c = parseFloat(credit) || 0;
  const d = parseFloat(debit) || 0;
  const valid = !!description.trim() && ((c > 0) !== (d > 0)) && (c > 0 || d > 0);

  const submit = async () => {
    if (!valid) {
      toast("error", "بيانات غير مكتملة", "أدخل البيان واجعل قيمة واحدة فقط (دائن أو مدين) أكبر من صفر");
      return;
    }
    const payload = {
      date, entity: entity.trim() || "أخرى", reference: reference.trim() || "لا يوجد",
      description: description.trim(), credit: c, debit: d,
    };
    if (initial) await ledgerService.updateEntry(initial.id, payload);
    else await ledgerService.addEntry(account.id, payload);
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={initial ? "تعديل عملية" : "إضافة عملية — كشف الحساب الموحد"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="التاريخ" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="الجهة المنفذة" required>
            <Input list="ledger-entities" value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="اختر أو اكتب..." />
            <datalist id="ledger-entities">
              {LEDGER_ENTITIES.map((en) => <option key={en} value={en} />)}
            </datalist>
          </Field>
        </div>
        <Field label="رقم المرجع">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="لا يوجد" dir="ltr" />
        </Field>
        <Field label="البيان التفصيلي" required>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف العملية بالتفصيل..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="مبلغ دائن (زيادة في المديونية)">
            <Input type="number" step="0.01" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="مبلغ مدين (نقص في المديونية)">
            <Input type="number" step="0.01" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-[12px] leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
          <b>قاعدة الكشف:</b> دائن = زيادة في المديونية · مدين = نقص في المديونية · الرصيد يُحتسب تلقائياً (دائن − مدين) بالترتيب الزمني.
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={!valid}><Plus size={16} /> {initial ? "حفظ التعديل" : "إضافة العملية"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== نموذج القيد المحاسبي المزدوج ====== */
function DualEntryModal({ account, onClose, onDone }: { account: LedgerAccount; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [date, setDate] = useState(todayISO());
  const [entity, setEntity] = useState("إقرار والتزام");
  const [reference, setReference] = useState("لا يوجد");
  const [mainDesc, setMainDesc] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCredit, setFCredit] = useState("");
  const [fDebit, setFDebit] = useState("");
  const [sDesc, setSDesc] = useState("");
  const [sCredit, setSCredit] = useState("");
  const [sDebit, setSDebit] = useState("");

  const fc = parseFloat(fCredit) || 0;
  const fd = parseFloat(fDebit) || 0;
  const sc = parseFloat(sCredit) || 0;
  const sd = parseFloat(sDebit) || 0;
  const valid =
    !!mainDesc.trim() &&
    ((fc > 0) !== (fd > 0)) && (fc > 0 || fd > 0) &&
    ((sc > 0) !== (sd > 0)) && (sc > 0 || sd > 0);

  const submit = async () => {
    if (!valid) {
      toast("error", "بيانات غير مكتملة", "كل حركة تتطلب قيمة واحدة فقط (دائن أو مدين) أكبر من صفر");
      return;
    }
    await ledgerService.addDualEntry(
      account.id,
      { date, entity: entity.trim() || "أخرى", reference: reference.trim() || "لا يوجد", description: mainDesc.trim() },
      { description: fDesc.trim() || "الحركة الأولى", credit: fc, debit: fd },
      { description: sDesc.trim() || "الحركة الثانية", credit: sc, debit: sd }
    );
    onDone();
  };

  return (
    <Modal open onClose={onClose} title="قيد محاسبي مزدوج — حركتان في نفس التاريخ" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="التاريخ" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="الجهة المنفذة" required>
            <Input list="ledger-entities-dual" value={entity} onChange={(e) => setEntity(e.target.value)} />
            <datalist id="ledger-entities-dual">
              {LEDGER_ENTITIES.map((en) => <option key={en} value={en} />)}
            </datalist>
          </Field>
          <Field label="رقم المرجع">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" />
          </Field>
        </div>
        <Field label="بيان القيد الرئيسي (يظهر كعنوان للحركتين)" required>
          <Input value={mainDesc} onChange={(e) => setMainDesc(e.target.value)} placeholder="مثال: إقرار بالدين وتسوية الحساب مع..." />
        </Field>

        <div className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
          <p className="mb-3 text-[12.5px] font-black text-brand-800 dark:text-brand-200">الحركة الأولى</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="البيان الفرعي">
              <Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="مثال: سداد الرصيد الفعلي..." />
            </Field>
            <Field label="مبلغ دائن">
              <Input type="number" step="0.01" value={fCredit} onChange={(e) => setFCredit(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="مبلغ مدين">
              <Input type="number" step="0.01" value={fDebit} onChange={(e) => setFDebit(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="mb-3 text-[12.5px] font-black text-emerald-800 dark:text-emerald-200">الحركة الثانية</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="البيان الفرعي">
              <Input value={sDesc} onChange={(e) => setSDesc(e.target.value)} placeholder="مثال: إقرار بالرصيد المتفق عليه..." />
            </Field>
            <Field label="مبلغ دائن">
              <Input type="number" step="0.01" value={sCredit} onChange={(e) => setSCredit(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="مبلغ مدين">
              <Input type="number" step="0.01" value={sDebit} onChange={(e) => setSDebit(e.target.value)} placeholder="0.00" />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} disabled={!valid}><Layers size={16} /> ترحيل القيد المزدوج</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== نموذج إنشاء حساب ====== */
function AccountModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { settings, toast } = useApp();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);
  const [type, setType] = useState<"receivable" | "payable">("receivable");
  const [notes, setNotes] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="حساب دفتر جديد">
      <div className="space-y-4">
        <Field label="اسم الحساب (الشخص / الجهة)" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد أحمد..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="العملة" required>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCY_KEYS.map((c) => <option key={c} value={c}>{CURRENCIES[c].label} ({CURRENCIES[c].symbol})</option>)}
            </Select>
          </Field>
          <Field label="نوع الحساب" required>
            <Select value={type} onChange={(e) => setType(e.target.value as "receivable" | "payable")}>
              <option value="receivable">مديونية لنا (عليه)</option>
              <option value="payable">مديونية علينا (له)</option>
            </Select>
          </Field>
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button disabled={!name.trim()} onClick={async () => {
            if (await db.ledgerAccounts.where("name").equals(name.trim()).count()) {
              toast("error", "يوجد حساب بنفس الاسم");
              return;
            }
            await ledgerService.createAccount({ name: name.trim(), currency, type, notes: notes.trim() || undefined });
            onDone();
          }}><Plus size={16} /> إنشاء الحساب</Button>
        </div>
      </div>
    </Modal>
  );
}
