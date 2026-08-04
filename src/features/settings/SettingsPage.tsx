/* ====== الإعدادات: المنشأة، الأمان، النسخ الاحتياطي، المزامنة ====== */
import { useEffect, useRef, useState } from "react";
import {
  Building2, Palette, ShieldCheck, DatabaseBackup, Info, KeyRound, Fingerprint,
  Download, Upload, Trash2, Save, CheckCircle2, RefreshCw, Eye, EyeOff, UserRound, CloudUpload, FolderOpen,
  Eraser, HardDrive, History,
} from "lucide-react";
import { db, backupService, cleanupService, initDB, localBackupService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Switch } from "@/components/ui";
import { cn } from "@/utils/cn";
import {
  connectDrive, disconnectDrive, downloadBackupFromDrive, isDriveConnected,
  listDriveBackups, uploadBackupToDrive, type DriveBackupFile,
} from "@/lib/drive";
import { isBiometricAvailable, registerBiometric } from "@/lib/biometric";
import { CURRENCIES, CURRENCY_KEYS, type AppSettings, type Currency, type LocalBackup } from "@/lib/types";
import { fmtDate, hashPin, readFileText, toDigits, todayISO } from "@/lib/utils";
import { backupOwnerHash, decryptBackup, encryptBackup, isEncryptedBackup } from "@/lib/backup-crypto";

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{icon}</div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          {desc && <p className="text-xs text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const { settings, saveSettings, toast } = useApp();
  const { user } = useAuth();
  const [form, setForm] = useState<AppSettings>(settings);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const arabic = settings.arabicDigits;
  const [backupBusy, setBackupBusy] = useState<"export" | "import" | null>(null);

  /*
   * Google Drive OAuth Client ID
   * ─────────────────────────────
   * ClientId ليس سريًا بطبيعته — هو معرف عام للتطبيق يُضمّن في كود JavaScript.
   * الأمان الحقيقي يعتمد على:
   * 1. نطاق الصلاحية المحدود (drive.file — يصل فقط لملفات التطبيق)
   * 2. موافقة المستخدم في كل مرة (OAuth consent screen)
   * 3. Authorized JavaScript origins في Google Cloud Console
   *
   * تخزينه في IndexedDB مقبول — لا يحتاج تشفير.
   */
  const [clientIdInput, setClientIdInput] = useState(settings.driveClientId || "");
  const [driveBusy, setDriveBusy] = useState<"idle" | "connect" | "upload" | "list" | "restore">("idle");
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);

  /* البيومتري */
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  /* النسخ المحلية + التنظيف التلقائي */
  const [localBackups, setLocalBackups] = useState<LocalBackup[]>([]);
  const [backupBusy2, setBackupBusy2] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const refreshLocalBackups = async () => {
    try {
      setLocalBackups(await localBackupService.list());
    } catch { setLocalBackups([]); }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setForm(settings);
      setClientIdInput(settings.driveClientId || "");
    });
    void refreshLocalBackups();
    return () => cancelAnimationFrame(frame);
  }, [settings]);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable).catch(() => setBioAvailable(false));
  }, []);

  const driveUpload = async () => {
    if (!user) return;
    setDriveBusy("upload");
    try {
      const data = await backupService.exportAll();
      const envelope = await encryptBackup(data, user.id);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/octet-stream" });
      await uploadBackupToDrive(blob, `sijll-backup-${todayISO()}.sajil`, {
        sijllApp: "sijll",
        sijllOwnerHash: envelope.ownerHash,
        sijllBackupVersion: String(envelope.version),
      });
      try {
        const files = await listDriveBackups(envelope.ownerHash);
        const keep = Math.max(1, form.driveBackupKeep || 20);
        for (const f of files.slice(keep)) {
          const { deleteDriveBackup } = await import("@/lib/drive");
          await deleteDriveBackup(f.id);
        }
        setDriveFiles(files.slice(0, keep));
      } catch { /* تنظيف النسخ القديمة غير حرج */ }
      await saveSettings({ lastAutoBackupAt: new Date().toISOString() });
      await refreshLocalBackups();
      toast("success", "تم رفع نسخة مشفرة إلى Google Drive", "لا يمكن قراءة محتوى الملف مباشرة من Drive");
    } catch (err) {
      toast("error", "تعذر الرفع إلى درايف", err instanceof Error ? err.message : undefined);
    } finally {
      setDriveBusy("idle");
    }
  };

  const driveList = async () => {
    if (!user) return;
    setDriveBusy("list");
    try {
      setDriveFiles(await listDriveBackups(await backupOwnerHash(user.id)));
    } catch (err) {
      toast("error", "تعذر جلب النسخ", err instanceof Error ? err.message : undefined);
    } finally {
      setDriveBusy("idle");
    }
  };

  const driveRestore = async (f: DriveBackupFile) => {
    if (!user) return;
    setDriveBusy("restore");
    try {
      const text = await downloadBackupFromDrive(f.id);
      const parsed = JSON.parse(text) as unknown;
      if (!isEncryptedBackup(parsed)) throw new Error("الملف غير مشفر بصيغة سجل المدعومة");
      const data = await decryptBackup(parsed, user.id);
      await backupService.importAll(data, true);
      await refreshLocalBackups();
      toast("success", "تمت الاستعادة من Google Drive", f.name);
    } catch (err) {
      toast("error", "تعذرت الاستعادة", err instanceof Error ? err.message : "تأكد من أن النسخة تخص حسابك وسليمة");
    } finally {
      setDriveBusy("idle");
    }
  };

  const enableBiometric = async () => {
    setBioBusy(true);
    try {
      const credId = await registerBiometric();
      await saveSettings({ bioCredentialId: credId });
      toast("success", "تم تفعيل الدخول البيومتري", "البصمة / Face ID ستعمل من شاشة القفل");
    } catch (err) {
      toast("error", "تعذر تفعيل البصمة", err instanceof Error ? err.message : "الجهاز لا يدعم التحقق البيومتري");
    } finally {
      setBioBusy(false);
    }
  };

  const set = (k: keyof AppSettings, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const exportBackup = async () => {
    if (!user) return;
    setBackupBusy("export");
    try {
      const data = await backupService.exportAll();
      const envelope = await encryptBackup(data, user.id);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sijll-backup-${todayISO()}.sajil`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("success", "تم تصدير نسخة مشفرة", "لا تحتاج النسخة إلى كلمة مرور إضافية عند الاستعادة بحسابك");
    } catch (err) {
      toast("error", "تعذر تصدير النسخة", err instanceof Error ? err.message : undefined);
    } finally {
      setBackupBusy(null);
    }
  };

  const importBackup = async (file: File) => {
    if (!user) return;
    setBackupBusy("import");
    try {
      const parsed = JSON.parse(await readFileText(file)) as unknown;
      if (!isEncryptedBackup(parsed)) throw new Error("هذه النسخة غير مشفرة بصيغة سجل المدعومة");
      const data = await decryptBackup(parsed, user.id);
      await backupService.importAll(data, true);
      await refreshLocalBackups();
      toast("success", "تم استيراد النسخة المشفرة بنجاح");
    } catch (err) {
      toast("error", "تعذر قراءة النسخة", err instanceof Error ? err.message : "تأكد من أن الملف يخص حسابك");
    } finally {
      setBackupBusy(null);
    }
  };

  const createLocalBackup = async () => {
    if (!user) return;
    setBackupBusy2(true);
    try {
      const data = await backupService.exportAll();
      const envelope = await encryptBackup(data, user.id);
      await localBackupService.createFromData(envelope as unknown as Record<string, unknown>);
      await localBackupService.applyRetention(form.localBackupKeep || 6);
      await saveSettings({ lastAutoBackupAt: new Date().toISOString() });
      await refreshLocalBackups();
      toast("success", "تم إنشاء نسخة محلية مشفرة", "محفوظة داخل الجهاز — تعمل دون إنترنت");
    } catch (err) {
      toast("error", "تعذر إنشاء النسخة المحلية", err instanceof Error ? err.message : undefined);
    } finally {
      setBackupBusy2(false);
    }
  };

  const restoreLocalBackup = async (b: LocalBackup) => {
    if (!user) return;
    setBackupBusy2(true);
    try {
      const stored = await localBackupService.get(b.id);
      if (!stored || !isEncryptedBackup(stored.data)) throw new Error("النسخة المحلية غير مشفرة بصيغة مدعومة");
      const data = await decryptBackup(stored.data, user.id);
      await backupService.importAll(data, true);
      await refreshLocalBackups();
      toast("success", "تمت الاستعادة من النسخة المحلية", fmtDate(b.at, arabic, true));
    } catch (err) {
      toast("error", "تعذرت الاستعادة", err instanceof Error ? err.message : undefined);
    } finally {
      setBackupBusy2(false);
    }
  };

  const runCleanupNow = async () => {
    setCleanupBusy(true);
    try {
      const result = await cleanupService.run({
        autoCleanupEnabled: form.autoCleanupEnabled,
        cleanupAuditDays: form.cleanupAuditDays,
        cleanupCancelledMonths: form.cleanupCancelledMonths,
        localBackupKeep: form.localBackupKeep,
      });
      await refreshLocalBackups();
      if (!result) { toast("info", "التنظيف التلقائي معطّل", "فعّل الخيار أولاً أو حدّث القيم"); }
      else {
        const total = result.logs + result.notifications + result.debts + result.backups;
        toast("success", "اكتمل التنظيف التلقائي", total === 0
          ? "لا توجد بيانات تجاوزت مدة الاحتفاظ"
          : `سجل تدقيق: ${result.logs} · تنبيهات: ${result.notifications} · عمليات ملغاة: ${result.debts} · نسخ محلية: ${result.backups}`);
      }
    } catch (err) {
      toast("error", "تعذر التنظيف", err instanceof Error ? err.message : undefined);
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="الإعدادات" description="إدارة المنشأة، التفضيلات، الأمان، والنسخ الاحتياطي" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section icon={<UserRound size={18} />} title="بيانات مصدر المستندات" desc="جميع الحقول اختيارية — اختر شخصاً أو منشأة، واملأ ما يناسبك فقط">
          <div className="space-y-4">
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60 w-fit">
              {([
                { key: "personal", label: "شخصي", icon: <UserRound size={14} /> },
                { key: "org", label: "منشأة / جهة", icon: <Building2 size={14} /> },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => set("profileMode", m.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all cursor-pointer",
                    form.profileMode === m.key
                      ? "bg-white text-brand-800 shadow-sm dark:bg-slate-900 dark:text-brand-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  )}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={form.profileMode === "personal" ? "الاسم الكامل" : "اسم المنشأة"}>
                <Input value={form.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder={form.profileMode === "personal" ? "مثال: أحمد محمد..." : "مثال: شركة..."} />
              </Field>
              <Field label={form.profileMode === "personal" ? "المدينة" : "مدينة المقر"}>
                <Input value={form.orgCity} onChange={(e) => set("orgCity", e.target.value)} />
              </Field>
              <Field label="العنوان" className="sm:col-span-2">
                <Input value={form.orgAddress} onChange={(e) => set("orgAddress", e.target.value)} />
              </Field>
              <Field label="الهاتف">
                <Input type="tel" value={form.orgPhone} onChange={(e) => set("orgPhone", e.target.value)} dir="ltr" />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input type="email" value={form.orgEmail} onChange={(e) => set("orgEmail", e.target.value)} dir="ltr" />
              </Field>
              {form.profileMode === "org" && (
                <Field label="الترخيص / السجل" className="sm:col-span-2">
                  <Input value={form.orgLicense} onChange={(e) => set("orgLicense", e.target.value)} placeholder="اختياري للمنشآت" />
                </Field>
              )}
            </div>
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-6 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              تظهر هذه البيانات في ترويسة وتذييل المستندات والتقارير المطبوعة وملفات PDF. اترك الحقول الفارغة وستُحذف تلقائياً من المطبوعات.
            </p>
          </div>
        </Section>

        <Section icon={<Palette size={18} />} title="التفضيلات">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="العملة الأساسية">
                <select className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" value={form.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value as Currency)}>
                  {CURRENCY_KEYS.map((c) => <option key={c} value={c}>{CURRENCIES[c].label}</option>)}
                </select>
              </Field>
              <Field label={`أسعار الصرف (قيمة الوحدة مقابل ${CURRENCIES[form.baseCurrency].label})`}>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCY_KEYS.filter((c) => c !== form.baseCurrency).map((c) => (
                    <div key={c}>
                      <p className="mb-1 text-[10px] font-bold text-slate-400">{CURRENCIES[c].label}</p>
                      <Input type="number" step="0.00001" value={form.exchangeRates[c] || 0} onChange={(e) => set("exchangeRates", { ...form.exchangeRates, [c]: parseFloat(e.target.value) || 0 })} />
                    </div>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">الأرقام العربية (٠١٢٣)</p>
                <p className="text-xs text-slate-400">استخدام الأرقام العربية-الهندية في الجداول والمستندات</p>
              </div>
              <Switch checked={form.arabicDigits} onChange={(v) => set("arabicDigits", v)} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">المظهر الداكن</p>
                <p className="text-xs text-slate-400">راحة بصرية في الإضاءة المنخفضة</p>
              </div>
              <Switch checked={form.theme === "dark"} onChange={(v) => set("theme", v ? "dark" : "light")} />
            </div>
            <Button onClick={async () => { await saveSettings(form); toast("success", "تم حفظ الإعدادات"); }}>
              <Save size={15} /> حفظ التفضيلات
            </Button>
          </div>
        </Section>

        <Section icon={<ShieldCheck size={18} />} title="الأمان وحماية الجلسة">
          <div className="space-y-4">
            <p className="text-[13px] leading-7 text-slate-500 dark:text-slate-400">
              فعّل رمز PIN لقفل التطبيق وحماية بياناتك عند مغادرة الجهاز. تُخزن البيانات محلياً مع تشفير اختياري للنسخ الاحتياطي.
            </p>
            {settings.pin ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={16} /> قفل الجلسة مفعّل
                </div>
                <Button variant="ghost" size="sm" onClick={async () => { await saveSettings({ pin: undefined }); toast("info", "تم تعطيل رمز PIN"); }}>تعطيل</Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Field label="رمز PIN (٤-٦ أرقام)" className="flex-1">
                  <div className="relative">
                    <Input type={showPin ? "text" : "password"} inputMode="numeric" value={pin} maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="pl-10" />
                    <button onClick={() => setShowPin((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{showPin ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </Field>
                <Button disabled={pin.length < 4} onClick={async () => {
                  await saveSettings({ pin: await hashPin(pin) });
                  setPin("");
                  toast("success", "تم تفعيل رمز PIN", "استخدم زر القفل في الشريط العلوي");
                }}><KeyRound size={15} /> تفعيل</Button>
              </div>
            )}

            {/* الدخول البيومتري */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">الدخول بالبصمة / Face ID</p>
                    <p className="text-[11px] text-slate-400">
                      {bioAvailable ? "جهازك يدعم التحقق البيومتري (WebAuthn)" : "لا يتوفر مُصادِق بيومتري على هذا الجهاز"}
                    </p>
                  </div>
                </div>
                {settings.bioCredentialId ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                      <CheckCircle2 size={11} /> مفعّل
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={async () => { await saveSettings({ bioCredentialId: undefined }); toast("info", "تم تعطيل الدخول البيومتري"); }}>تعطيل</Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={enableBiometric} disabled={!bioAvailable || bioBusy}>
                    <Fingerprint size={15} /> {bioBusy ? "جارٍ التسجيل..." : "تفعيل البصمة"}
                  </Button>
                )}
              </div>
              {settings.bioCredentialId && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  عند قفل التطبيق ستظهر زر «فتح بالبصمة» — ويمكن دائماً استخدام رمز PIN كبديل.
                </p>
              )}
            </div>
          </div>
        </Section>

        <Section icon={<DatabaseBackup size={18} />} title="النسخ الاحتياطي والاستعادة" desc="نسخ مشفرة تلقائياً بمفتاح حسابك — بدون كلمة مرور إضافية">
          <div className="space-y-4">
            <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[11.5px] leading-6 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              كل نسخة تُشفّر داخل المتصفح قبل تنزيلها أو رفعها إلى Google Drive. لا تُقبل النسخة إلا بعد تسجيل الدخول بالحساب الذي أنشأها.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBackup} disabled={backupBusy !== null}>
                {backupBusy === "export" ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {backupBusy === "export" ? "جارٍ التصدير..." : "تصدير نسخة مشفرة"}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={backupBusy !== null}>
                {backupBusy === "import" ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
                {backupBusy === "import" ? "جارٍ الاستيراد..." : "استيراد نسخة مشفرة"}
              </Button>
              <input ref={fileRef} type="file" accept=".sajil,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ""; }} />
            </div>
            <p className="text-[11px] leading-5 text-slate-400">لا تستخدم النسخ القديمة غير المشفرة في هذا المسار؛ هذا يمنع استيراد بيانات حساب آخر بالخطأ.</p>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-[13px] font-bold text-rose-600">منطقة الخطر</p>
              <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}><Trash2 size={14} /> إعادة تهيئة التطبيق ومسح البيانات</Button>
            </div>
          </div>
        </Section>

        <Section icon={<Eraser size={18} />} title="الحذف التلقائي للبيانات (سياسة الاحتفاظ)" desc="تُنفَّذ تلقائياً عند تشغيل التطبيق — مع توثيق كل عملية في سجل التدقيق">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">تفعيل الحذف التلقائي</p>
                <p className="text-xs text-slate-400">حذف البيانات التي تجاوزت مدة الاحتفاظ أدناه</p>
              </div>
              <Switch checked={form.autoCleanupEnabled} onChange={(v) => set("autoCleanupEnabled", v)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`الاحتفاظ بسجل التدقيق والتنبيهات (أيام)`}>
                <Input type="number" min={0} value={form.cleanupAuditDays} onChange={(e) => set("cleanupAuditDays", Math.max(0, parseInt(e.target.value) || 0))} />
              </Field>
              <Field label="حذف العمليات الملغاة بعد (شهر)">
                <Input type="number" min={0} value={form.cleanupCancelledMonths} onChange={(e) => set("cleanupCancelledMonths", Math.max(0, parseInt(e.target.value) || 0))} />
              </Field>
              <Field label="الاحتفاظ بعدد النسخ المحلية">
                <Input type="number" min={1} value={form.localBackupKeep} onChange={(e) => set("localBackupKeep", Math.max(1, parseInt(e.target.value) || 1))} />
              </Field>
              <Field label="الاحتفاظ بعدد نسخ Google Drive">
                <Input type="number" min={1} value={form.driveBackupKeep} onChange={(e) => set("driveBackupKeep", Math.max(1, parseInt(e.target.value) || 1))} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={async () => { await saveSettings(form); toast("success", "تم حفظ سياسة الاحتفاظ"); }}>
                <Save size={14} /> حفظ
              </Button>
              <Button size="sm" variant="outline" onClick={runCleanupNow} disabled={cleanupBusy}>
                <RefreshCw size={14} className={cleanupBusy ? "animate-spin" : ""} />
                {cleanupBusy ? "جارٍ التنظيف..." : "تشغيل التنظيف الآن"}
              </Button>
            </div>
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-6 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <b>مثال:</b> ١٨٠ يوماً لسجل التدقيق و١٢ شهراً للعمليات الملغاة تحافظ على خصوصيتك وتمنع تراكم البيانات دون التأثير على المستندات والعمليات النشطة. القيمة «٠» تعني عدم الحذف لهذا النوع.
            </p>
          </div>
        </Section>

        <Section icon={<HardDrive size={18} />} title="النسخ الاحتياطية المحلية اليدوية" desc="نسخة مشفرة داخل الجهاز تُنشأ عند الطلب وتُدار بسياسة احتفاظ">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <CheckCircle2 size={15} className="text-emerald-600" />
                {settings.lastAutoBackupAt ? `آخر نسخة: ${fmtDate(settings.lastAutoBackupAt, arabic, true)}` : "لم تُنشأ نسخة محلية بعد"}
              </div>
              <Button size="sm" variant="outline" onClick={createLocalBackup} disabled={backupBusy2}>
                {backupBusy2 ? <RefreshCw size={14} className="animate-spin" /> : <HardDrive size={14} />}
                إنشاء نسخة مشفرة
              </Button>
            </div>
            {localBackups.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                  <History size={12} /> النسخ المحلية المحفوظة ({toDigits(localBackups.length, arabic)}):
                </p>
                {localBackups.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{fmtDate(b.at, arabic, true)}</p>
                      <p className="text-[10px] text-slate-400">{toDigits(Math.round(b.size / 1024), arabic)} كيلوبايت</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => restoreLocalBackup(b)}><Download size={13} /> استعادة</Button>
                      <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-600" onClick={async () => { await localBackupService.remove(b.id); await refreshLocalBackups(); }}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section icon={<CloudUpload size={18} />} title="النسخ الاحتياطي إلى Google Drive" desc="ارفع واستعد نسخك مباشرة من حساب قوقل — يتطلب اتصالاً بالإنترنت فقط عند الرفع/الاستعادة">
          <div className="space-y-4">
            {isDriveConnected() ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={16} /> متصل بحساب قوقل
                </div>
                <Button variant="ghost" size="sm" onClick={() => { disconnectDrive(); setDriveFiles([]); toast("info", "تم قطع الاتصال بـ درايف"); }}>قطع الاتصال</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Google OAuth Client ID (اختياري — لمرة واحدة)">
                  <Input value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" dir="ltr" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!clientIdInput.trim() || driveBusy !== "idle"}
                    onClick={async () => {
                      setDriveBusy("connect");
                      try {
                        await saveSettings({ driveClientId: clientIdInput.trim() });
                        await connectDrive(clientIdInput.trim());
                        toast("success", "تم الاتصال بـ Google Drive");
                        await driveList();
                      } catch (err) {
                        toast("error", "تعذر الاتصال", err instanceof Error ? err.message : "تحقق من إعدادات OAuth");
                      } finally {
                        setDriveBusy("idle");
                      }
                    }}
                  >
                    <RefreshCw size={14} className={driveBusy === "connect" ? "animate-spin" : ""} />
                    {driveBusy === "connect" ? "جارٍ الاتصال..." : "الاتصال بـ Google Drive"}
                  </Button>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    إنشاء Client ID من Google Cloud
                  </a>
                </div>
                <p className="rounded-xl bg-slate-50 p-3 text-[11.5px] leading-6 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <b>طريقة الربط (مرة واحدة):</b> من Google Cloud Console أنشئ مشروعاً ← فعّل Drive API ← أنشئ OAuth Client ID من نوع «تطبيق ويب» وأضف رابط هذا الموقع في «Authorized JavaScript origins». بعدها أدخل المعرّف أعلاه.
                  <br />بدون ربط، يمكنك دائماً «تصدير نسخة» ثم رفعها يدوياً إلى drive.google.com.
                </p>
                {isDriveConnected() && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">الرفع التلقائي اليومي</p>
                      <p className="text-xs text-slate-400">نسخة سحابية كل ٢٤ ساعة مع إبقاء آخر {toDigits(form.driveBackupKeep || 20, arabic)} نسخ فقط</p>
                    </div>
                    <Switch checked={form.syncEnabled} onChange={(v) => set("syncEnabled", v)} />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!isDriveConnected() || driveBusy !== "idle"} onClick={driveUpload}>
                {driveBusy === "upload" ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                رفع نسخة الآن
              </Button>
              <Button variant="outline" size="sm" disabled={!isDriveConnected() || driveBusy !== "idle"} onClick={driveList}>
                {driveBusy === "list" ? <RefreshCw size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                عرض النسخ على درايف
              </Button>
            </div>

            {driveFiles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[12px] font-bold text-slate-600 dark:text-slate-300">النسخ المتاحة للاستعادة:</p>
                {driveFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200" dir="ltr">{f.name}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(f.modifiedTime, arabic)} · {fmtDate(f.modifiedTime, arabic, true)}</p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={driveBusy !== "idle"} onClick={() => driveRestore(f)}>
                      <Download size={13} /> استعادة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section icon={<Info size={18} />} title="حول سجل">
          <div className="space-y-3 text-[13px] leading-7 text-slate-500 dark:text-slate-400">
            <p><b className="text-slate-800 dark:text-slate-200">سجل</b> — منصة شخصية عربية متكاملة لإدارة الحسابات والمديونيات، كشوف الحساب الموحدة، المحاسبة الشخصية، والمستندات.</p>
            <p>الإصدار <Badge className="bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">١.٠.٠</Badge> · تطوير <b className="text-brand-700 dark:text-brand-300">Malek Logic</b></p>
            <p>التقنيات: React 19 · Vite · TypeScript · Tailwind CSS · Dexie IndexedDB · PWA</p>
            <p>يعمل دون اتصال بالإنترنت بالكامل، مع مزامنة سحابية اختيارية، وطباعة احترافية A4، وتحقق بالمستندات عبر رمز QR وصفحة مستقلة.</p>
            <p className="text-xs text-slate-400">
              آخر نسخة احتياطية تلقائية: {settings.lastAutoBackupAt ? fmtDate(settings.lastAutoBackupAt, arabic, true) : "لم تُنفَّذ بعد"}
            </p>
          </div>
        </Section>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="إعادة تهيئة التطبيق">
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          سيتم <b>حذف جميع البيانات نهائياً</b> وإعادة التطبيق إلى حالته الأولى بالبيانات التجريبية. يُنصح بتصدير نسخة احتياطية أولاً.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetOpen(false)}>إلغاء</Button>
          <Button variant="danger" onClick={async () => {
            await db.delete();
            await initDB();
            setResetOpen(false);
            toast("info", "تمت إعادة التهيئة", "تم إنشاء قاعدة بيانات جديدة");
          }}><Trash2 size={15} /> تأكيد المسح الكامل</Button>
        </div>
      </Modal>
    </div>
  );
}
