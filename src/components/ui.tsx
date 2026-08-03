/* ====== مكتبة المكونات الأساسية — نظام تصميم سجل ====== */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
/* الحركات تعتمد على CSS فقط (لا framer-motion) */
import { X, Inbox, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp } from "@/lib/store";
import { toDigits } from "@/lib/utils";

/* ===== زر ===== */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "amber";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", className, children, ...props }, ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-700/20 active:scale-[0.98]",
        variant === "amber" && "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/25 active:scale-[0.98]",
        variant === "secondary" && "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        variant === "outline" && "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60 bg-transparent",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20 active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/* ===== بطاقة ===== */
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900",
        onClick && "cursor-pointer transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ===== شارة ===== */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

/* ===== حقول الإدخال ===== */
export const inputCls =
  "w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 transition";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props }, ref
) {
  return <input ref={ref} className={cn(inputCls, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props }, ref
) {
  return (
    <select ref={ref} className={cn(inputCls, "cursor-pointer appearance-none bg-no-repeat pl-9 dark:[color-scheme:dark]", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4z'/%3E%3C/svg%3E\")", backgroundPosition: "left 0.6rem center" }}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props }, ref
) {
  return <textarea ref={ref} className={cn(inputCls, "h-auto min-h-24 py-2 leading-7", className)} {...props} />;
});

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
      {children} {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

export function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}

/* ===== مفتاح تبديل ===== */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 cursor-pointer group"
    >
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "right-[22px]" : "right-0.5")} />
      </span>
      {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
    </button>
  );
}

/* ===== نافذة منبثقة ===== */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col animate-fade-up",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ===== تبويبات ===== */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; icon?: ReactNode; count?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all cursor-pointer",
            active === t.key
              ? "bg-white text-brand-800 shadow-sm dark:bg-slate-900 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active === t.key ? "bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>
              {toDigits(t.count, true)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ===== حالة فارغة ===== */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade-in">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon || <Inbox size={28} />}
      </div>
      <div>
        <p className="font-bold text-slate-800 dark:text-slate-200">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ===== رأس صفحة ===== */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ===== بطاقة إحصائية ===== */
export function StatCard({ label, value, sub, icon, tone = "teal", onClick }: {
  label: string; value: string; sub?: string; icon: ReactNode; tone?: "teal" | "amber" | "rose" | "indigo" | "slate"; onClick?: () => void;
}) {
  const tones = {
    teal: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  };
  return (
    <Card className={cn("p-4 sm:p-5", onClick && "hover:-translate-y-0.5 transition-transform")} onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</div>
      </div>
    </Card>
  );
}

/* ===== جدول ذكي ===== */
export function Table({ headers, children, dense }: { headers: ReactNode[]; children: ReactNode; dense?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("divide-y divide-slate-100 dark:divide-slate-800/70", dense && "text-[13px]")}>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, colSpan, dir }: { children?: ReactNode; className?: string; colSpan?: number; dir?: string }) {
  return (
    <td colSpan={colSpan} dir={dir} className={cn("px-4 py-3 text-slate-700 dark:text-slate-300 align-middle", className)}>
      {children}
    </td>
  );
}

/* ===== شريط تقدم ===== */
export function Progress({ value, className, tone = "teal" }: { value: number; className?: string; tone?: "teal" | "amber" | "rose" }) {
  const tones = { teal: "bg-brand-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ===== حاوية التنبيهات ===== */
export function ToastViewport() {
  const { toasts, dismissToast } = useApp();
  const icons = {
    success: <CheckCircle2 size={17} className="text-emerald-500" />,
    error: <AlertCircle size={17} className="text-rose-500" />,
    info: <Info size={17} className="text-sky-500" />,
  };
  return (
    <div className="fixed bottom-4 left-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 animate-fade-up"
        >
          {icons[t.kind]}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.message}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-slate-300 hover:text-slate-500 cursor-pointer"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/* ===== Skeleton Loading ===== */
function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-right">
                <SkeletonBar className="mx-auto h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBar className={cn("h-4", c === 0 ? "w-24" : c === cols - 1 ? "w-16" : "w-32")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-7 w-32" />
          <SkeletonBar className="h-2.5 w-20" />
        </div>
        <SkeletonBar className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </Card>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-5">
      <div className="space-y-3">
        <SkeletonBar className="h-4 w-40" />
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBar key={i} className={cn("h-3", i === lines - 1 ? "w-3/4" : "w-full")} />
        ))}
      </div>
    </Card>
  );
}
