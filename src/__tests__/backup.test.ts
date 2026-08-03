/* اختبارات backupService — التصدير والاستيراد (C-01) */
import { describe, it, expect, beforeEach } from "vitest";
import { db, backupService } from "@/lib/db";

beforeEach(async () => {
  /* مسح كل الجداول قبل كل اختبار */
  await db.parties.clear();
  await db.debts.clear();
  await db.payments.clear();
  await db.accounts.clear();
  await db.journalEntries.clear();
  await db.templates.clear();
  await db.documents.clear();
  await db.auditLogs.clear();
  await db.notifications.clear();
  await db.settings.clear();
  await db.ledgerAccounts.clear();
  await db.ledgerEntries.clear();
});

describe("backupService.exportAll", () => {
  it("يُصدّر كل الجداول بما فيها ledgerAccounts و ledgerEntries", async () => {
    await db.ledgerAccounts.add({
      id: "lacc-1", name: "حساب تجريبي", currency: "SAR", type: "receivable", createdAt: new Date().toISOString(),
    });
    await db.ledgerEntries.add({
      id: "lent-1", accountId: "lacc-1", seq: 1, date: "2026-01-01",
      entity: "تحويل", reference: "REF1", description: "عملية تجريبية",
      credit: 1000, debit: 0, createdAt: new Date().toISOString(),
    });
    await db.parties.add({
      id: "p1", name: "طرف تجريبي", type: "individual", createdAt: new Date().toISOString(),
    });

    const exported = await backupService.exportAll();

    expect(exported.version).toBe(3);
    expect(exported.ledgerAccounts).toBeDefined();
    expect(exported.ledgerEntries).toBeDefined();
    expect((exported.ledgerAccounts as unknown[]).length).toBe(1);
    expect((exported.ledgerEntries as unknown[]).length).toBe(1);
    expect((exported.parties as unknown[]).length).toBe(1);
  });
});

describe("backupService.importAll", () => {
  it("يستورد ledgerAccounts و ledgerEntries من نسخة جديدة (v2)", async () => {
    const data = {
      version: 2,
      parties: [],
      debts: [],
      payments: [],
      accounts: [],
      journalEntries: [],
      templates: [],
      documents: [],
      auditLogs: [],
      notifications: [],
      settings: [],
      ledgerAccounts: [
        { id: "lacc-1", name: "حساب مُستورد", currency: "SAR", type: "receivable", createdAt: new Date().toISOString() },
      ],
      ledgerEntries: [
        {
          id: "lent-1", accountId: "lacc-1", seq: 1, date: "2026-01-01",
          entity: "تحويل", reference: "REF1", description: "عملية مُستوردة",
          credit: 500, debit: 0, createdAt: new Date().toISOString(),
        },
      ],
    };

    await backupService.importAll(data, true);

    const accounts = await db.ledgerAccounts.toArray();
    const entries = await db.ledgerEntries.toArray();
    expect(accounts.length).toBe(1);
    expect(accounts[0].name).toBe("حساب مُستورد");
    expect(entries.length).toBe(1);
    expect(entries[0].credit).toBe(500);
  });

  it("لا يمسح ledgerAccounts عند استعادة نسخة قديمة (v1) بدونها", async () => {
    /* إضافة بيانات دفتر حالية */
    await db.ledgerAccounts.add({
      id: "lacc-existing", name: "بيانات حالية", currency: "SAR", type: "receivable", createdAt: new Date().toISOString(),
    });

    /* نسخة قديمة بدون ledgerAccounts */
    const oldBackup = {
      version: 1,
      parties: [{ id: "p-old", name: "طرف قديم", type: "individual", createdAt: new Date().toISOString() }],
      debts: [],
      payments: [],
      accounts: [],
      journalEntries: [],
      templates: [],
      documents: [],
      auditLogs: [],
      notifications: [],
      settings: [],
    };

    await backupService.importAll(oldBackup, true);

    /* بيانات الدفتر يجب أن تبقى */
    const accounts = await db.ledgerAccounts.toArray();
    expect(accounts.length).toBe(1);
    expect(accounts[0].name).toBe("بيانات حالية");

    /* لكن الأطراف يجب أن تُستبدل */
    const parties = await db.parties.toArray();
    expect(parties.length).toBe(1);
    expect(parties[0].name).toBe("طرف قديم");
  });

  it("يستبدل ledgerAccounts عند replace مع نسخة v2", async () => {
    await db.ledgerAccounts.add({
      id: "lacc-old", name: "قديم", currency: "SAR", type: "receivable", createdAt: new Date().toISOString(),
    });

    const newBackup = {
      version: 2,
      parties: [], debts: [], payments: [], accounts: [], journalEntries: [],
      templates: [], documents: [], auditLogs: [], notifications: [], settings: [],
      ledgerAccounts: [
        { id: "lacc-new", name: "جديد", currency: "USD", type: "payable", createdAt: new Date().toISOString() },
      ],
      ledgerEntries: [],
    };

    await backupService.importAll(newBackup, true);

    const accounts = await db.ledgerAccounts.toArray();
    expect(accounts.length).toBe(1);
    expect(accounts[0].name).toBe("جديد");
    expect(accounts[0].currency).toBe("USD");
  });

  it("الدمج (replace=false) يُضيف بدون مسح", async () => {
    await db.ledgerAccounts.add({
      id: "lacc-1", name: "أول", currency: "SAR", type: "receivable", createdAt: new Date().toISOString(),
    });

    const data = {
      ledgerAccounts: [
        { id: "lacc-2", name: "ثاني", currency: "USD", type: "payable", createdAt: new Date().toISOString() },
      ],
      ledgerEntries: [],
    };

    await backupService.importAll(data, false);

    const accounts = await db.ledgerAccounts.toArray();
    expect(accounts.length).toBe(2);
  });
});
