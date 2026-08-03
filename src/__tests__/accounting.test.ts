/* اختبارات accountingService + journalService — المحاسبة */
import { describe, it, expect, beforeEach } from "vitest";
import { db, journalService, accountingService } from "@/lib/db";

beforeEach(async () => {
  await db.accounts.clear();
  await db.journalEntries.clear();
  await db.auditLogs.clear();
  await db.settings.clear();
  /* إنشاء حسابات أساسية */
  await db.accounts.bulkPut([
    { id: "acc-cash", code: "1100", name: "النقدية", type: "asset", openingBalance: 0, isActive: true },
    { id: "acc-bank", code: "1200", name: "البنك", type: "asset", openingBalance: 0, isActive: true },
    { id: "acc-debtors", code: "1300", name: "الذمم المدينة", type: "asset", openingBalance: 0, isActive: true },
    { id: "acc-payables", code: "2100", name: "الذمم الدائنة", type: "liability", openingBalance: 0, isActive: true },
    { id: "acc-revenue", code: "4100", name: "إيرادات النشاط", type: "income", openingBalance: 0, isActive: true },
    { id: "acc-expense", code: "5300", name: "مصاريف عمومية", type: "expense", openingBalance: 0, isActive: true },
  ]);
});

describe("journalService.add", () => {
  it("يُرحل قيدًا متوازنًا بنجاح", async () => {
    const entry = await journalService.add({
      date: "2026-01-01",
      description: "قيد تجريبي",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 1000, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 1000 },
      ],
    });
    expect(entry.id).toMatch(/^je-/);
    expect(entry.number).toMatch(/^JE-\d{4}$/);
    expect(entry.lines.length).toBe(2);
  });

  it("يرفض قيدًا غير متوازن", async () => {
    await expect(
      journalService.add({
        date: "2026-01-01",
        description: "قيد غير متوازن",
        currency: "SAR",
        lines: [
          { accountId: "acc-cash", debit: 1000, credit: 0 },
          { accountId: "acc-revenue", debit: 0, credit: 500 },
        ],
      }),
    ).rejects.toThrow("غير متوازن");
  });

  it("يقبل قيدًا بفارق أقل من 0.01 (تسامح التقريب)", async () => {
    const entry = await journalService.add({
      date: "2026-01-01",
      description: "قيد بفارق تقريبي",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 100.005, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 100.01 },
      ],
    });
    expect(entry).toBeDefined();
  });

  it("يُسجل في سجل التدقيق", async () => {
    await journalService.add({
      date: "2026-01-01",
      description: "قيد",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 100, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 100 },
      ],
    });
    const logs = await db.auditLogs.toArray();
    expect(logs.some((l) => l.action === "ترحيل قيد")).toBe(true);
  });
});

describe("journalService.remove", () => {
  it("يحذف القيد", async () => {
    const entry = await journalService.add({
      date: "2026-01-01",
      description: "قيد",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 100, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 100 },
      ],
    });
    await journalService.remove(entry.id);
    const found = await db.journalEntries.get(entry.id);
    expect(found).toBeUndefined();
  });
});

describe("accountingService.balances", () => {
  it("يحسب أرصدة الحسابات بشكل صحيح", async () => {
    await journalService.add({
      date: "2026-01-01",
      description: "إيداع نقدي",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 5000, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 5000 },
      ],
    });
    const rates = { SAR: 1, YER: 0.00235, USD: 3.75, EUR: 4.1 };
    const balances = await accountingService.balances(rates, "SAR");
    const cash = balances.find((b) => b.account.code === "1100");
    expect(cash).toBeDefined();
    expect(cash!.debit).toBe(5000);
    expect(cash!.balance).toBe(5000); /* asset: debit - credit */
  });

  it("يحترم asOf — يتجاهل القيود بعد التاريخ", async () => {
    await journalService.add({
      date: "2026-01-01",
      description: "قيد قديم",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 1000, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 1000 },
      ],
    });
    await journalService.add({
      date: "2026-02-01",
      description: "قيد جديد",
      currency: "SAR",
      lines: [
        { accountId: "acc-cash", debit: 2000, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 2000 },
      ],
    });
    const rates = { SAR: 1, YER: 0.00235, USD: 3.75, EUR: 4.1 };
    const balances = await accountingService.balances(rates, "SAR", "2026-01-15");
    const cash = balances.find((b) => b.account.code === "1100");
    expect(cash!.debit).toBe(1000); /* القيد الثاني مُتجاهل */
  });

  it("يُوحّد العملات عبر أسعار الصرف", async () => {
    await journalService.add({
      date: "2026-01-01",
      description: "إيداع دولار",
      currency: "USD",
      lines: [
        { accountId: "acc-cash", debit: 100, credit: 0 },
        { accountId: "acc-revenue", debit: 0, credit: 100 },
      ],
    });
    const rates = { SAR: 1, YER: 0.00235, USD: 3.75, EUR: 4.1 };
    const balances = await accountingService.balances(rates, "SAR");
    const cash = balances.find((b) => b.account.code === "1100");
    expect(cash!.debit).toBe(375); /* 100 USD × 3.75 = 375 SAR */
  });
});
