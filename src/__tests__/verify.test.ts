/* اختبارات التحقق الرقمي + الحذف التلقائي + النسخ المحلية (C-02) */
import { describe, it, expect, beforeEach } from "vitest";
import { db, backupService, cleanupService, documentsService, localBackupService, validateBackup } from "@/lib/db";
import { buildDocVerifyFields, computeDocDigest, docVerifyCanonical, sha256Hex } from "@/lib/utils";

beforeEach(async () => {
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
  await db.backups.clear();
});

describe("بصمة المستند الرقمية (SHA-256)", () => {
  const doc = {
    number: "DOC-0001",
    type: "acknowledgment",
    title: "إقرار دين — اختبار",
    date: "2026-02-17",
    amount: 68469.43,
    currency: "SAR",
  };

  it("تُنتج بصمة ثابتة (deterministic) لنفس البيانات", async () => {
    const f1 = buildDocVerifyFields(doc, "مالك أحمد", 2);
    const f2 = buildDocVerifyFields(doc, "مالك أحمد", 2);
    const d1 = await computeDocDigest(f1);
    const d2 = await computeDocDigest(f2);
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[0-9a-f]{16}$/);
  });

  it("تتغير البصمة عند تغيير أي حقل (كشف تعديل)", async () => {
    const base = await computeDocDigest(buildDocVerifyFields(doc, "مالك أحمد", 1));
    const tampered = await computeDocDigest(buildDocVerifyFields({ ...doc, amount: 999 }, "مالك أحمد", 1));
    expect(tampered).not.toBe(base);
  });

  it("النص القانوني يُبنى بنفس ترتيب الحقول دائماً", () => {
    const f = buildDocVerifyFields(doc, "جهة", 0);
    expect(docVerifyCanonical(f)).toBe(`sajil-verify|2|DOC-0001|acknowledgment|إقرار دين — اختبار|2026-02-17|68469.43|SAR|جهة|0`);
  });

  it("sha256Hex يطابق SHA-256 القياسي (interop مع verify.html)", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Hex("sajil-verify|2|DOC-0001|ack|عنوان عربي|2026-01-01|100.00|SAR|جهة|1"))
      .toHaveLength(64);
  });
});

describe("validateBackup", () => {
  it("يقبل نسخة سليمة", () => {
    expect(validateBackup({ version: 3, parties: [], debts: [] }).ok).toBe(true);
  });
  it("يرفض ملفات غير معروفة", () => {
    const r = validateBackup({ foo: "bar" });
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
  it("يرفض الجداول غير المصفوفات", () => {
    expect(validateBackup({ version: 3, parties: "nope" }).ok).toBe(false);
  });
});

describe("النسخ الاحتياطية المحلية التلقائية", () => {
  it("تُنشئ نسخة وتُطبق سياسة الاحتفاظ", async () => {
    await localBackupService.create();
    await localBackupService.create();
    await localBackupService.create();
    await localBackupService.applyRetention(2);
    const list = await localBackupService.list();
    expect(list.length).toBe(2);
  });

  it("تستعيد البيانات من نسخة محلية (مع استبدال)", async () => {
    await db.parties.add({ id: "p1", name: "قبل", type: "individual", createdAt: new Date().toISOString() });
    const backup = await localBackupService.create();
    await db.parties.clear();
    await db.parties.add({ id: "p2", name: "بعد", type: "individual", createdAt: new Date().toISOString() });
    await localBackupService.restore(backup.id);
    const parties = await db.parties.toArray();
    expect(parties.map((p) => p.name).sort()).toEqual(["قبل"]);
  });
});

describe("الحذف التلقائي للبيانات (cleanupService)", () => {
  const oldIso = new Date(Date.now() - 200 * 86400000).toISOString();
  const nowIso = new Date().toISOString();

  it("يحذف سجل التدقيق والتنبيهات الأقدم من المدة", async () => {
    await db.auditLogs.add({ id: "log-old", at: oldIso, actor: "x", action: "قديم", entity: "debt" });
    await db.auditLogs.add({ id: "log-new", at: nowIso, actor: "x", action: "جديد", entity: "debt" });
    await db.notifications.add({ id: "ntf-old", at: oldIso, type: "system", title: "قديم", message: "", read: false });
    const r = await cleanupService.pruneLogs(new Date(Date.now() - 180 * 86400000).toISOString());
    expect(r.logs).toBe(1);
    expect(r.notifications).toBe(1);
    expect(await db.auditLogs.get("log-new")).toBeDefined();
    expect(await db.auditLogs.get("log-old")).toBeUndefined();
  });

  it("يحذف العمليات الملغاة القديمة ودفعاتها فقط", async () => {
    const oldCancelled = { id: "d1", number: "DEBT-0001", type: "receivable" as const, partyId: "p", amount: 100, currency: "SAR" as const, date: "2024-01-01", status: "cancelled" as const, createdAt: oldIso, updatedAt: oldIso };
    const newCancelled = { ...oldCancelled, id: "d2", createdAt: nowIso, updatedAt: nowIso };
    const active = { ...oldCancelled, id: "d3", status: "active" as const, createdAt: nowIso, updatedAt: nowIso };
    await db.debts.bulkPut([oldCancelled, newCancelled, active]);
    await db.payments.add({ id: "pay1", debtId: "d1", date: "2024-01-02", amount: 50, currency: "SAR", method: "cash", createdAt: nowIso });

    const n = await cleanupService.pruneCancelledDebts(new Date(Date.now() - 180 * 86400000).toISOString());
    expect(n).toBe(1);
    expect(await db.debts.get("d1")).toBeUndefined();
    expect(await db.debts.get("d2")).toBeDefined();
    expect(await db.debts.get("d3")).toBeDefined();
    const pays = await db.payments.toArray();
    expect(pays.length).toBe(0);
  });

  it("run() يعود null عندما يكون التنظيف معطلاً", async () => {
    const r = await cleanupService.run({ autoCleanupEnabled: false, cleanupAuditDays: 180, cleanupCancelledMonths: 12, localBackupKeep: 6 });
    expect(r).toBeNull();
  });

  it("run() ينفذ كل الأنواع ويوثق في سجل التدقيق", async () => {
    await db.auditLogs.add({ id: "log-old", at: oldIso, actor: "x", action: "قديم", entity: "debt" });
    await localBackupService.create();
    await localBackupService.create();
    await localBackupService.create();
    const r = await cleanupService.run({ autoCleanupEnabled: true, cleanupAuditDays: 180, cleanupCancelledMonths: 12, localBackupKeep: 2 });
    expect(r).not.toBeNull();
    expect(r!.logs).toBe(1);
    expect(r!.backups).toBe(1);
    const logs = await db.auditLogs.toArray();
    expect(logs.some((l) => l.action === "تنظيف تلقائي للبيانات")).toBe(true);
  });
});

describe("الاستيراد يستبدل العدادات والإعدادات (إصلاح النسخ الاحتياطي)", () => {
  it("لا تبقى عدادات قديمة بعد الاستعادة", async () => {
    await db.settings.bulkPut([
      { key: "counter:DOC", value: 99 },
      { key: "counter:DEBT", value: 99 },
    ]);
    const backup = await backupService.exportAll();
    await db.settings.put({ key: "counter:DOC", value: 5 });
    await backupService.importAll(backup, true);
    const row = await db.settings.get("counter:DOC");
    expect(row?.value).toBe(99);
  });

  it("الجداول الفارغة في النسخة تستبدل القديمة", async () => {
    await db.templates.add({ id: "tpl-old", name: "قديم", type: "custom", content: "x", isDefault: false, isBuiltin: false, createdAt: new Date().toISOString() });
    const data = {
      version: 3,
      parties: [], debts: [], payments: [], accounts: [], journalEntries: [],
      templates: [], documents: [], auditLogs: [], notifications: [], settings: [], ledgerAccounts: [], ledgerEntries: [],
    };
    await backupService.importAll(data, true);
    expect(await db.templates.count()).toBe(0);
  });
});

/* ====== إصلاحات الفحص الشامل ====== */
import { amountToWordsAr, addDays, addMonths, hijriDate } from "@/lib/utils";

describe("صياغة المبالغ (إصلاح التنوين)", () => {
  it("مضاعفات المئة بلا تنوين: مائة ألف", () => {
    expect(amountToWordsAr(100000, "ريال")).toContain("مائة ألف ريال");
    expect(amountToWordsAr(100000, "ريال")).not.toContain("ألفًا");
  });
  it("مائتا ألف وثلاثمائة ألف", () => {
    expect(amountToWordsAr(200000, "ريال")).toContain("مائتا ألف");
    expect(amountToWordsAr(300000, "ريال")).toContain("ثلاثمائة ألف");
  });
  it("الأعداد المركبة تحتفظ بالتنوين الصحيح: أحد عشر ألفًا", () => {
    expect(amountToWordsAr(11000, "ريال")).toContain("أحد عشر ألفًا");
  });
  it("الآلاف الثلاثة: ثلاثة آلاف", () => {
    expect(amountToWordsAr(3000, "ريال")).toContain("ثلاثة آلاف");
  });
  it("المثنى في التركيب الإضافي بلا نون: ألفا ريال ومليونا ريال", () => {
    expect(amountToWordsAr(2000, "ريال")).toContain("ألفا ريال");
    expect(amountToWordsAr(2000000, "ريال")).toContain("مليونا ريال");
    expect(amountToWordsAr(2000, "ريال")).not.toContain("ألفان");
  });
  it("مبلغ مركب: 68469.43", () => {
    const s = amountToWordsAr(68469.43, "ريال سعودي");
    expect(s).toContain("ريال سعودي");
    expect(s).toContain("هللة");
  });
});

describe("أدوات التاريخ المحلي (إصلاح UTC)", () => {
  it("addDays يحافظ على التاريخ المحلي عبر الشهور", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("addMonths يحافظ على التاريخ المحلي", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("نسخ المستند لا ينقل التواقيع البيومترية (إصلاح)", () => {
  it("النسخة الجديدة بدون تواقيع — التوثيق مرتبط بمستندها الأصلي", async () => {
    const doc = await documentsService.save({
      type: "acknowledgment" as const,
      title: "أصلي", templateId: "tpl-ack", amount: 100, currency: "SAR" as const,
      date: "2026-01-01", body: "نص", parties: [], status: "final" as const,
    });
    await documentsService.sign(doc.id, {
      role: "الطرف الثاني", name: "أحمد", method: "biometric",
      at: new Date().toISOString(), credentialId: "cred1", signature: "sig",
    });
    const copy = await documentsService.duplicate(doc.id);
    expect(copy!.signatures?.length || 0).toBe(0);
    const orig = await documentsService.get(doc.id);
    expect(orig!.signatures?.length).toBe(1);
  });
});

describe("رفع العدادات بعد الاستعادة (إصلاح تكرار الأرقام)", () => {
  it("عدادات أقل من الأرقام الموجودة تُرفع تلقائياً", async () => {
    await db.documents.add({
      id: "doc-x", number: "DOC-0042", type: "acknowledgment", title: "س",
      templateId: "t", currency: "SAR", date: "2026-01-01", body: "ب",
      parties: [], status: "final", history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    /* نسخة قديمة تحتوي وثيقة رقمها 42 لكن عدادها منخفض (5) */
    const data = {
      version: 3, parties: [], debts: [], payments: [], accounts: [], journalEntries: [],
      templates: [], documents: [{
        id: "doc-x", number: "DOC-0042", type: "acknowledgment", title: "س",
        templateId: "t", currency: "SAR", date: "2026-01-01", body: "ب",
        parties: [], status: "final", history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }], auditLogs: [], notifications: [],
      settings: [{ key: "counter:DOC", value: 5 }], ledgerAccounts: [], ledgerEntries: [],
    };
    await backupService.importAll(data, true);
    const row = await db.settings.get("counter:DOC");
    expect(row?.value).toBe(42);
  });
});

describe("التاريخ الهجري (إصلاح التفسير المحلي)", () => {
  it("يعيد تاريخاً هجرياً صحيحاً لتاريخ ميلادي", () => {
    const h = hijriDate("2026-08-03");
    expect(h).not.toBe("");
    expect(h).toMatch(/[0-9٠-٩]/);
    expect(h).toContain("هـ");
  });
});
