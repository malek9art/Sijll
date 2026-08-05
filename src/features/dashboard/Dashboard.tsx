/* ====== لوحة التحكم ======
 * تصميم موجَّه بالأهداف (Goal-Oriented):
 *   1) ما وضعي المالي الآن؟   → بطاقات المؤشرات + صافي المركز
 *   2) ما الذي يحتاج إجراءً؟  → قائمة «يتطلب انتباهك» (تنبيهات ذكية قابلة للنقر)
 *   3) كيف تسير الأمور؟       → النشاط الشهري، أعمار العمليات، آخر المستندات والحركات
 */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  HandCoins, Wallet, FileText, Plus, TrendingUp, Scale, Layers,
  Landmark, ReceiptText, NotebookPen, Printer, MessageCircle, ShieldCheck,
  AlertTriangle, CheckCircle2, CalendarClock, DatabaseBackup, ArrowLeft, Clock3, QrCode, BellRing,
} from "lucide-react";
import { db } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useNavigate } from "@/lib/router";
import { Card, StatCard, Badge, EmptyState, Button, Progress } from "@/components/ui";
import { CURRENCIES, DEBT_STATUSES, DEBT_TYPES, DOC_TYPES, PAYMENT_METHODS, type DocType } from "@/lib/types";
import { fmtDate, fmtMoney, hijriDate, toBase, toDigits, todayISO } from "@/lib/utils";
import { cn } from "@/utils/cn";

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

interface AttentionItem {
  id: string;
  level: "danger" | "warning";
  title: string;
  desc: string;
  actionLabel: string;
  action: () => void;
}

export function Dashboard() {
  const { settings } = useApp();
  const navigate = useNavigate();

  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const payments = useLiveQuery(() => db.payments.toArray()) || [];
  const docs = useLiveQuery(() => db.documents.toArray()) || [];
  const logs = useLiveQuery(() => db.auditLogs.orderBy("at").reverse().limit(8).toArray()) || [];
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
  /* لحظة زمنية ثابتة لمرة واحدة — حسابات الأعمار والتأخر ثابتة أثناء الجلسة */
  const [nowMs] = useState(() => Date.now());

  /* ====== ١) المؤشرات المالية الأساسية ====== */
  const stats = useMemo(() => {
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);
    let receivable = 0, payable = 0, openCount = 0, totalReceivableOrig = 0, totalReceivablePaid = 0;
    for (const d of debts) {
      if (d.status === "cancelled") continue;
      const paid = paidMap.get(d.id) || 0;
      const remaining = Math.max(0, d.amount - paid);
      if (d.status === "active" || d.status === "partial") openCount++;
      if (d.type === "receivable") {
        receivable += toBase(remaining, d.currency, rates, base);
        totalReceivableOrig += toBase(d.amount, d.currency, rates, base);
        totalReceivablePaid += toBase(paid, d.currency, rates, base);
      } else {
        payable += toBase(remaining, d.currency, rates, base);
      }
    }
    const monthKey = todayISO().slice(0, 7);
    const monthPayments = payments.filter((p) => p.date.slice(0, 7) === monthKey);
    const collectedMonth = monthPayments.reduce((s, p) => s + toBase(p.amount, p.currency, rates, base), 0);
    /* نسبة التحصيل الكلية: المسدد ÷ إجمالي المبالغ الأصلية (العمليات الدائنة غير الملغاة) */
    const collectionRate = totalReceivableOrig > 0 ? Math.round((totalReceivablePaid / totalReceivableOrig) * 100) : 0;
    return {
      receivable, payable, openCount, collectedMonth, collectionRate,
      net: receivable - payable, monthPaymentCount: monthPayments.length,
    };
  }, [debts, payments, rates, base]);

  /* ====== النشاط الشهري: التحصيل مقابل العمليات الجديدة ====== */
  const chart = useMemo(() => {
    const months: { label: string; collected: number; created: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const collected = payments
        .filter((p) => p.date.slice(0, 7) === key)
        .reduce((s, p) => s + toBase(p.amount, p.currency, rates, base), 0);
      const created = debts
        .filter((dbt) => dbt.date.slice(0, 7) === key && dbt.status !== "cancelled")
        .reduce((s, dbt) => s + toBase(dbt.amount, dbt.currency, rates, base), 0);
      months.push({ label: AR_MONTHS[d.getMonth()], collected, created });
    }
    const max = Math.max(...months.flatMap((m) => [m.collected, m.created]), 1);
    return { months, max };
  }, [payments, debts, rates, base]);

  /* ====== أعمار العمليات المفتوحة ====== */
  const aging = useMemo(() => {
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);
    const buckets = [0, 0, 0, 0];
    const labels = ["أقل من ٣٠ يوماً", "٣١ — ٦٠ يوماً", "٦١ — ٩٠ يوماً", "أكثر من ٩٠ يوماً"];
    const colors = ["#0f9d6e", "#f59e0b", "#f97316", "#e11d48"];
    let oldest = 0;
    for (const d of debts) {
      if (d.status === "settled" || d.status === "cancelled") continue;
      const remaining = Math.max(0, d.amount - (paidMap.get(d.id) || 0));
      if (remaining <= 0) continue;
      const age = Math.max(0, Math.round((nowMs - new Date(d.date).getTime()) / 86400000));
      oldest = Math.max(oldest, age);
      const bucket = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3;
      buckets[bucket] += toBase(remaining, d.currency, rates, base);
    }
    const total = buckets.reduce((s, v) => s + v, 0);
    return { buckets, labels, colors, total, oldest };
  }, [debts, payments, rates, base, nowMs]);

  /* ====== ٢) قائمة «يتطلب انتباهك» — إجراءات ذكية موجّهة بالأهداف ====== */
  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(p.debtId, (paidMap.get(p.debtId) || 0) + p.amount);

    let overdueCount = 0, overdueAmt = 0, silentCount = 0;
    for (const d of debts) {
      if (d.type !== "receivable" || d.status === "settled" || d.status === "cancelled") continue;
      const paid = paidMap.get(d.id) || 0;
      const remaining = d.amount - paid;
      if (remaining <= 0.01) continue;
      const age = Math.max(0, Math.round((nowMs - new Date(d.date).getTime()) / 86400000));
      if (age > 90) {
        overdueCount++;
        overdueAmt += toBase(remaining, d.currency, rates, base);
      }
      if (paid === 0 && age > 30) silentCount++;
    }
    if (overdueCount > 0) {
      items.push({
        id: "overdue",
        level: "danger",
        title: `${toDigits(overdueCount, arabic)} عملية متأخرة عن ٩٠ يوماً`,
        desc: `بقيمة ${fmtMoney(overdueAmt, base, arabic)} — الأكثر خطورة على تحصيلك`,
        actionLabel: "تقرير التقادم",
        action: () => navigate("accounting?tab=reports"),
      });
    }
    if (silentCount > 0) {
      items.push({
        id: "silent",
        level: "warning",
        title: `${toDigits(silentCount, arabic)} عملية بلا أي سداد منذ أكثر من ٣٠ يوماً`,
        desc: "لم تُسجَّل عليها أي دفعة — راجعها وتواصل مع الأطراف",
        actionLabel: "العمليات",
        action: () => navigate("debts"),
      });
    }
    const drafts = docs.filter((d) => d.status === "draft");
    if (drafts.length > 0) {
      items.push({
        id: "drafts",
        level: "warning",
        title: `${toDigits(drafts.length, arabic)} مستند مسودة غير معتمد`,
        desc: "أتمّ بياناتها واعتمدها لتصبح وثائق نافذة",
        actionLabel: "المستندات",
        action: () => navigate("documents"),
      });
    }
    const last = settings.lastAutoBackupAt;
    const stale = !last || nowMs - new Date(last).getTime() > 7 * 86400000;
    if (stale) {
      items.push({
        id: "backup",
        level: "warning",
        title: "لا توجد نسخة احتياطية حديثة",
        desc: last ? `آخر نسخة: ${fmtDate(last, arabic, true)}` : "أنشئ نسخة احتياطية لحماية بياناتك من الفقدان",
        actionLabel: "الإعدادات",
        action: () => navigate("settings"),
      });
    }
    return items;
  }, [debts, payments, docs, rates, base, settings.lastAutoBackupAt, arabic, navigate, nowMs]);

  /* آخر المستندات */
  const recentDocs = useMemo(() =>
    [...docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  [docs]);

  /* آخر العمليات */
  const latest = useMemo(() =>
    [...debts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  [debts]);

  const C = 2 * Math.PI * 42;
  const agingArcs = useMemo(() => {
    if (aging.total <= 0) return [];
    let offset = 0;
    return aging.buckets.map((b, i) => {
      const len = (b / aging.total) * C;
      const arc = { len, offset, color: aging.colors[i] };
      offset += len;
      return arc;
    });
  }, [aging, C]);

  const hour = new Date(nowMs).getHours();
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  const lastBackup = settings.lastAutoBackupAt;
  const backupStale = !lastBackup || nowMs - new Date(lastBackup).getTime() > 7 * 86400000;

  return (
    <div className="space-y-6">
      {/* ===== الترويسة: ترحيب + صافي المركز + إجراءات سريعة ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-brand-800 via-brand-700 to-emerald-700 p-6 text-white shadow-lg shadow-brand-800/20 sm:p-8 animate-fade-up">
        <div className="absolute -left-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 left-24 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-100">{greeting} 👋</p>
            <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{settings.orgName || "مساحتك الشخصية"}</h2>
            <p className="mt-1 text-[12px] text-brand-100/85">{fmtDate(todayISO(), arabic)} الموافق {hijriDate(todayISO())}</p>
            <p className="mt-3 max-w-xl text-[13px] leading-6 text-brand-100/90">
              صافي مركزك المالي: <b className="text-white">{fmtMoney(stats.net, base, arabic)}</b>
              <span className="mx-1.5 text-brand-200/70">·</span>
              لك <b className="text-white">{fmtMoney(stats.receivable, base, arabic)}</b>
              <span className="mx-1.5 text-brand-200/70">·</span>
              عليك <b className="text-white">{fmtMoney(stats.payable, base, arabic)}</b>
              <span className="mx-1.5 text-brand-200/70">·</span>
              {toDigits(stats.openCount, arabic)} عملية مفتوحة
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur",
                backupStale ? "bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40" : "bg-white/15 text-white ring-1 ring-white/25"
              )}>
                {backupStale ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                {lastBackup ? `آخر نسخة احتياطية: ${fmtDate(lastBackup, arabic, true)}` : "لم تُنشأ نسخة احتياطية بعد"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold ring-1 ring-white/25">
                <Landmark size={12} /> العملة الأساسية: {CURRENCIES[base].label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="amber" size="sm" onClick={() => navigate("debts")}><Plus size={15} /> عملية جديدة</Button>
            <Button size="sm" className="bg-white/15 text-white hover:bg-white/25" onClick={() => navigate("documents")}><FileText size={15} /> مستند جديد</Button>
            <Button size="sm" className="bg-white/15 text-white hover:bg-white/25" onClick={() => navigate("ledger")}><NotebookPen size={15} /> دفتر الحسابات</Button>
            <Button size="sm" className="bg-white/15 text-white hover:bg-white/25" onClick={() => navigate("settings")}><DatabaseBackup size={15} /> نسخة احتياطية</Button>
          </div>
        </div>
      </div>

      {/* ===== المؤشرات الرئيسية ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="صافي المركز المالي (لك − عليك)"
          value={fmtMoney(stats.net, base, arabic)}
          sub={stats.net >= 0 ? "وضع إيجابي — مستحقاتك تتجاوز التزاماتك" : "وضع سلبي — التزاماتك تتجاوز مستحقاتك"}
          icon={<Scale size={20} />}
          tone={stats.net >= 0 ? "teal" : "rose"}
          onClick={() => navigate("debts")}
        />
        <StatCard
          label="المستحق لنا (عمليات دائنة)"
          value={fmtMoney(stats.receivable, base, arabic)}
          sub={`${toDigits(debts.filter((d) => d.type === "receivable" && (d.status === "active" || d.status === "partial")).length, arabic)} عملية مفتوحة للتحصيل`}
          icon={<HandCoins size={20} />}
          tone="teal"
          onClick={() => navigate("debts?type=receivable")}
        />
        <StatCard
          label="المستحق علينا (عمليات مدينة)"
          value={fmtMoney(stats.payable, base, arabic)}
          sub="التزامات تجاه الغير — جدولة سدادها يحمي سمعتك"
          icon={<Wallet size={20} />}
          tone="amber"
          onClick={() => navigate("debts?type=payable")}
        />
        <StatCard
          label="محصّل هذا الشهر"
          value={fmtMoney(stats.collectedMonth, base, arabic)}
          sub={`${toDigits(stats.monthPaymentCount, arabic)} دفعة · نسبة التحصيل الكلية ${toDigits(stats.collectionRate, arabic)}٪`}
          icon={<TrendingUp size={20} />}
          tone="indigo"
          onClick={() => navigate("accounting?tab=reports")}
        />
      </div>

      {/* ===== النشاط الشهري + أعمار العمليات ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">النشاط الشهري</h3>
              <p className="text-xs text-slate-400">التحصيل مقابل العمليات الجديدة — آخر ٦ أشهر بالعملة الأساسية</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-brand-700 to-brand-400" /> محصّل
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> عمليات جديدة
              </span>
              <Badge className="bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">
                <Landmark size={12} /> {base}
              </Badge>
            </div>
          </div>
          <div className="flex h-44 items-end justify-between gap-3 sm:gap-5">
            {chart.months.map((m, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    style={{ height: `${Math.max(3, (m.collected / chart.max) * 100)}%`, transitionDelay: `${i * 60}ms` }}
                    className={cn("w-full max-w-6 rounded-t-md transition-all duration-500 ease-out", m.collected > 0 ? "bg-gradient-to-t from-brand-700 to-brand-400 group-hover:from-brand-800 group-hover:to-brand-300" : "bg-slate-100 dark:bg-slate-800")}
                    title={`محصّل: ${fmtMoney(m.collected, base, arabic)}`}
                  />
                  <div
                    style={{ height: `${Math.max(3, (m.created / chart.max) * 100)}%`, transitionDelay: `${i * 60 + 30}ms` }}
                    className={cn("w-full max-w-6 rounded-t-md transition-all duration-500 ease-out", m.created > 0 ? "bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-600 dark:group-hover:bg-slate-500" : "bg-slate-100 dark:bg-slate-800")}
                    title={`عمليات جديدة: ${fmtMoney(m.created, base, arabic)}`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">أعمار العمليات المفتوحة</h3>
              <p className="text-xs text-slate-400">الأرصدة المتبقية حسب عمر كل عملية</p>
            </div>
            <Clock3 size={16} className="shrink-0 text-brand-600" />
          </div>
          {aging.total <= 0 ? (
            <div className="mt-2">
              <EmptyState icon={<CheckCircle2 size={26} />} title="لا توجد أرصدة مفتوحة" description="كل العمليات مسددة — ممتاز!" />
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-center">
                <div className="relative h-36 w-36">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="13" className="stroke-slate-100 dark:stroke-slate-800" />
                    {agingArcs.map((arc, i) => (
                      <circle key={i} cx="50" cy="50" r="42" fill="none" strokeWidth="13"
                        stroke={arc.color} strokeDasharray={`${arc.len} ${C - arc.len}`} strokeDashoffset={-arc.offset} strokeLinecap="butt" />
                    ))}
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
              <p className="mt-3 text-[11px] text-slate-400">
                أقدم عملية مفتوحة عمرها {toDigits(aging.oldest, arabic)} يوماً
                {aging.buckets[3] > 0 && " — يُنصح بمتابعتها فوراً"}
              </p>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => navigate("accounting?tab=reports")}>
                <ArrowLeft size={14} /> تقرير التقادم الكامل
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* ===== يتطلب انتباهك + آخر المستندات ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <BellRing size={16} className="text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">يتطلب انتباهك</h3>
            {attention.length > 0 && (
              <Badge className="bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                {toDigits(attention.length, arabic)}
              </Badge>
            )}
          </div>
          {attention.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 size={24} />
              </span>
              <div>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">كل شيء تحت السيطرة</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">لا توجد إجراءات عاجلة — لا عمليات متأخرة ولا مسودات معلقة، ونسختك الاحتياطية حديثة.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {attention.map((item) => (
                <div key={item.id} className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5",
                  item.level === "danger"
                    ? "border-rose-200 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-500/5"
                    : "border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/5"
                )}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn(
                      "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      item.level === "danger" ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                    )}>
                      {item.level === "danger" ? <AlertTriangle size={17} /> : <CalendarClock size={17} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{item.title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={item.level === "danger" ? "danger" : "outline"} className="shrink-0" onClick={item.action}>
                    {item.actionLabel} <ArrowLeft size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-brand-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">آخر المستندات</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("documents")}>كل المستندات <ArrowLeft size={13} /></Button>
          </div>
          {recentDocs.length === 0 ? (
            <EmptyState icon={<FileText size={26} />} title="لا توجد مستندات بعد" description="أنشئ مستنداً قانونياً من قالب احترافي جاهز" action={<Button size="sm" onClick={() => navigate("documents")}><Plus size={14} /> مستند جديد</Button>} />
          ) : (
            <div className="space-y-2.5">
              {recentDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-brand-300 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-base dark:bg-brand-500/10">
                      {DOC_TYPES[d.type as DocType]?.icon || "📄"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-slate-700 dark:text-slate-200">{d.title}</p>
                      <p className="text-[11px] text-slate-400">{toDigits(d.number, arabic)} · {fmtDate(d.date, arabic)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge className={d.status === "final"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                      {d.status === "final" ? "معتمد" : "مسودة"}
                    </Badge>
                    <button title="طباعة / PDF" onClick={() => navigate(`print/doc/${d.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 cursor-pointer"><Printer size={14} /></button>
                    {d.printProfile?.defaultMode === "paper" ? <Badge className="bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">ورقي</Badge> : <button title="التحقق بالرمز QR" onClick={() => navigate(`verify/${d.number}`)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"><QrCode size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== حسابات الدفتر الشخصي ===== */}
      {ledgerBalances.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen size={17} className="text-brand-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">حسابات الدفتر الشخصي</h3>
              <Badge className="bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                {toDigits(ledgerBalances.length, arabic)} حساب
              </Badge>
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

      {/* ===== آخر الحركات: العمليات + المدفوعات + سجل النشاط ===== */}
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
