/* اختبارات settingsService + auditService */
import { describe, it, expect, beforeEach } from "vitest";
import { db, settingsService, auditService } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/types";

beforeEach(async () => {
  await db.settings.clear();
  await db.auditLogs.clear();
  await db.notifications.clear();
});

describe("settingsService", () => {
  it("يُرجع الإعدادات الافتراضية عند عدم وجود إعدادات محفوظة", async () => {
    const settings = await settingsService.get();
    expect(settings.baseCurrency).toBe(DEFAULT_SETTINGS.baseCurrency);
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.arabicDigits).toBe(DEFAULT_SETTINGS.arabicDigits);
  });

  it("يحفظ الإعدادات ويسترجعها", async () => {
    await settingsService.save({ baseCurrency: "USD", theme: "dark" });
    const settings = await settingsService.get();
    expect(settings.baseCurrency).toBe("USD");
    expect(settings.theme).toBe("dark");
    /* الحقول الأخرى تبقى بالافتراضي */
    expect(settings.arabicDigits).toBe(DEFAULT_SETTINGS.arabicDigits);
  });

  it("يُحدّث الحقول المحددة فقط (merge)", async () => {
    await settingsService.save({ baseCurrency: "EUR" });
    await settingsService.save({ theme: "dark" });
    const settings = await settingsService.get();
    expect(settings.baseCurrency).toBe("EUR"); /* لم يُفقد */
    expect(settings.theme).toBe("dark");
  });
});

describe("auditService.log", () => {
  it("يُسجل حدثًا في سجل التدقيق", async () => {
    await auditService.log("إنشاء ذمة", "debt", "debt-123", "مبلغ 5000");
    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("إنشاء ذمة");
    expect(logs[0].entity).toBe("debt");
    expect(logs[0].entityId).toBe("debt-123");
    expect(logs[0].details).toBe("مبلغ 5000");
    expect(logs[0].actor).toBe("المستخدم الرئيسي");
    expect(logs[0].at).toBeDefined();
  });

  it("يُسجل عدة أحداث بالترتيب", async () => {
    await auditService.log("حدث 1", "test");
    await auditService.log("حدث 2", "test");
    await auditService.log("حدث 3", "test");
    const logs = await db.auditLogs.toArray();
    expect(logs.length).toBe(3);
  });
});

describe("auditService.notify", () => {
  it("يُنشئ تنبيهًا", async () => {
    await auditService.notify("reminder", "تذكير", "موعد استحقاق غدًا");
    const notifications = await db.notifications.toArray();
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("reminder");
    expect(notifications[0].title).toBe("تذكير");
    expect(notifications[0].message).toBe("موعد استحقاق غدًا");
    expect(notifications[0].read).toBe(false);
  });
});
