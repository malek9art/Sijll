/* ====== سياق التطبيق: الإعدادات + السمة + التنبيهات ====== */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, settingsService } from "./db";
import { DEFAULT_SETTINGS, type AppSettings } from "./types";
import { uid } from "./utils";

export interface ToastItem { id: string; kind: "success" | "error" | "info"; title: string; message?: string }

interface AppContextValue {
  settings: AppSettings;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: ToastItem[];
  toast: (kind: ToastItem["kind"], title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  locked: boolean;
  unlock: () => void;
  lock: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const row = useLiveQuery(() => db.settings.get("app"));
  const settings: AppSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) || {}) }),
    [row]
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, [settings.theme]);

  const toast = (kind: ToastItem["kind"], title: string, message?: string) => {
    const item = { id: uid("tst"), kind, title, message };
    setToasts((t) => [...t, item]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== item.id)), 4200);
  };

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const value: AppContextValue = {
    settings,
    saveSettings: async (patch) => {
      await settingsService.save(patch);
    },
    theme: settings.theme,
    toggleTheme: () => settingsService.save({ theme: settings.theme === "dark" ? "light" : "dark" }),
    toasts,
    toast,
    dismissToast,
    locked,
    unlock: () => setLocked(false),
    lock: () => setLocked(true),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
