/* اختبارات ledgerService — دفتر الحسابات */
import { describe, it, expect, beforeEach } from "vitest";
import { db, ledgerService } from "@/lib/db";

beforeEach(async () => {
  await db.ledgerAccounts.clear();
  await db.ledgerEntries.clear();
  await db.auditLogs.clear();
  await db.settings.clear();
});

describe("ledgerService.accounts", () => {
  it("يُرجع قائمة فارغة عند عدم وجود حسابات", async () => {
    const accounts = await ledgerService.accounts();
    expect(accounts).toEqual([]);
  });

  it("يُرجع كل الحسابات", async () => {
    await ledgerService.createAccount({ name: "حساب 1", currency: "SAR", type: "receivable" });
    await ledgerService.createAccount({ name: "حساب 2", currency: "USD", type: "payable" });
    const accounts = await ledgerService.accounts();
    expect(accounts.length).toBe(2);
  });
});

describe("ledgerService.createAccount", () => {
  it("يُنشئ حسابًا جديدًا بنجاح", async () => {
    const acc = await ledgerService.createAccount({
      name: "أحمد محمد",
      currency: "SAR",
      type: "receivable",
      notes: "حساب تجريبي",
    });
    expect(acc.id).toMatch(/^lacc-/);
    expect(acc.name).toBe("أحمد محمد");
    expect(acc.currency).toBe("SAR");
    expect(acc.type).toBe("receivable");
    expect(acc.createdAt).toBeDefined();
  });

  it("يُسجل في سجل التدقيق", async () => {
    await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("إنشاء حساب دفتر");
  });
});

describe("ledgerService.removeAccount", () => {
  it("يحذف الحساب وعملياته", async () => {
    const acc = await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    await ledgerService.addEntry(acc.id, {
      date: "2026-01-01", entity: "تحويل", reference: "REF1",
      description: "عملية", credit: 1000, debit: 0,
    });
    await ledgerService.removeAccount(acc.id);
    const accounts = await db.ledgerAccounts.toArray();
    const entries = await db.ledgerEntries.toArray();
    expect(accounts.length).toBe(0);
    expect(entries.length).toBe(0);
  });
});

describe("ledgerService.addEntry", () => {
  it("يُضيف عملية بنجاح مع ترقيم تسلسلي", async () => {
    const acc = await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    const entry = await ledgerService.addEntry(acc.id, {
      date: "2026-01-01", entity: "تحويل", reference: "REF1",
      description: "عملية أولى", credit: 1000, debit: 0,
    });
    expect(entry.seq).toBe(1);
    expect(entry.credit).toBe(1000);
    expect(entry.debit).toBe(0);
  });

  it("يُرقم العمليات تسلسليًا", async () => {
    const acc = await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    await ledgerService.addEntry(acc.id, {
      date: "2026-01-01", entity: "تحويل", reference: "REF1",
      description: "أولى", credit: 1000, debit: 0,
    });
    const entry2 = await ledgerService.addEntry(acc.id, {
      date: "2026-01-02", entity: "تحويل", reference: "REF2",
      description: "ثانية", credit: 500, debit: 0,
    });
    expect(entry2.seq).toBe(2);
  });
});

describe("ledgerService.addDualEntry", () => {
  it("يُرحل قيدًا محاسبيًا مزدوجًا بحركتين", async () => {
    const acc = await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    await ledgerService.addDualEntry(
      acc.id,
      { date: "2026-01-01", entity: "إقرار", reference: "لا يوجد", description: "قيد مزدوج" },
      { description: "الحركة الأولى", credit: 0, debit: 500 },
      { description: "الحركة الثانية", credit: 1000, debit: 0 },
    );
    const entries = await db.ledgerEntries.where("accountId").equals(acc.id).toArray();
    expect(entries.length).toBe(2);
    expect(entries[0].groupId).toBeDefined();
    expect(entries[0].groupId).toBe(entries[1].groupId);
    expect(entries[0].seq).not.toBe(entries[1].seq);
  });
});

describe("ledgerService.entriesOf", () => {
  it("يُرجع العمليات مرتبة بالترتيب التسلسلي", async () => {
    const acc = await ledgerService.createAccount({ name: "حساب", currency: "SAR", type: "receivable" });
    await ledgerService.addEntry(acc.id, {
      date: "2026-01-03", entity: "تحويل", reference: "REF3",
      description: "ثالثة", credit: 300, debit: 0,
    });
    await ledgerService.addEntry(acc.id, {
      date: "2026-01-01", entity: "تحويل", reference: "REF1",
      description: "أولى", credit: 100, debit: 0,
    });
    await ledgerService.addEntry(acc.id, {
      date: "2026-01-02", entity: "تحويل", reference: "REF2",
      description: "ثانية", credit: 200, debit: 0,
    });
    const entries = await ledgerService.entriesOf(acc.id);
    expect(entries.length).toBe(3);
    expect(entries[0].seq).toBe(1);
    expect(entries[1].seq).toBe(2);
    expect(entries[2].seq).toBe(3);
  });
});
