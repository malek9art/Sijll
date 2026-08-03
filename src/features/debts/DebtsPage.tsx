/* ====== العمليات المالية (منطق محاسبي) ====== */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, Search, Printer, Trash2, HandCoins, ArrowRight, CircleCheck, Ban, MessageCircle,
  User, Building2, Banknote, ReceiptText, History, CheckCheck,
} from "lucide-react";
import { db, debtsService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useHashRoute, useNavigate } from "@/lib/router";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Progress, Select,
  StatCard, Table, Td, Textarea,
} from "@/components/ui";
import { CURRENCIES, CURRENCY_KEYS, DEBT_STATUSES, DEBT_TYPES, PAYMENT_METHODS, type Currency, type Debt, type DebtType, type Payment, type PaymentMethod } from "@/lib/types";
import { fmtDate, fmtMoney, toDigits, todayISO, uid } from "@/lib/utils";
import { cn } from "@/utils/cn";

const METHOD_KEYS = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

export function DebtsPage() {
  const route = useHashRoute();
  const navigate = useNavigate();
  const { settings, toast } = useApp();
  const arabic = settings.arabicDigits;

  const debts = useLiveQuery(() => db.debts.orderBy("createdAt").reverse().toArray(), []) || [];
  const payments = useLiveQuery(() => db.payments.toArray(), []) || [];
  const parties = useLiveQuery(() => db.parties.toArray(), []) || [];

  const selectedId = route.segments[1];
  const q = route.search.get("q") || "";
  const typeFilter = (route.search.get("type") as DebtType | null) || "all";
  const statusFilter = (route.search.get("status") as string | null) || "all";

  const [formOpen, setFormOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Debt | null>(null);
  const [deleteFor, setDeleteFor] = useState<Debt | null>(null);
  const [settleFor, setSettleFor] = useState<Debt | null>(null);

  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const paidMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.debtId, (m.get(p.debtId) || 0) + p.amount);
    return m;
  }, [payments]);

  const filtered = useMemo(() => {
    return debts
      .filter((d) => (typeFilter === "all" ? true : d.type === typeFilter))
      .filter((d) => (statusFilter === "all" ? true : d.status === statusFilter))
      .filter((d) => {
        if (!q) return true;
        const party = partyMap.get(d.partyId);
        return (
          d.number.includes(q) ||
          d.reason?.includes(q) ||
          party?.name.includes(q) ||
          party?.phone?.includes(q)
        );
      });
  }, [debts, q, typeFilter, statusFilter, partyMap]);

  const totals = useMemo(() => {
    let recv = 0, pay = 0, open = 0;
    for (const d of debts) {
      if (d.status === "cancelled") continue;
      if (d.status === "active" || d.status === "partial") open++;
      const rem = Math.max(0, d.amount - (paidMap.get(d.id) || 0));
      if (d.type === "receivable") recv += rem;
      else pay += rem;
    }
    return { recv, pay, open };
  }, [debts, paidMap]);

  /* ====== عرض تفاصيل ذمة ====== */
  if (selectedId) {
    const debt = debts.find((d) => d.id === selectedId);
    if (!debt) {
      return (
        <EmptyState
          icon={<Ban size={26} />} title="الذمة غير موجودة"
          action={<Button onClick={() => navigate("debts")}>العودة للقائمة</Button>}
        />
      );
    }
    return (
      <DebtDetail
        debt={debt}
        party={partyMap.get(debt.partyId)}
        pays={payments.filter((p) => p.debtId === debt.id).sort((a, b) => a.date.localeCompare(b.date))}
        totalPaid={paidMap.get(debt.id) || 0}
        onBack={() => navigate("debts")}
        onAddPayment={() => setPaymentFor(debt)}
        onSettle={() => setSettleFor(debt)}
        onPrint={() => navigate(`print/debt/${debt.id}`)}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="العمليات المالية"
        description="سجل العمليات بمنطق محاسبي: كل عملية = مبلغ على طرف (لنا أو علينا) تُسدَّد بدفعات لاحقة — دون تواريخ استحقاق"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("ledger")}><ReceiptText size={16} /> دفتر الحسابات</Button>
            <Button onClick={() => setFormOpen(true)}><Plus size={17} /> عملية جديدة</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي العمليات الدائنة (لنا)" value={fmtMoney(totals.recv, settings.baseCurrency, arabic)} icon={<HandCoins size={19} />} tone="teal" onClick={() => navigate("debts?type=receivable")} />
        <StatCard label="إجمالي العمليات المدينة (علينا)" value={fmtMoney(totals.pay, settings.baseCurrency, arabic)} icon={<Banknote size={19} />} tone="amber" onClick={() => navigate("debts?type=payable")} />
        <StatCard label="عمليات مفتوحة" value={toDigits(totals.open, arabic)} sub="قيد المتابعة والسداد" icon={<ReceiptText size={19} />} tone="indigo" />
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              defaultValue={q}
              placeholder="بحث بالرقم أو الطرف أو السبب..."
              className="pr-9"
              onChange={(e) => {
                const t = e.target.value;
                const params = new URLSearchParams(route.search);
                if (t) params.set("q", t);
                else params.delete("q");
                window.location.hash = `#/debts?${params.toString()}`;
              }}
            />
          </div>
          <Select className="w-40" value={typeFilter} onChange={(e) => {
            const params = new URLSearchParams(route.search);
            if (e.target.value !== "all") params.set("type", e.target.value);
            else params.delete("type");
            window.location.hash = `#/debts?${params.toString()}`;
          }}>
            <option value="all">كل الأنواع</option>
            <option value="receivable">ذمة مدينة</option>
            <option value="payable">ذمة دائنة</option>
          </Select>
          <Select className="w-44" value={statusFilter} onChange={(e) => {
            const params = new URLSearchParams(route.search);
            if (e.target.value !== "all") params.set("status", e.target.value);
            else params.delete("status");
            window.location.hash = `#/debts?${params.toString()}`;
          }}>
            <option value="all">كل الحالات</option>
            {Object.entries(DEBT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<HandCoins size={28} />}
            title="لا توجد ذمم مطابقة"
            description="أضف ذمة جديدة أو عدّل معايير البحث والفلاتر"
            action={<Button onClick={() => setFormOpen(true)}><Plus size={16} /> إضافة ذمة</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table headers={["رقم العملية", "الطرف", "الاتجاه", "المبلغ", "المسدد", "المتبقي", "تاريخ العملية", "الحالة", ""]}>
            {filtered.map((d) => {
              const paid = paidMap.get(d.id) || 0;
              const remaining = d.amount - paid;
              const pct = (paid / d.amount) * 100;
              const party = partyMap.get(d.partyId);
              return (
                <tr key={d.id} className="transition-colors hover:bg-brand-50/40 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => navigate(`debts/${d.id}`)}>
                  <Td className="font-bold text-brand-700 dark:text-brand-300">{toDigits(d.number, arabic)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        {party?.type === "company" ? <Building2 size={15} className="text-slate-400" /> : <User size={15} className="text-slate-400" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{party?.name || "—"}</p>
                        <p className="truncate text-[11px] text-slate-400">{party?.phone || d.reason}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge className={d.type === "receivable" ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                      {DEBT_TYPES[d.type].label}
                    </Badge>
                  </Td>
                  <Td className="font-bold">{fmtMoney(d.amount, d.currency, arabic)}</Td>
                  <Td className="text-emerald-600 dark:text-emerald-400">{fmtMoney(paid, d.currency, arabic)}</Td>
                  <Td>
                    <div className="min-w-24">
                      <p className={cn("font-bold", remaining > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600")}>{fmtMoney(remaining, d.currency, arabic)}</p>
                      <Progress value={pct} className="mt-1.5" tone={remaining > 0 ? "amber" : "teal"} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-[13px]">{fmtDate(d.date, arabic)}</Td>
                  <Td><Badge className={DEBT_STATUSES[d.status].badge}><span className={cn("h-1.5 w-1.5 rounded-full", DEBT_STATUSES[d.status].dot)} />{DEBT_STATUSES[d.status].label}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button title="كشف وطباعة" onClick={() => navigate(`print/debt/${d.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 cursor-pointer"><Printer size={15} /></button>
                      <button title="تسجيل دفعة" onClick={() => setPaymentFor(d)} disabled={d.status === "settled" || d.status === "cancelled"} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"><Banknote size={15} /></button>
                      <button title="حذف" onClick={() => setDeleteFor(d)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 cursor-pointer"><Trash2 size={15} /></button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      <DebtFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        parties={parties}
        onCreated={(id) => {
          setFormOpen(false);
          toast("success", "تم إنشاء الذمة", "تم ترحيل القيد المحاسبي تلقائياً");
          navigate(`debts/${id}`);
        }}
      />

      {paymentFor && (
        <PaymentModal
          debt={paymentFor}
          remaining={Math.max(0, paymentFor.amount - (paidMap.get(paymentFor.id) || 0))}
          onClose={() => setPaymentFor(null)}
          onDone={() => {
            setPaymentFor(null);
            toast("success", "تم تسجيل الدفعة", "تم تحديث حالة الذمة وترحيل القيد");
          }}
        />
      )}

      {settleFor && (
        <Modal open onClose={() => setSettleFor(null)} title="تسوية نهائية للذمة">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
              سيتم تسوية الذمة <b>{toDigits(settleFor.number, arabic)}</b> بمبلغ المتبقي
              <b className="text-brand-700 dark:text-brand-300"> {fmtMoney(Math.max(0, settleFor.amount - (paidMap.get(settleFor.id) || 0)), settleFor.currency, arabic)} </b>
              كدفعة تسوية نهائية بتاريخ اليوم، مع ترحيل قيد محاسبي تلقائي.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSettleFor(null)}>إلغاء</Button>
              <Button variant="amber" onClick={async () => {
                await debtsService.settle(settleFor.id, todayISO());
                setSettleFor(null);
                toast("success", "تمت التسوية بنجاح", "أُغلقت الذمة وتم اعتماد القيد النهائي");
              }}><CircleCheck size={16} /> تأكيد التسوية</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteFor && (
        <Modal open onClose={() => setDeleteFor(null)} title="حذف الذمة">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
              سيتم حذف الذمة <b>{toDigits(deleteFor.number, arabic)}</b> وجميع مدفوعاتها نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteFor(null)}>إلغاء</Button>
              <Button variant="danger" onClick={async () => {
                await debtsService.remove(deleteFor.id);
                setDeleteFor(null);
                toast("info", "تم حذف الذمة");
              }}><Trash2 size={15} /> حذف نهائي</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ====== نموذج إنشاء ذمة ====== */
function DebtFormModal({ open, onClose, parties, onCreated }: { open: boolean; onClose: () => void; parties: { id: string; name: string }[]; onCreated: (id: string) => void }) {
  const { settings } = useApp();
  const [type, setType] = useState<DebtType>("receivable");
  const [partyId, setPartyId] = useState("");
  const [newParty, setNewParty] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    let pid = partyId;
    if (!pid && newParty.trim()) {
      const p = { id: uid("pty"), name: newParty.trim(), type: "individual" as const, createdAt: new Date().toISOString() };
      await db.parties.add(p);
      pid = p.id;
    }
    if (!pid) return;
    const debt = await debtsService.create({
      type, partyId: pid, amount: amt, currency, date,
      reason: reason.trim() || "عملية مالية مسجلة", notes,
    });
    onCreated(debt.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل عملية مالية جديدة" wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="اتجاه العملية" required>
          <Select value={type} onChange={(e) => setType(e.target.value as DebtType)}>
            <option value="receivable">مبلغ لنا على الغير (دائنة)</option>
            <option value="payable">مبلغ علينا للغير (مدينة)</option>
          </Select>
        </Field>
        <Field label="الطرف" required>
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">— اختر طرفاً —</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        {!partyId && (
          <Field label="أو اسم طرف جديد" className="sm:col-span-2">
            <Input value={newParty} onChange={(e) => setNewParty(e.target.value)} placeholder="اسم العميل / المورد / الجهة..." />
          </Field>
        )}
        <Field label="المبلغ" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="العملة">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCY_KEYS.map((c) => <option key={c} value={c}>{CURRENCIES[c].label} ({CURRENCIES[c].symbol})</option>)}
          </Select>
        </Field>
        <Field label="تاريخ تسجيل العملية" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="بيان / سبب العملية" className="sm:col-span-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: توريد بضاعة، قرض، تحويل، خدمات..." />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={submit} disabled={!parseFloat(amount) || (!partyId && !newParty.trim())}><Plus size={16} /> إنشاء الذمة</Button>
      </div>
    </Modal>
  );
}

/* ====== نافذة تسجيل دفعة ====== */
function PaymentModal({ debt, remaining, onClose, onDone }: { debt: Debt; remaining: number; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Modal open onClose={onClose} title={`تسجيل دفعة — ${debt.number}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 p-3 text-center dark:bg-brand-500/10">
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">المبلغ المتبقي</p>
          <p className="text-xl font-black text-brand-800 dark:text-brand-200">{fmtMoney(remaining, debt.currency, true)}</p>
        </div>
        <Field label="المبلغ" required>
          <Input type="number" step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} />
          {parseFloat(amount) - remaining > 0.01 && (
            <p className="mt-1 text-[11px] font-bold text-rose-500">المبلغ يتجاوز المتبقي على هذه العملية</p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="التاريخ" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="طريقة السداد">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHOD_KEYS.map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m].icon} {PAYMENT_METHODS[m].label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="رقم المرجع (شيك/تحويل)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button
            disabled={!parseFloat(amount) || parseFloat(amount) <= 0 || parseFloat(amount) - remaining > 0.01}
            onClick={async () => {
              try {
                await debtsService.addPayment(debt.id, {
                  date, amount: parseFloat(amount), currency: debt.currency, method, reference: reference.trim() || undefined, notes: notes.trim() || undefined,
                });
                onDone();
              } catch (err) {
                toast("error", "تعذر تسجيل الدفعة", err instanceof Error ? err.message : undefined);
              }
            }}
          >
            <CheckCheck size={16} /> تسجيل الدفعة
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== تفاصيل ذمة ====== */
function DebtDetail({ debt, party, pays, totalPaid, onBack, onAddPayment, onSettle, onPrint }: {
  debt: Debt; party?: { id: string; name: string; phone?: string; type: string }; pays: Payment[];
  totalPaid: number; onBack: () => void; onAddPayment: () => void; onSettle: () => void; onPrint: () => void;
}) {
  const { settings } = useApp();
  const arabic = settings.arabicDigits;
  const remaining = Math.max(0, debt.amount - totalPaid);

  const logs = useLiveQuery(() => db.auditLogs.where("entityId").equals(debt.id).reverse().sortBy("at"), [debt.id]) || [];
  const pct = (totalPaid / debt.amount) * 100;

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700 dark:text-slate-400 cursor-pointer">
        <ArrowRight size={16} /> العودة للقائمة
      </button>

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-l from-brand-800 to-brand-700 p-5 text-white dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black">{toDigits(debt.number, arabic)}</h1>
                <Badge className="bg-white/15 text-white ring-white/25">{DEBT_TYPES[debt.type].label}</Badge>
                <Badge className={DEBT_STATUSES[debt.status].badge}>{DEBT_STATUSES[debt.status].label}</Badge>
              </div>
              <p className="mt-2 text-sm text-brand-100">{party?.name} · {party?.phone}</p>
              <p className="mt-0.5 text-xs text-brand-200/80">{debt.reason} · تاريخ العملية {fmtDate(debt.date, arabic)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white" onClick={onPrint}><Printer size={15} /> كشف / PDF</Button>
              <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1da851]" onClick={onPrint}><MessageCircle size={15} /> واتساب</Button>
              <Button size="sm" variant="amber" onClick={onAddPayment} disabled={debt.status === "settled" || debt.status === "cancelled"}><Banknote size={15} /> تسجيل دفعة</Button>
              {debt.status !== "settled" && debt.status !== "cancelled" && (
                <Button size="sm" variant="secondary" onClick={onSettle}><CircleCheck size={15} /> تسوية نهائية</Button>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 sm:grid-cols-4">
          {[
            { l: "المبلغ الأصلي", v: fmtMoney(debt.amount, debt.currency, arabic) },
            { l: "المسدد", v: <span className="text-emerald-600 dark:text-emerald-400">{fmtMoney(totalPaid, debt.currency, arabic)}</span> },
            { l: "المتبقي", v: <span className="text-rose-600 dark:text-rose-400">{fmtMoney(remaining, debt.currency, arabic)}</span> },
            { l: "نسبة الإنجاز", v: `${toDigits(Math.round(pct), arabic)}٪` },
          ].map((x, i) => (
            <div key={i} className="bg-white p-4 dark:bg-slate-900">
              <p className="text-[11px] font-semibold text-slate-400">{x.l}</p>
              <p className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">{x.v}</p>
            </div>
          ))}
        </div>
        {remaining > 0 && debt.status !== "cancelled" && (
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 dark:bg-slate-800/50">
            <Progress value={pct} className="flex-1" tone={pct > 0 ? "amber" : "rose"} />
            <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">
              سُدّد {toDigits(Math.round(pct), arabic)}٪ — المتبقي {fmtMoney(remaining, debt.currency, arabic)}
            </span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><ReceiptText size={16} className="text-brand-600" /> عمليات السداد المسجلة ({toDigits(pays.length, arabic)})</h3>
            <span className="text-[11px] text-slate-400">كل دفعة تُنقص الرصيد تلقائياً — دون فوائد</span>
          </div>
          {pays.length === 0 ? (
            <EmptyState icon={<Banknote size={26} />} title="لا توجد مدفوعات بعد" description="سجل أول دفعة على هذه الذمة" />
          ) : (
            <Table headers={["التاريخ", "المبلغ", "الطريقة", "المرجع", "ملاحظات"]} dense>
              {[...pays].reverse().map((p) => (
                <tr key={p.id}>
                  <Td>{fmtDate(p.date, arabic)}</Td>
                  <Td className="font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(p.amount, p.currency, arabic)}</Td>
                  <Td>{PAYMENT_METHODS[p.method].icon} {PAYMENT_METHODS[p.method].label}</Td>
                  <Td className="text-slate-400">{p.reference || "—"}</Td>
                  <Td className="max-w-32 truncate text-slate-400">{p.notes || "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><History size={16} className="text-indigo-500" /> سجل النشاط والحركة</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد نشاط مسجل بعد.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{l.action}</span>
                <span className="text-[11px] text-slate-400">{fmtDate(l.at, arabic, true)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
