/* اختبار أساس العزل: كل مستخدم يستخدم اسم قاعدة IndexedDB مستقلاً. */
import { afterEach, describe, expect, it } from "vitest";
import { SajilDB } from "@/lib/db";

const names = ["sijll-test-user-a", "sijll-test-user-b"];

afterEach(async () => {
  for (const name of names) {
    const database = new SajilDB(name);
    await database.delete();
  }
});

describe("per-user IndexedDB isolation", () => {
  it("لا يرى مستخدم بيانات قاعدة مستخدم آخر", async () => {
    const a = new SajilDB(names[0]);
    const b = new SajilDB(names[1]);

    await a.parties.add({ id: "p-a", name: "طرف المستخدم أ", type: "individual", createdAt: new Date().toISOString() });

    expect(await a.parties.count()).toBe(1);
    expect(await b.parties.count()).toBe(0);

    a.close();
    b.close();
  });
});
