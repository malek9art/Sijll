/* ====== مصادقة Neon Auth + وضع Offline لكل مستخدم ====== */
/* eslint-disable react-hooks/set-state-in-effect */
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { closeActiveDatabase, setAuditActor, switchUserDatabase } from "./db";
import { hashPin, verifyPin } from "./utils";

export const NEON_AUTH_URL = (import.meta.env.VITE_NEON_AUTH_URL || "").trim();
export const NEON_DATA_API_URL = (import.meta.env.VITE_NEON_DATA_API_URL || "").trim();
export const NEON_CONFIGURED = Boolean(NEON_AUTH_URL && NEON_DATA_API_URL);

/* لا يُستدعى العميل إلا بعد ضبط متغيرات Neon؛ العنوان الوهمي يمنع undefined. */
export const authClient = createAuthClient(
  NEON_AUTH_URL || "https://neon-auth-not-configured.invalid",
  { adapter: BetterAuthReactAdapter() },
);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

interface StoredOfflineCredential {
  user: AuthUser;
  verifier: string;
  savedAt: string;
}

const OFFLINE_CREDENTIAL_KEY = "sijll:offline-credential";

type NeonOtpClient = {
  emailOtp: {
    verifyEmail: (input: { email: string; otp: string }) => Promise<unknown>;
  };
};

function readOfflineCredential(): StoredOfflineCredential | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CREDENTIAL_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredOfflineCredential>;
    if (!value.user?.id || !value.verifier) return null;
    return value as StoredOfflineCredential;
  } catch {
    return null;
  }
}

async function cacheOfflineCredential(user: AuthUser, secret: string): Promise<void> {
  const verifier = await hashPin(secret);
  localStorage.setItem(OFFLINE_CREDENTIAL_KEY, JSON.stringify({ user, verifier, savedAt: new Date().toISOString() } satisfies StoredOfflineCredential));
}

function clearOfflineCredential(): void {
  try { localStorage.removeItem(OFFLINE_CREDENTIAL_KEY); } catch { /* غير حرج */ }
}

function useOnlineState(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

interface AuthContextValue {
  configured: boolean;
  pending: boolean;
  online: boolean;
  offline: boolean;
  user: AuthUser | null;
  offlineCandidate: AuthUser | null;
  databaseReady: boolean;
  databaseError: string | null;
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (name: string, email: string, password: string) => Promise<unknown>;
  requestPasswordReset: (email: string) => Promise<unknown>;
  verifyEmail: (email: string, otp: string) => Promise<unknown>;
  resendVerification: (email: string) => Promise<unknown>;
  rememberOfflineCredential: (user: AuthUser, secret: string) => Promise<void>;
  unlockOffline: (secret: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function ConfiguredAuthProvider({ children }: { children: ReactNode }) {
  const sessionState = authClient.useSession();
  const online = useOnlineState();
  const rawUser = sessionState.data?.user;
  const onlineUser: AuthUser | null = rawUser
    ? {
        id: rawUser.id,
        name: rawUser.name || rawUser.email,
        email: rawUser.email,
        /* لا نفتح مساحة البيانات إلا بإشارة صريحة من Neon بأن البريد مؤكد. */
        emailVerified: rawUser.emailVerified === true,
      }
    : null;
  const [offlineUser, setOfflineUser] = useState<AuthUser | null>(null);
  const [offlineCandidate, setOfflineCandidate] = useState<AuthUser | null>(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) return null;
    return readOfflineCredential()?.user || null;
  });
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const user = onlineUser || offlineUser;
  const userId = user?.id || "";

  useEffect(() => {
    if (onlineUser) {
      setOfflineCandidate(null);
      setOfflineUser(null);
      return;
    }
    if (!online) setOfflineCandidate(readOfflineCredential()?.user || null);
  }, [online, onlineUser?.id]);

  /* لا تنشئ اعتماداً محلياً فارغاً عند تسجيل الدخول العادي؛ يُحدّثه AuthScreen بعد نجاح كلمة المرور. */
  useEffect(() => {
    if (onlineUser) setOfflineCandidate(null);
  }, [onlineUser?.id]);

  useEffect(() => {
    let cancelled = false;
    setDatabaseReady(false);
    setDatabaseError(null);

    if (!userId || user?.emailVerified !== true) {
      closeActiveDatabase();
      return () => { cancelled = true; };
    }

    void switchUserDatabase(userId)
      .then(() => {
        if (cancelled) return;
        setAuditActor(user?.name || user?.email);
        setDatabaseReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setDatabaseError(err instanceof Error ? err.message : "تعذر فتح قاعدة بيانات المستخدم");
      });

    return () => { cancelled = true; };
  }, [userId, user?.email, user?.name, user?.emailVerified]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: true,
    pending: online && sessionState.isPending && !offlineUser,
    online,
    offline: Boolean(offlineUser && !onlineUser),
    user,
    offlineCandidate,
    databaseReady,
    databaseError,
    signIn: (email, password) => authClient.signIn.email({ email, password }),
    signUp: (name, email, password) => authClient.signUp.email({ name, email, password }),
    requestPasswordReset: (email) => authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}${window.location.pathname}` }),
    verifyEmail: (email, otp) => (authClient as unknown as NeonOtpClient).emailOtp.verifyEmail({ email, otp }),
    resendVerification: (email) => authClient.sendVerificationEmail({ email, callbackURL: window.location.href }),
    rememberOfflineCredential: async (offlineIdentity, secret) => {
      if (!secret) return;
      await cacheOfflineCredential(offlineIdentity, secret);
    },
    unlockOffline: async (secret) => {
      const stored = readOfflineCredential();
      if (!stored) throw new Error("لا توجد بيانات فتح دون اتصال لهذا الجهاز");
      const checked = await verifyPin(secret, stored.verifier);
      if (!checked.ok) throw new Error("كلمة مرور الحساب غير صحيحة");
      setOfflineUser(stored.user);
      setOfflineCandidate(null);
    },
    signOut: async () => {
      clearOfflineCredential();
      setOfflineUser(null);
      setOfflineCandidate(null);
      try {
        await authClient.signOut();
      } finally {
        closeActiveDatabase();
      }
    },
  }), [databaseError, databaseReady, offlineCandidate, offlineUser, online, onlineUser, sessionState.isPending, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!NEON_CONFIGURED) {
    const value: AuthContextValue = {
      configured: false,
      pending: false,
      online: false,
      offline: false,
      user: null,
      offlineCandidate: null,
      databaseReady: false,
      databaseError: null,
      signIn: async () => undefined,
      signUp: async () => undefined,
      requestPasswordReset: async () => undefined,
      verifyEmail: async () => undefined,
      resendVerification: async () => undefined,
      rememberOfflineCredential: async () => undefined,
      unlockOffline: async () => undefined,
      signOut: async () => undefined,
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return <ConfiguredAuthProvider>{children}</ConfiguredAuthProvider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

/** استخراج مستخدم Neon من نتيجة sign-in/sign-up لتخزين فتح Offline دون حفظ كلمة المرور. */
export function userFromAuthResult(result: unknown, fallback: { email: string; name?: string }): AuthUser | null {
  if (!result || typeof result !== "object") return null;
  const data = (result as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const raw = (data as { user?: Partial<AuthUser> }).user;
  if (!raw?.id) return null;
  return {
    id: raw.id,
    email: raw.email || fallback.email,
    name: raw.name || fallback.name || fallback.email,
    emailVerified: raw.emailVerified === true,
  };
}
