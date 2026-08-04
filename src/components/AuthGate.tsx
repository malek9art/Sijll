/* ====== بوابة المصادقة قبل فتح بيانات المستخدم ====== */
import { useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { Logo } from "./Logo";
import { Input } from "./ui";
import { useAuth } from "@/lib/auth";
import { userFromAuthResult } from "@/lib/auth";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 px-4 py-8 text-slate-900">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 text-center">
          <Logo size={76} className="mx-auto drop-shadow-2xl" />
          <h1 className="mt-4 text-2xl font-black text-white">سجل</h1>
          <p className="mt-1 text-sm text-slate-400">حساباتك وبياناتك الخاصة في مساحة مستقلة</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfigRequired() {
  return (
    <Shell>
      <div className="rounded-3xl border border-amber-300/20 bg-white/10 p-6 text-right shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 shrink-0 text-amber-300" size={22} />
          <div>
            <h2 className="font-bold text-white">إعداد Neon Auth مطلوب</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              لم يتم ضبط رابط المصادقة. أضف المتغيرين التاليين في بيئة التشغيل ثم أعد بناء التطبيق:
            </p>
          </div>
        </div>
        <code dir="ltr" className="mt-4 block overflow-x-auto rounded-xl bg-slate-950/70 px-4 py-3 text-left text-xs leading-6 text-emerald-300">
          VITE_NEON_AUTH_URL=https://…/auth<br />
          VITE_NEON_DATA_API_URL=https://…/rest/v1
        </code>
        <p className="mt-4 text-[11px] leading-6 text-slate-400">
          لا يتم تشغيل وضع تجريبي عام حتى لا تختلط بيانات مستخدم غير مصادق عليه مع بيانات الحسابات.
        </p>
      </div>
    </Shell>
  );
}

type AuthMode = "signin" | "signup" | "forgot";

function errorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const error = (result as { error?: { message?: string } | null }).error;
  return error?.message;
}

function AuthScreen() {
  const { signIn, signUp, requestPasswordReset, rememberOfflineCredential } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setMessage(null);
    setSuccess(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setMessage("أدخل الاسم الذي سيظهر داخل النظام");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setMessage("يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const result = await signIn(cleanEmail, password);
        const error = errorMessage(result);
        if (error) setMessage(error);
        else {
          const identity = userFromAuthResult(result, { email: cleanEmail });
          if (identity) await rememberOfflineCredential(identity, password);
        }
      } else if (mode === "signup") {
        const result = await signUp(name.trim(), cleanEmail, password);
        const error = errorMessage(result);
        if (error) setMessage(error);
        else {
          setSuccess("تم إنشاء الحساب. تحقق من بريدك الإلكتروني قبل الدخول ثم سجّل الدخول.");
          setMode("signin");
          setPassword("");
        }
      } else {
        const result = await requestPasswordReset(cleanEmail);
        const error = errorMessage(result);
        if (error) setMessage(error);
        else setSuccess("تم إرسال تعليمات استعادة كلمة المرور إلى بريدك إن كان الحساب موجوداً.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "تعذر إكمال العملية");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب جديد" : "استعادة كلمة المرور";

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            {mode === "signup" ? <UserPlus size={20} /> : mode === "forgot" ? <Mail size={20} /> : <LockKeyhole size={20} />}
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {mode === "forgot" ? "سنرسل رابط الاستعادة إلى البريد المسجل" : "بياناتك المحلية تُفتح بعد مصادقة حسابك"}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm leading-6 text-rose-700 ring-1 ring-rose-200">
            <AlertCircle size={16} className="mt-1 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={16} className="mt-1 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">الاسم</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">البريد الإلكتروني</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" autoComplete="email" />
          </label>
          {mode !== "forgot" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">كلمة المرور</span>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف أو أرقام على الأقل" dir="ltr" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </label>
          )}
          <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60">
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {mode === "signin" ? "دخول آمن" : mode === "signup" ? "إنشاء الحساب" : "إرسال رابط الاستعادة"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
          {mode === "signin" ? (
            <>
              <button onClick={() => switchMode("signup")} className="text-brand-700 hover:underline">إنشاء حساب</button>
              <button onClick={() => switchMode("forgot")} className="text-slate-500 hover:text-brand-700 hover:underline">نسيت كلمة المرور؟</button>
            </>
          ) : (
            <button onClick={() => switchMode("signin")} className="flex items-center gap-1 text-brand-700 hover:underline"><ArrowLeft size={13} /> العودة لتسجيل الدخول</button>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          كل حساب يفتح قاعدة محلية مستقلة. لا تظهر بيانات حساب لمستخدم آخر على نفس الجهاز.
        </p>
      </div>
    </Shell>
  );
}

function OfflineUnlock({ user }: { user: { name: string; email: string } }) {
  const { unlockOffline } = useAuth();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlockOffline(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر فتح البيانات المحلية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white p-6 text-center shadow-2xl">
        <LockKeyhole size={28} className="mx-auto text-brand-700" />
        <h2 className="mt-4 text-lg font-black text-slate-900">فتح دون اتصال</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">لا يوجد اتصال بالإنترنت. أدخل كلمة مرور حسابك لفتح بياناتك المحلية.</p>
        <p className="mt-2 text-sm font-bold text-slate-800" dir="ltr">{user.email}</p>
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="كلمة مرور الحساب" dir="ltr" autoFocus />
          <button type="submit" disabled={busy || !secret} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white disabled:opacity-50">
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            فتح البيانات المحلية
          </button>
        </form>
        <p className="mt-4 text-[11px] leading-5 text-slate-400">المستخدم: {user.name} · رفع واستعادة النسخ متاحان عند عودة الاتصال.</p>
      </div>
    </Shell>
  );
}

function EmailVerificationNotice({ email }: { email: string }) {
  const { resendVerification, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      const result = await resendVerification(email);
      if (!errorMessage(result)) setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="rounded-3xl border border-white/10 bg-white p-6 text-center shadow-2xl">
        <Mail size={28} className="mx-auto text-brand-700" />
        <h2 className="mt-4 text-lg font-black text-slate-900">تحقق من بريدك الإلكتروني</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">أرسلنا رسالة تحقق إلى:</p>
        <p className="mt-1 font-bold text-slate-800" dir="ltr">{email}</p>
        {sent && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">تمت إعادة إرسال رسالة التحقق.</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => void resend()} disabled={busy} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "جارٍ الإرسال..." : "إعادة إرسال"}
          </button>
          <button onClick={() => void signOut()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">تسجيل الخروج</button>
        </div>
      </div>
    </Shell>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, pending, online, user, offlineCandidate, databaseReady, databaseError } = useAuth();

  if (!configured) return <ConfigRequired />;
  if (pending) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-white shadow-2xl backdrop-blur">
          <LoaderCircle size={30} className="mx-auto animate-spin text-brand-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">جارٍ التحقق من جلسة الحساب…</p>
        </div>
      </Shell>
    );
  }
  if (!user && !online && offlineCandidate) return <OfflineUnlock user={offlineCandidate} />;
  if (!user) return <AuthScreen />;
  if (user.emailVerified === false) return <EmailVerificationNotice email={user.email} />;
  if (databaseError) {
    return (
      <Shell>
        <div className="rounded-3xl border border-rose-300/20 bg-white/10 p-6 text-center text-white shadow-2xl backdrop-blur">
          <AlertCircle size={28} className="mx-auto text-rose-300" />
          <h2 className="mt-4 font-bold">تعذر فتح بيانات الحساب</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{databaseError}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900">إعادة المحاولة</button>
        </div>
      </Shell>
    );
  }
  if (!databaseReady) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-white shadow-2xl backdrop-blur">
          <LoaderCircle size={30} className="mx-auto animate-spin text-brand-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">جارٍ تجهيز مساحة بياناتك الخاصة…</p>
        </div>
      </Shell>
    );
  }
  return <>{children}</>;
}
