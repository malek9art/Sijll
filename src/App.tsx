/* ====== التطبيق الرئيسي: التوجيه + قفل الجلسة + الاختصارات ====== */
import { useEffect, useState } from "react";
/* eslint-disable react-hooks/exhaustive-deps */
import { ShieldCheck, Lock, Eye, EyeOff, Fingerprint } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AppProvider, useApp } from "@/lib/store";
import { navigate, useHashRoute } from "@/lib/router";
import { AppShell } from "@/components/layout";
import { Button, ToastViewport } from "@/components/ui";
import { ensureReminders } from "@/lib/db";
import { verifyBiometric } from "@/lib/biometric";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { DebtsPage } from "@/features/debts/DebtsPage";
import { LedgerPage } from "@/features/ledger/LedgerPage";
import { AccountingPage } from "@/features/accounting/AccountingPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PrintPage } from "@/features/print/PrintPage";
import { VerifyPage } from "@/features/verify/VerifyPage";
import { hashCode } from "@/lib/utils";

function LockScreen() {
  const { settings, unlock, toast } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const submit = () => {
    if (settings.pin && hashCode(pin) === settings.pin) {
      setError(false);
      unlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  const bioLogin = async () => {
    if (!settings.bioCredentialId || bioBusy) return;
    setBioBusy(true);
    const ok = await verifyBiometric(settings.bioCredentialId);
    setBioBusy(false);
    if (ok) unlock();
    else toast("error", "تعذر التحقق البيومتري", "استخدم رمز PIN بدلاً من ذلك");
  };

  /* طلب البصمة تلقائياً عند فتح شاشة القفل إن كانت مفعّلة */
  useEffect(() => {
    if (settings.bioCredentialId) void bioLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••"
              className="h-14 w-full rounded-xl border border-white/10 bg-white/10 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
            />
            <button onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-bold text-rose-400">رمز PIN غير صحيح</p>}
          {settings.bioCredentialId && (
            <Button className="mt-4 w-full bg-white/10 text-white hover:bg-white/20" onClick={bioLogin} disabled={bioBusy}>
              <Fingerprint size={16} className={bioBusy ? "animate-pulse" : ""} />
              {bioBusy ? "بانتظار التحقق..." : "فتح بالبصمة / Face ID"}
            </Button>
          )}
          <Button className="mt-2 w-full" onClick={submit}><Lock size={15} /> فتح برمز PIN</Button>
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
  if (seg[0] === "print") return <PrintPage />;
  if (seg[0] === "verify" && seg[1]) return <VerifyPage number={seg[1]} />;
  if (locked && settings.pin) return <LockScreen />;

  const page = seg[0] || "dashboard";
  return (
    <AppShell>
      {page === "dashboard" && <Dashboard />}
      {page === "debts" && <DebtsPage />}
      {page === "ledger" && <LedgerPage />}
      {page === "accounting" && <AccountingPage />}
      {page === "documents" && <DocumentsPage />}
      {page === "settings" && <SettingsPage />}
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
