/* ====== ترحيل قاعدة الإصدار القديم المشتركة إلى حساب المستخدم ====== */
import type { AppSettings } from "./types";
import { backupService, LEGACY_DB_NAME, db, SajilDB } from "./db";

export interface LegacySummary {
  parties: number;
  debts: number;
  payments: number;
  documents: number;
  ledgerAccounts: number;
  ledgerEntries: number;
  journalEntries: number;
  accounts: number;
  displayName: string;
}

async function exists(name: string): Promise<boolean> {
  try {
    if (typeof indexedDB.databases !== "function") return false;
    const databases = await indexedDB.databases();
    return databases.some((item) => item.name === name);
  } catch {
    return false;
  }
}

async function openLegacy(): Promise<SajilDB | null> {
  if (!(await exists(LEGACY_DB_NAME))) return null;
  const legacy = new SajilDB(LEGACY_DB_NAME);
  try {
    await legacy.open();
    return legacy;
  } catch {
    legacy.close();
    return null;
  }
}

function portableSettings(rows: { key: string; value: unknown }[]): { key: string; value: unknown }[] {
  return rows.map((row) => {
    if (row.key !== "app" || !row.value || typeof row.value !== "object") return row;
    const { pin: _pin, bioCredentialId: _bioCredentialId, ...portable } = row.value as Partial<AppSettings>;
    return { key: row.key, value: portable };
  });
}

export async function getLegacySummary(): Promise<LegacySummary | null> {
  const legacy = await openLegacy();
  if (!legacy) return null;
  try {
    const [parties, debts, payments, documents, ledgerAccounts, ledgerEntries, journalEntries, accounts, app] = await Promise.all([
      legacy.parties.count(), legacy.debts.count(), legacy.payments.count(), legacy.documents.count(),
      legacy.ledgerAccounts.count(), legacy.ledgerEntries.count(), legacy.journalEntries.count(), legacy.accounts.count(),
      legacy.settings.get("app"),
    ]);
    const hasBusinessData = parties + debts + payments + documents + ledgerAccounts + ledgerEntries + journalEntries > 0;
    if (!hasBusinessData) return null;
    const value = app?.value as Partial<AppSettings> | undefined;
    return {
      parties, debts, payments, documents, ledgerAccounts, ledgerEntries, journalEntries, accounts,
      displayName: value?.orgName || "بيانات محلية قديمة",
    };
  } finally {
    legacy.close();
  }
}

export async function exportLegacyData(): Promise<Record<string, unknown> | null> {
  const legacy = await openLegacy();
  if (!legacy) return null;
  try {
    const [parties, debts, payments, accounts, journalEntries, templates, documents, auditLogs, notifications, settings, ledgerAccounts, ledgerEntries] = await Promise.all([
      legacy.parties.toArray(), legacy.debts.toArray(), legacy.payments.toArray(), legacy.accounts.toArray(),
      legacy.journalEntries.toArray(), legacy.templates.toArray(), legacy.documents.toArray(), legacy.auditLogs.toArray(),
      legacy.notifications.toArray(), legacy.settings.toArray(), legacy.ledgerAccounts.toArray(), legacy.ledgerEntries.toArray(),
    ]);
    return {
      version: 3, parties, debts, payments, accounts, journalEntries, templates, documents,
      auditLogs, notifications, settings: portableSettings(settings), ledgerAccounts, ledgerEntries,
    };
  } finally {
    legacy.close();
  }
}

export async function migrateLegacyData(): Promise<LegacySummary | null> {
  const summary = await getLegacySummary();
  if (!summary) return null;
  const data = await exportLegacyData();
  if (!data) throw new Error("تعذر قراءة قاعدة البيانات القديمة");
  await backupService.importAll(data, true);
  await discardLegacyData();
  return summary;
}

export async function discardLegacyData(): Promise<void> {
  const legacy = new SajilDB(LEGACY_DB_NAME);
  await legacy.delete();
  /* تأكد من أن قاعدة المستخدم الحالية بقيت مفتوحة بعد حذف القديمة. */
  if (!db.isOpen()) await db.open();
}
