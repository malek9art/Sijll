/* اختبارات documentsService — المستندات القانونية */
import { describe, it, expect, beforeEach } from "vitest";
import { db, documentsService } from "@/lib/db";

beforeEach(async () => {
  await db.documents.clear();
  await db.templates.clear();
  await db.auditLogs.clear();
  await db.settings.clear();
});

const sampleInput = {
  type: "acknowledgment" as const,
  title: "إقرار دين تجريبي",
  templateId: "tpl-ack",
  amount: 5000,
  currency: "SAR" as const,
  date: "2026-01-15",
  body: "أقر أنا {{party_name}} بمبلغ {{amount}}",
  parties: [{ role: "الطرف الثاني", name: "أحمد محمد" }],
  status: "final" as const,
};

describe("documentsService.save", () => {
  it("يُنشئ مستندًا جديدًا برقم تسلسلي", async () => {
    const doc = await documentsService.save(sampleInput);
    expect(doc.id).toMatch(/^doc-/);
    expect(doc.number).toMatch(/^DOC-\d{4}$/);
    expect(doc.title).toBe("إقرار دين تجريبي");
    expect(doc.amount).toBe(5000);
    expect(doc.history.length).toBe(1);
    expect(doc.history[0].action).toBe("إنشاء");
  });

  it("يُحدّث مستندًا موجودًا ويضيف سجل تعديل", async () => {
    const doc = await documentsService.save(sampleInput);
    const updated = await documentsService.save(
      { ...sampleInput, title: "عنوان محدّث" },
      doc.id,
    );
    expect(updated.id).toBe(doc.id);
    expect(updated.title).toBe("عنوان محدّث");
    expect(updated.history.length).toBe(2);
    expect(updated.history[1].action).toBe("تعديل");
  });

  it("يُسجل في سجل التدقيق عند الإنشاء", async () => {
    await documentsService.save(sampleInput);
    const logs = await db.auditLogs.toArray();
    expect(logs.some((l) => l.action === "إنشاء مستند")).toBe(true);
  });
});

describe("documentsService.list", () => {
  it("يُرجع المستندات مرتبة بالأحدث أولاً", async () => {
    await documentsService.save({ ...sampleInput, title: "أول" });
    await new Promise((r) => setTimeout(r, 10));
    await documentsService.save({ ...sampleInput, title: "ثاني" });
    const docs = await documentsService.list();
    expect(docs.length).toBe(2);
    expect(docs[0].title).toBe("ثاني");
  });
});

describe("documentsService.byNumber", () => {
  it("يجد مستندًا بالرقم", async () => {
    const doc = await documentsService.save(sampleInput);
    const found = await documentsService.byNumber(doc.number);
    expect(found).toBeDefined();
    expect(found!.id).toBe(doc.id);
  });

  it("يُرجع undefined عند عدم الوجود", async () => {
    const found = await documentsService.byNumber("DOC-9999");
    expect(found).toBeUndefined();
  });
});

describe("documentsService.finalize", () => {
  it("يُعتمد المستند", async () => {
    const doc = await documentsService.save({ ...sampleInput, status: "draft" });
    await documentsService.finalize(doc.id);
    const updated = await db.documents.get(doc.id);
    expect(updated!.status).toBe("final");
  });
});

describe("documentsService.remove", () => {
  it("يحذف المستند", async () => {
    const doc = await documentsService.save(sampleInput);
    await documentsService.remove(doc.id);
    const found = await db.documents.get(doc.id);
    expect(found).toBeUndefined();
  });
});

describe("documentsService.duplicate", () => {
  it("يُنشئ نسخة برقم جديد", async () => {
    const doc = await documentsService.save(sampleInput);
    const copy = await documentsService.duplicate(doc.id);
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe(doc.id);
    expect(copy!.number).not.toBe(doc.number);
    expect(copy!.title).toBe(doc.title);
    expect(copy!.history[0].action).toContain("نسخة من");
  });
});
