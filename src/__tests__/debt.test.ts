/* اختبارات منطق الأعمال */
import { describe, it, expect } from "vitest";
import { computeDebtStatus } from "@/lib/db";
import type { Debt } from "@/lib/types";

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "test",
    number: "DEBT-0001",
    type: "receivable",
    partyId: "p1",
    amount: 1000,
    currency: "SAR",
    date: "2026-01-01",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeDebtStatus", () => {
  it("مفتوحة عند عدم وجود مدفوعات", () => {
    expect(computeDebtStatus(makeDebt(), 0)).toBe("active");
  });

  it("مسددة جزئيًا عند دفع جزء", () => {
    expect(computeDebtStatus(makeDebt(), 500)).toBe("partial");
  });

  it("مسددة بالكامل عند دفع المبلغ كاملاً", () => {
    expect(computeDebtStatus(makeDebt(), 1000)).toBe("settled");
  });

  it("مسددة بالكامل عند دفع أكثر من المبلغ", () => {
    expect(computeDebtStatus(makeDebt(), 1200)).toBe("settled");
  });

  it("ملغية تبقى ملغية بغض النظر عن المدفوعات", () => {
    expect(computeDebtStatus(makeDebt({ status: "cancelled" }), 0)).toBe("cancelled");
    expect(computeDebtStatus(makeDebt({ status: "cancelled" }), 500)).toBe("cancelled");
  });

  it("تسامح 0.01 عند حساب المتبقي", () => {
    /* دفع 999.99 من 1000 → المتبقي 0.01 → مسددة (ضمن التسامح) */
    expect(computeDebtStatus(makeDebt({ amount: 1000 }), 999.99)).toBe("settled");
  });

  it("دفع 999.90 من 1000 → مسددة جزئيًا (خارج التسامح)", () => {
    expect(computeDebtStatus(makeDebt({ amount: 1000 }), 999.90)).toBe("partial");
  });
});
