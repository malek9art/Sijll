/* ====== الهيكل العام: شريط جانبي + شريط علوي ====== */
import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
/* الحركات تعتمد على CSS فقط (لا framer-motion) */
import {
  LayoutDashboard, HandCoins, NotebookPen, Scale, FileText, Settings, Bell, Sun, Moon, Lock, Menu, X,
  Search, CheckCheck, ShieldCheck, FileSpreadsheet, WifiOff,
} from "lucide-react";
import { Link, useHashRoute } from "@/lib/router";
import { useApp } from "@/lib/store";
import { db } from "@/lib/db";
import { cn } from "@/utils/cn";
import { fmtDate, toDigits } from "@/lib/utils";
import { Logo } from "./Logo";

const NAV = [
  { to: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "debts", label: "العمليات المالية", icon: HandCoins },
  { to: "ledger", label: "دفتر الحسابات", icon: NotebookPen },
  { to: "accounting", label: "المحاسبة", icon: Scale },
  { to: "documents", label: "المستندات", icon: FileText },
  { to: "settings", label: "الإعدادات", icon: Settings },
];

function NavItem({ to, label, icon: Icon, active, onNavigate }: { to: string; label: string; icon: typeof LayoutDashboard; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onNavigate={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-all",
        active
          ? "bg-brand-700 text-white shadow-md shadow-brand-700/25"
          : "text-slate-600 hover:bg-brand-50 hover:text-brand-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
      )}
    >
      <Icon size={19} className={cn("shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-300")} />
      {label}
      {active && <span className="absolute left-2.5 h-1.5 w-1.5 rounded-full bg-amber-300 animate-fade-in" />}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const route = useHashRoute();
  const { settings } = useApp();
  const active = route.segments[0] || "dashboard";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo size={46} className="shrink-0 drop-shadow-md" />
        <div>
          <p className="text-lg font-black leading-5 text-slate-900 dark:text-white">سجل</p>
          <p className="text-[11px] font-medium text-slate-400">إدارة الحسابات والمديونيات</p>
        </div>
      </div>
      <div className="mx-5 mb-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        {settings.orgName}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} active={active === item.to} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="p-3">
        <div className="rounded-xl border border-dashed border-brand-300/60 bg-brand-50/60 p-3 text-[11px] leading-5 text-brand-800 dark:border-brand-700/40 dark:bg-brand-900/20 dark:text-brand-200">
          <ShieldCheck size={14} className="mb-1 text-brand-600 dark:text-brand-300" />
          بياناتك محفوظة محلياً على جهازك مع تشفير النسخ الاحتياطي.
          <span className="mt-1.5 block font-bold text-brand-900 dark:text-brand-100">تطوير Malek Logic</span>
        </div>
      </div>
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const notifications = useLiveQuery(() => db.notifications.orderBy("at").reverse().limit(15).toArray(), []);
  const unread = notifications?.filter((n) => !n.read).length || 0;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {toDigits(unread, true)}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-fade-up"
          >
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white">التنبيهات</p>
                <button
                  onClick={async () => {
                    await db.notifications.toCollection().modify({ read: true });
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300 cursor-pointer"
                >
                  <CheckCheck size={13} /> تعليم الكل كمقروء
                </button>
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {notifications && notifications.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-slate-400">لا توجد تنبيهات</p>
                )}
                {notifications?.map((n) => (
                  <div key={n.id} className={cn("rounded-xl px-3 py-2.5", n.read ? "" : "bg-brand-50/70 dark:bg-brand-500/10")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{n.title}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">{fmtDate(n.at, true, true)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
          </div>
        </>
      )}
    </div>
  );
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings, toggleTheme, lock, toast } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const online = useOnline();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.hash = `#/debts?q=${encodeURIComponent(query.trim())}`;
      toast("info", "نتائج البحث", `عرض نتائج البحث عن «${query}» في العمليات المالية`);
      setQuery("");
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* رابط تخطي إلى المحتوى — لإمكانية الوصول */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[999] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg">
        تخطي إلى المحتوى
      </a>
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-l border-slate-200/80 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent />
      </aside>

      {/* الشريط الجانبي — الجوال */}
      {mobileNav && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm lg:hidden animate-fade-in" onClick={() => setMobileNav(false)} />
          <aside
            className="fixed inset-y-0 right-0 z-[61] w-72 bg-white shadow-2xl dark:bg-slate-900 lg:hidden animate-fade-in"
          >
            <button onClick={() => setMobileNav(false)} className="absolute left-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileNav(false)} />
          </aside>
        </>
      )}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setMobileNav(true)} className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700 dark:text-slate-300 lg:hidden cursor-pointer">
              <Menu size={18} />
            </button>
            <form onSubmit={submitSearch} className="relative hidden flex-1 sm:block sm:max-w-md">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث في العمليات والأطراف...  ( / )"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800/60 dark:focus:bg-slate-800"
              />
            </form>
            <div className="ms-auto flex items-center gap-2">
              {!online && (
                <span
                  className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30 sm:inline-flex animate-fade-in"
                >
                  <WifiOff size={12} /> دون اتصال — البيانات محفوظة محلياً
                </span>
              )}
              <NotificationsBell />
              <button
                onClick={toggleTheme}
                aria-label="تبديل المظهر"
                title="تبديل المظهر"
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:text-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              >
                {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => {
                  if (settings.pin) lock();
                  else toast("info", "قفل التطبيق", "فعّل رمز PIN من الإعدادات لاستخدام قفل الجلسة");
                }}
                aria-label="قفل الجلسة"
                title="قفل الجلسة"
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:text-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              >
                <Lock size={17} />
              </button>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pr-1.5 pl-3 dark:border-slate-700 dark:bg-slate-800 md:flex">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-black text-white">م</div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">المستخدم الرئيسي</span>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="border-t border-slate-200/70 px-6 py-4 text-center text-[11px] text-slate-400 dark:border-slate-800">
          سجل © {toDigits(new Date().getFullYear(), true)} — منصة عربية شخصية لإدارة الحسابات والمديونيات والمستندات · <FileSpreadsheet size={11} className="inline" /> Offline-First
        </footer>
      </div>
    </div>
  );
}
