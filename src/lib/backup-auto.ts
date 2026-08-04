/* ====== النسخ الاحتياطي التلقائي معطل في نموذج الحسابات الخاصة ======
 * اختار المنتج النسخ والاستعادة اليدوية فقط. تُنفذ النسخة المشفرة من
 * SettingsPage بعد موافقة المستخدم، ولا تُرفع أي بيانات بصمت عند التشغيل.
 */
import type { AppSettings } from "./types";

export async function runAutoBackups(_settings?: AppSettings): Promise<{ local: boolean; drive: boolean; prunedDrive: number }> {
  return { local: false, drive: false, prunedDrive: 0 };
}

export function isAutoBackupDue(_settings: AppSettings): boolean {
  return false;
}
