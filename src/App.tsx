/* ====== التطبيق الرئيسي: التوجيه + قفل الجلسة + الاختصارات ====== */
import { Suspense, lazy, useEffect, useState } from "react";
/* eslint-disable react-hooks/exhaustive-deps */
import { ShieldCheck, Lock, Eye, EyeOff, Fingerprint } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AppProvider, useApp } from "@/lib/store";
import { navigate, useHashRoute } from "@/lib/router";
import { AppShell } from "@/components/layout";
import { Button, ToastViewport } from "@/components/ui";
import { ensureReminders } from "@/lib/db";
import { verifyBiometric } from "@/lib/biometric";
import { verifyPin } from "@/lib/utils";

/* ====== تحميل كسول للصفحات (code splitting) ====== */
const Dashboard = lazy(() => import("@/features/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })));
const DebtsPage = lazy(() => import("@/features/debts/DebtsPage").then((m) => ({ default: m.DebtsPage })));
const LedgerPage = lazy(() => import("@/features/ledger/LedgerPage").then((m) => ({ default: m.LedgerPage })));
const AccountingPage = lazy(() => import("@/features/accounting/AccountingPage").then((m) => ({ default: m.AccountingPage })));
const DocumentsPage = lazy(() => import("@/features/documents/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const PrintPage = lazy(() => import("@/features/print/PrintPage").then((m) => ({ default: m.PrintPage })));
const VerifyPage = lazy(() => import("@/features/verify/VerifyPage").then((m) => ({ default: m.VerifyPage })));

/* ====== مؤشر تحميل محسّن (Skeleton) ====== */
function PageLoader() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="mb-6 flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      {/* Stat cards skeleton */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex gap-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((r) => (
          <div key={r} className="flex gap-8 border-b border-slate-100 px-4 py-4 dark:border-slate-800/70">
            <div className="h-4 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====== جدول التأخيرات التصاعدية بعد محاولات PIN فاشلة ====== */
function getLockoutMs(attempts: number): number {
  if (attempts < 3) return 0;
  if (attempts < 5) return 5_000;
  if (attempts < 8) return 15_000;
  if (attempts < 10) return 30_000;
  return 5 * 60_000; /* 5 دقائق */
}

function LockScreen() {
  const { settings, saveSettings, unlock, toast } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const isLockedOut = Date.now() < lockoutUntil;

  /* عداد تنازلي للقفل */
  useEffect(() => {
    if (!isLockedOut) return;
    setRemaining(Math.ceil((lockoutUntil - Date.now()) / 1000));
    const timer = setInterval(() => {
      const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (secs <= 0) { clearInterval(timer); setRemaining(0); }
      else setRemaining(secs);
    }, 500);
    return () => clearInterval(timer);
  }, [lockoutUntil, isLockedOut]);

  const submit = async () => {
    if (!settings.pin || busy || isLockedOut) return;
    setBusy(true);
    try {
      const { ok, needsUpgrade } = await verifyPin(pin, settings.pin);
      if (ok) {
        setError(false);
        setAttempts(0);
        setLockoutUntil(0);
        /* ترقية hash قديم (hashCode) إلى PBKDF2 تلقائيًا بعد أول نجاح */
        if (needsUpgrade) {
          try {
            const { hashPin } = await import("@/lib/utils");
            await saveSettings({ pin: await hashPin(pin) });
          } catch { /* غير حرج — ستُرقّى في المحاولة التالية */ }
        }
        unlock();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setError(true);
        setPin("");
        const delay = getLockoutMs(next);
        if (delay > 0) setLockoutUntil(Date.now() + delay);
      }
    } catch {
      setError(true);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const bioLogin = async () => {
    if (!settings.bioCredentialId || bioBusy || isLockedOut) return;
    setBioBusy(true);
    const ok = await verifyBiometric(settings.bioCredentialId);
    setBioBusy(false);
    if (ok) { setAttempts(0); setLockoutUntil(0); unlock(); }
    else toast("error", "تعذر التحقق البيومتري", "استخدم رمز PIN بدلاً من ذلك");
  };

  /* طلب البصمة تلقائياً عند فتح شاشة القفل إن كانت مفعّلة */
  useEffect(() => {
    if (settings.bioCredentialId) void bioLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtRemaining = (s: number) => {
    if (s < 60) return `${s} ثانية`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m} دقيقة و ${sec} ثانية`;
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 via-slate-950 to-brand-950 p-4">
      <div className="w-full max-w-xs text-center animate-fade-up">
        <Logo size={72} className="mx-auto drop-shadow-2xl" />
        <h1 className="mt-4 text-xl font-black text-white">التطبيق مقفل</h1>
        <p className="mt-1 text-sm text-slate-400">أدخل رمز PIN لفتح الجلسة</p>
        <div className="mt-6 rounded-2xl bg-white/5 p-5 backdrop-blur">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              inputMode="numeric"
              value={pin}
              autoFocus
              maxLength={6}
              disabled={isLockedOut}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••"
              className="h-14 w-full rounded-xl border border-white/10 bg-white/10 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-40"
            />
            <button onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && !isLockedOut && <p className="mt-2 text-xs font-bold text-rose-400">رمز PIN غير صحيح{attempts >= 3 ? ` — ${attempts} محاولات فاشلة` : ""}</p>}
          {isLockedOut && (
            <p className="mt-2 text-xs font-bold text-amber-400">⏳ محاولات كثيرة — انتظر {fmtRemaining(remaining)}</p>
          )}
          {settings.bioCredentialId && (
            <Button className="mt-4 w-full bg-white/10 text-white hover:bg-white/20" onClick={bioLogin} disabled={bioBusy || isLockedOut}>
              <Fingerprint size={16} className={bioBusy ? "animate-pulse" : ""} />
              {bioBusy ? "بانتظار التحقق..." : "فتح بالبصمة / Face ID"}
            </Button>
          )}
          <Button className="mt-2 w-full" onClick={submit} disabled={busy || isLockedOut}><Lock size={15} /> فتح برمز PIN</Button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={12} /> البيانات محفوظة محلياً · تطوير Malek Logic
          </p>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const route = useHashRoute();
  const { settings, locked, toggleTheme } = useApp();
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    ensureReminders().catch(() => {});
    /* مهام الصيانة التلقائية عند التشغيل: الحذف التلقائي للبيانات القديمة +
       النسخ الاحتياطي التلقائي (محلي يومي، وسحابي عند التفعيل). */
    void (async () => {
      try {
        const { settingsService, cleanupService } = await import("@/lib/db");
        const s = await settingsService.get();
        await cleanupService.run(s);
      } catch { /* غير حرج */ }
      try {
        const { runAutoBackups } = await import("@/lib/backup-auto");
        await runAutoBackups();
      } catch { /* غير حرج */ }
    })();
  }, []);

  /* اختصارات لوحة المفاتيح */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      const k = e.key.toLowerCase();
      if (gPressed) {
        setGPressed(false);
        if (k === "d") navigate("debts");
        if (k === "b") navigate("ledger");
        if (k === "a") navigate("accounting");
        if (k === "l") navigate("documents");
        if (k === "s") navigate("settings");
        return;
      }
      if (k === "g") { setGPressed(true); setTimeout(() => setGPressed(false), 1200); return; }
      if (k === "t") toggleTheme();
      if (k === "d" && e.ctrlKey) navigate("debts");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gPressed, toggleTheme]);

  const seg = route.segments;

  /* الصفحات المستقلة */
  if (seg[0] === "print") return <Suspense fallback={<PageLoader />}><PrintPage /></Suspense>;
  if (seg[0] === "verify" && seg[1]) return <Suspense fallback={<PageLoader />}><VerifyPage number={seg[1]} /></Suspense>;
  if (locked && settings.pin) return <LockScreen />;

  const page = seg[0] || "dashboard";
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        {page === "dashboard" && <Dashboard />}
        {page === "debts" && <DebtsPage />}
        {page === "ledger" && <LedgerPage />}
        {page === "accounting" && <AccountingPage />}
        {page === "documents" && <DocumentsPage />}
        {page === "settings" && <SettingsPage />}
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
      <ToastViewport />
    </AppProvider>
  );
}
