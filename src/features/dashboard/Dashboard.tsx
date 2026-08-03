/* ====== لوحة التحكم ====== */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  HandCoins, Wallet, FileText, Plus, TrendingUp, Scale, Layers,
  Landmark, ReceiptText, NotebookPen, Printer, MessageCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useNavigate } from "@/lib/router";
import { Card, StatCard, Badge, EmptyState, Button, Progress } from "@/components/ui";
import { CURRENCIES, DEBT_STATUSES, DEBT_TYPES, PAYMENT_METHODS } from "@/lib/types";
import { fmtDate, fmtMoney, toBase, toDigits, todayISO } from "@/lib/utils";
import { cn } from "@/utils/cn";

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function Dashboard() {
  const { settings } = useApp();
  const navigate = useNavigate();

  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const docs = useLiveQuery(() => db.documents.toArray()) || [];
  const logs = useLiveQuery(() => db.auditLogs.orderBy("at").reverse().limit(8).toArray()) || [];
  const ledgerAccounts = useLiveQuery(() => db.ledgerAccounts.toArray()) || [];
  /* حساب أرصدة الدفتر مباشرة في الاستعلام — بدلاً من تحميل كل العمليات */
  const ledgerBalances = useLiveQuery(async () => {
    const accounts = await db.ledgerAccounts.toArray();
    return Promise.all(accounts.map(async (a) => {
      const entries = await db.ledgerEntries.where("accountId").equals(a.id).toArray();
      const credit = entries.reduce((s, e) => s + e.credit, 0);
      const debit = entries.reduce((s, e) => s + e.debit, 0);
      return { account: a, count: entries.length, balance: credit - debit };
    }));
  }, []) || [];

  const arabic = settings.arabicDigits;
  const base = settings.baseCurrency;
  const rates = settings.exchangeRates;

  const stats = useMemo(() => {
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);
    let receivable = 0, payable = 0, openCount = 0;
    for (const d of debts) {
      if (d.status === "cancelled") continue;
      const remaining = Math.max(0, d.amount - (paidMap.get(d.id) || 0));
      if (d.status === "active" || d.status === "partial") openCount++;
      if (d.type === "receivable") receivable += toBase(remaining, d.currency, rates, base);
      else payable += toBase(remaining, d.currency, rates, base);
    }
    const monthKey = todayISO().slice(0, 7);
    const collectedMonth = payments
      .filter((p) => p.date.slice(0, 7) === monthKey)
      .reduce((s, p) => s + toBase(p.amount, p.currency, rates, base), 0);
    return { receivable, payable, openCount, collectedMonth };
  }, [debts, payments, rates, base]);

  /* التحصيل الشهري */
  const chart = useMemo(() => {
    const months: { label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const total = payments
        .filter((p) => p.date.slice(0, 7) === key)
        .reduce((s, p) => s + toBase(p.amount, p.currency, rates, base), 0);
      months.push({ label: AR_MONTHS[d.getMonth()], total });
    }
    const max = Math.max(...months.map((m) => m.total), 1);
    return { months, max };
  }, [payments, rates, base]);

  /* أعمار العمليات المفتوحة (منذ تاريخ تسجيلها) */
  const aging = useMemo(() => {
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);
    const buckets = [0, 0, 0, 0];
    const labels = ["أقل من ٣٠ يوماً", "٣١ — ٦٠ يوماً", "٦١ — ٩٠ يوماً", "أكثر من ٩٠ يوماً"];
    const colors = ["#0f9d6e", "#f59e0b", "#f97316", "#e11d48"];
    for (const d of debts) {
      if (d.status === "settled" || d.status === "cancelled") continue;
      const remaining = Math.max(0, d.amount - (paidMap.get(d.id) || 0));
      if (remaining <= 0) continue;
      const age = Math.max(0, Math.round((Date.now() - new Date(d.date).getTime()) / 86400000));
      const bucket = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
      buckets[bucket] += toBase(remaining, d.currency, rates, base);
    }
    const total = buckets.reduce((s, v) => s + v, 0);
    return { buckets, labels, colors, total };
  }, [debts, payments, rates, base]);

  const latest = useMemo(() =>
    [...debts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  [debts]);

  const C = 2 * Math.PI * 42;
  let acc = 0;

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-brand-800 via-brand-700 to-emerald-700 p-6 text-white shadow-lg shadow-brand-800/20 sm:p-8 animate-fade-up">
        <div className="absolute -left-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 left-24 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-100">مرحباً بك في سجل</p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">نظرة شاملة على الحسابات والمديونيات</h2>
            <p className="mt-2 max-w-lg text-[13px] leading-6 text-brand-100/90">
              {toDigits(stats.openCount, arabic)} عملية مالية مفتوحة · {toDigits(docs.length, arabic)} مستند · {toDigits(ledgerAccounts.length, arabic)} حساب دفتر
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="amber" size="sm" onClick={() => navigate("debts")}><Plus size={15} /> عملية جديدة</Button>
            <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white" onClick={() => navigate("ledger")}><NotebookPen size={15} /> دفتر الحسابات</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="العمليات الدائنة (لنا)" value={fmtMoney(stats.receivable, base, arabic)} sub={`${toDigits(debts.filter((d) => d.type === "receivable" && (d.status === "active" || d.status === "partial")).length, arabic)} عملية مفتوحة`} icon={<HandCoins size={20} />} tone="teal" onClick={() => navigate("debts?type=receivable")} />
        <StatCard label="العمليات المدينة (علينا)" value={fmtMoney(stats.payable, base, arabic)} sub="التزامات للغير" icon={<Wallet size={20} />} tone="amber" onClick={() => navigate("debts?type=payable")} />
        <StatCard label="محصّل هذا الشهر" value={fmtMoney(stats.collectedMonth, base, arabic)} sub={`${toDigits(payments.filter((p) => p.date.slice(0, 7) === todayISO().slice(0, 7)).length, arabic)} دفعة مستلمة`} icon={<TrendingUp size={20} />} tone="indigo" />
        <StatCard label="حسابات الدفتر" value={toDigits(ledgerAccounts.length, arabic)} sub={ledgerBalances.length ? `رصيد أول حساب: ${fmtMoney(Math.abs(ledgerBalances[0]?.balance || 0), ledgerBalances[0]?.account.currency || base, arabic)}` : "كشف حساب موحد"} icon={<NotebookPen size={20} />} tone="slate" onClick={() => navigate("ledger")} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">التحصيل الشهري</h3>
              <p className="text-xs text-slate-400">آخر ٦ أشهر — بالعملة الأساسية</p>
            </div>
            <Badge className="bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">
              <Landmark size={12} /> {settings.baseCurrency}
            </Badge>
          </div>
          <div className="flex h-44 items-end justify-between gap-2 sm:gap-4">
            {chart.months.map((m, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100">
                  {fmtMoney(m.total, base, arabic)}
                </span>
                <div
                  style={{ height: `${Math.max(4, (m.total / chart.max) * 100)}%`, transitionDelay: `${i * 60}ms` }}
                  className={cn("w-full max-w-12 rounded-t-lg transition-all duration-500 ease-out", m.total > 0 ? "bg-gradient-to-t from-brand-700 to-brand-400 group-hover:from-brand-800 group-hover:to-brand-300" : "bg-slate-100 dark:bg-slate-800")}
                  title={fmtMoney(m.total, base, arabic)}
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-slate-900 dark:text-white">أعمار العمليات المفتوحة</h3>
          <p className="text-xs text-slate-400">الأرصدة المتبقية حسب عمر كل عملية منذ تسجيلها</p>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="13" className="stroke-slate-100 dark:stroke-slate-800" />
                {aging.total > 0 && aging.buckets.map((b, i) => {
                  const len = (b / aging.total) * C;
                  const el = (
                    <circle key={i} cx="50" cy="50" r="42" fill="none" strokeWidth="13"
                      stroke={aging.colors[i]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />
                  );
                  acc += len;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900 dark:text-white">{fmtMoney(aging.total, base, arabic)}</p>
                  <p className="text-[10px] text-slate-400">إجمالي المتبقي</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {aging.labels.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: aging.colors[i] }} /> {l}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{fmtMoney(aging.buckets[i], base, arabic)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {ledgerBalances.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen size={17} className="text-brand-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">حسابات الدفتر الشخصي</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("ledger")}>عرض دفتر الحسابات</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ledgerBalances.map(({ account, balance, count }) => (
              <div key={account.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:shadow-sm dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{account.name}</p>
                  <Badge className={account.type === "receivable" ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                    {account.type === "receivable" ? "عليه لنا" : "له علينا"}
                  </Badge>
                </div>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{fmtMoney(balance, account.currency, arabic, 2)}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{CURRENCIES[account.currency].label} · {toDigits(count, arabic)} عملية</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`ledger/${account.id}`)}><NotebookPen size={13} /> فتح الكشف</Button>
                  <Button size="sm" variant="ghost" title="طباعة / PDF" onClick={() => navigate(`print/ledger/${account.id}`)}><Printer size={14} /></Button>
                  <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1da851]" title="مشاركة واتساب" onClick={() => navigate(`print/ledger/${account.id}`)}><MessageCircle size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Layers size={16} className="text-brand-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">آخر العمليات المسجلة</h3>
          </div>
          {latest.length === 0 ? (
            <EmptyState icon={<Layers size={26} />} title="لا توجد عمليات بعد" description="ابدأ بتسجيل أول عملية مالية لتتبع حساباتك" action={<Button size="sm" onClick={() => navigate("debts")}><HandCoins size={14} /> تسجيل عملية</Button>} />
          ) : (
            <div className="space-y-3">
              {latest.map((d) => {
                const paid = payments.filter((p) => p.debtId === d.id).reduce((s, p) => s + p.amount, 0);
                const pct = (paid / d.amount) * 100;
                return (
                  <div key={d.id} className="cursor-pointer rounded-xl border border-slate-100 p-3 transition hover:border-brand-300 dark:border-slate-800" onClick={() => navigate(`debts/${d.id}`)}>
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{d.number}</p>
                      <Badge className={DEBT_STATUSES[d.status].badge}>{DEBT_STATUSES[d.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{DEBT_TYPES[d.type].label} · {fmtDate(d.date, arabic)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Progress value={pct} className="flex-1" tone={d.type === "receivable" ? "teal" : "amber"} />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{fmtMoney(d.amount - paid, d.currency, arabic)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ReceiptText size={16} className="text-brand-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">آخر المدفوعات</h3>
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={<Wallet size={26} />} title="لا توجد مدفوعات بعد" description="سجّل أول دفعة على عملية مفتوحة لبدء التحصيل" />
          ) : (
            <div className="space-y-2.5">
              {[...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((p) => {
                const debt = debts.find((d) => d.id === p.debtId);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="text-lg">{PAYMENT_METHODS[p.method].icon}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{debt?.number || "—"}</p>
                        <p className="text-[11px] text-slate-400">{fmtDate(p.date, arabic)} · {PAYMENT_METHODS[p.method].label}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(p.amount, p.currency, arabic)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Scale size={16} className="text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">سجل النشاط</h3>
          </div>
          {logs.length === 0 ? (
            <EmptyState icon={<FileText size={26} />} title="لا نشاط بعد" description="سيظهر هنا سجل بجميع العمليات التي تقوم بها" />
          ) : (
            <div className="relative space-y-4 before:absolute before:right-[5px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
              {logs.map((l) => (
                <div key={l.id} className="relative pr-5">
                  <span className="absolute right-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-white bg-brand-500 dark:border-slate-900" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{l.action} <span className="font-medium text-slate-400">· {l.entity}</span></p>
                  <p className="text-[11px] text-slate-400">{fmtDate(l.at, arabic, true)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
