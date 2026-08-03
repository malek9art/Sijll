/* ====== النسخ الاحتياطي التلقائي ======
 * عند تشغيل التطبيق:
 *   1. نسخة محلية تلقائية في IndexedDB (دون اتصال) — مع احتفاظ محدود.
 *   2. إن كان Google Drive مربوطاً والمزامنة مفعّلة — رفع نسخة يومية
 *      (مرة كل ٢٤ ساعة كحد أقصى) مع تطبيق سياسة الاحتفاظ (حذف الأقدم).
 *   3. تسجيل وقت آخر نسخة ناجحة في الإعدادات (lastAutoBackupAt).
 */
import { backupService, localBackupService, settingsService } from "./db";
import { deleteDriveBackup, isDriveConnected, listDriveBackups, uploadBackupToDrive } from "./drive";
import { todayISO } from "./utils";
import type { AppSettings } from "./types";

const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 ساعة

export async function runAutoBackups(settings?: AppSettings): Promise<{ local: boolean; drive: boolean; prunedDrive: number }> {
  const s = settings || (await settingsService.get());
  const result = { local: false, drive: false, prunedDrive: 0 };

  /* 1) النسخة المحلية التلقائية (شبكة أمان فورية — تعمل دائماً ودون إنترنت) */
  if (s.localBackupEnabled) {
    try {
      await localBackupService.create();
      await localBackupService.applyRetention(s.localBackupKeep);
      result.local = true;
    } catch {
      /* فشل النسخة المحلية لا يمنع محاولة الدرايف */
    }
  }

  /* 2) النسخة السحابية اليومية على Google Drive */
  const due = !s.lastAutoBackupAt || Date.now() - new Date(s.lastAutoBackupAt).getTime() >= AUTO_BACKUP_INTERVAL_MS;
  if (s.driveClientId && s.syncEnabled && due) {
    try {
      if (!isDriveConnected()) {
        /* إعادة الاتصال بصمت عبر المعرّف المخزّن — قد يطلب نافذة قوقل */
        const { connectDrive } = await import("./drive");
        await connectDrive(s.driveClientId);
      }
      const data = await backupService.exportAll();
      const blob = new Blob([JSON.stringify({ app: "sajil", exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
      await uploadBackupToDrive(blob, `sajil-backup-${todayISO()}.json`);
      result.drive = true;

      /* 3) سياسة الاحتفاظ: إبقاء آخر N نسخة على درايف فقط */
      try {
        const files = await listDriveBackups();
        const keep = Math.max(1, s.driveBackupKeep || 20);
        for (const f of files.slice(keep)) {
          await deleteDriveBackup(f.id);
          result.prunedDrive++;
        }
      } catch {
        /* التنظيف فشل — غير حرج */
      }
    } catch {
      /* فشل الرفع للدرايف — لا يُسجَّل كآخر نسخة ناجحة */
    }
  }

  if (result.local || result.drive) {
    try {
      await settingsService.save({ lastAutoBackupAt: new Date().toISOString() });
    } catch { /* غير حرج */ }
  }
  return result;
}

/** فحص استحقاق النسخة اليومية (للعرض في الواجهة) */
export function isAutoBackupDue(settings: AppSettings): boolean {
  if (!settings.driveClientId || !settings.syncEnabled) return false;
  return !settings.lastAutoBackupAt || Date.now() - new Date(settings.lastAutoBackupAt).getTime() >= AUTO_BACKUP_INTERVAL_MS;
}
