/* ===== قاعدة البيانات المحلية (IndexedDB عبر Dexie) + طبقة الخدمات ===== */
import Dexie, { type Table } from "dexie";
import type {
  Account, AppNotification, AppSettings, AuditLog, Debt, DocSignature, DocTemplate, JournalEntry,
  LedgerAccount, LedgerEntry, LegalDoc, LocalBackup, Party, Payment,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { toBase, uid } from "./utils";
import { seedIfEmpty } from "./seed";

export class SajilDB extends Dexie {
  parties!: Table<Party, string>;
  debts!: Table<Debt, string>;
  payments!: Table<Payment, string>;
  accounts!: Table<Account, string>;
  journalEntries!: Table<JournalEntry, string>;
  templates!: Table<DocTemplate, string>;
  documents!: Table<LegalDoc, string>;
  auditLogs!: Table<AuditLog, string>;
  notifications!: Table<AppNotification, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  ledgerAccounts!: Table<LedgerAccount, string>;
  ledgerEntries!: Table<LedgerEntry, string>;
  /** النسخ الاحتياطية المحلية التلقائية (داخل الجهاز — IndexedDB) */
  backups!: Table<LocalBackup, string>;

  constructor() {
    super("sajil-db");
    /* رقم إصدار Dexie مُوحّد مع schemaVersion في initDB (حاليًا 5) */
    this.version(5).stores({
      parties: "id, name, type, phone",
      debts: "id, number, type, partyId, status, currency, date, createdAt",
      payments: "id, debtId, date, method, currency",
      accounts: "id, code, name, type, parentId",
      journalEntries: "id, number, date, currency",
      templates: "id, type, isDefault",
      documents: "id, number, type, templateId, status, createdAt",
      auditLogs: "id, at, entity, action, entityId",
      notifications: "id, at, read, type, title",
      settings: "key",
      ledgerAccounts: "id, name, currency, type",
      ledgerEntries: "id, accountId, date, seq",
      backups: "id, at",
    });
  }
}

export const db = new SajilDB();

export async function initDB(): Promise<void> {
  const row = await db.settings.get("schemaVersion");
  const currentVersion = (row?.value as number) || 0;

  /*
   * نظام الترقيات التدريجية (Migrations):
   * ─────────────────────────────────────────
   * كل إصدار جديد يُضيف migration محدد بدلاً من المسح الشامل.
   * الإصدار 0→4: ترقية تاريخية — مسح شامل (لمن كانوا على إصدارات أقدم من 4).
   * الإصدارات 5+: migration محدد أدناه بدون مسح.
   */

  if (currentVersion < 4) {
    /* ترقية من إصدار أقدم من 4: مسح شامل وإعادة تهيئة */
    const tables = [
      db.parties, db.debts, db.payments, db.accounts, db.journalEntries,
      db.templates, db.documents, db.auditLogs, db.notifications, db.settings,
      db.ledgerAccounts, db.ledgerEntries,
    ];
    await Promise.all(tables.map((t) => t.clear()));
    await db.settings.put({ key: "schemaVersion", value: 4 });
  }

  if (currentVersion < 5) {
    /* إضافة جدول النسخ الاحتياطية المحلية (backups) — بدون مسح أي بيانات */
    await db.settings.put({ key: "schemaVersion", value: 5 });
  }

  if (currentVersion < 6) {
    /* تحديث محتوى القوالب المدمجة (isBuiltin) إلى أحدث صياغة محسّنة —
       المستخدمون القدامى لا يحصلون على القوالب الجديدة إلا بترحيل كهذا.
       القوالب المخصصة (غير المدمجة) تبقى كما أنشأها المستخدم. */
    const { DEFAULT_TEMPLATES } = await import("./seed");
    for (const def of DEFAULT_TEMPLATES) {
      const t = await db.templates.get(def.id);
      if (t?.isBuiltin) {
        await db.templates.update(def.id, { content: def.content, name: def.name });
      }
    }
    await db.settings.put({ key: "schemaVersion", value: 6 });
  }

  await seedIfEmpty();
}

/* ====== الإعدادات ====== */
export const settingsService = {
  async get(): Promise<AppSettings> {
    const row = await db.settings.get("app");
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) || {}) };
  },
  async save(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get();
    const next = { ...current, ...patch };
    await db.settings.put({ key: "app", value: next });
    return next;
  },
};

/* ====== سجل التدقيق ====== */
export const auditService = {
  async log(action: string, entity: string, entityId?: string, details?: string): Promise<void> {
    await db.auditLogs.add({ id: uid("log"), at: new Date().toISOString(), actor: "المستخدم الرئيسي", action, entity, entityId, details });
  },
  async notify(type: AppNotification["type"], title: string, message: string): Promise<void> {
    await db.notifications.add({ id: uid("ntf"), at: new Date().toISOString(), type, title, message, read: false });
  },
};

/* ====== الأرقام التسلسلية ====== */
async function nextNumber(prefix: string, width = 4): Promise<string> {
  const key = `counter:${prefix}`;
  const row = await db.settings.get(key);
  const current = ((row?.value as number) || 0) + 1;
  await db.settings.put({ key, value: current });
  return `${prefix}-${String(current).padStart(width, "0")}`;
}

/* ====== Pagination عام ====== */
export interface PagedResult<T> { items: T[]; total: number; page: number; pageSize: number; totalPages: number }

export async function listPaged<T>(
  query: () => Promise<T[]>,
  page: number,
  pageSize: number,
): Promise<PagedResult<T>> {
  const all = await query();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}

/* ====== خدمة العمليات المالية (الديون) ====== */
export function computeDebtStatus(debt: Debt, totalPaid: number): Debt["status"] {
  if (debt.status === "cancelled") return "cancelled";
  const remaining = debt.amount - totalPaid;
  if (remaining <= 0.01) return "settled";
  return totalPaid > 0 ? "partial" : "active";
}

export const debtsService = {
  async list(): Promise<Debt[]> {
    return db.debts.orderBy("createdAt").reverse().toArray();
  },
  async get(id: string): Promise<Debt | undefined> {
    return db.debts.get(id);
  },
  async paymentsOf(debtId: string): Promise<Payment[]> {
    return db.payments.where("debtId").equals(debtId).sortBy("date");
  },
  async totalPaid(debtId: string): Promise<number> {
    const pays = await db.payments.where("debtId").equals(debtId).toArray();
    return pays.reduce((s, p) => s + p.amount, 0);
  },
  async create(input: Omit<Debt, "id" | "number" | "status" | "createdAt" | "updatedAt">): Promise<Debt> {
    const debt: Debt = {
      ...input,
      id: uid("debt"),
      number: await nextNumber("DEBT"),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.debts.add(debt);
    await auditService.log("تسجيل عملية مالية", "debt", debt.id, `رقم ${debt.number} — ${debt.amount}`);
    await journalService.postDebtCreation(debt);
    return debt;
  },
  async update(id: string, patch: Partial<Debt>): Promise<void> {
    await db.debts.update(id, { ...patch, updatedAt: new Date().toISOString() });
    await auditService.log("تحديث عملية", "debt", id);
  },
  async addPayment(debtId: string, input: Omit<Payment, "id" | "debtId" | "createdAt">): Promise<Payment> {
    const debt = await db.debts.get(debtId);
    if (!debt) throw new Error("العملية غير موجودة");
    if (!(input.amount > 0)) throw new Error("مبلغ الدفعة يجب أن يكون أكبر من صفر");

    const alreadyPaid = await this.totalPaid(debtId);
    const remainingBefore = Math.round((debt.amount - alreadyPaid) * 100) / 100;
    if (input.amount - remainingBefore > 0.01) {
      throw new Error(`المبلغ يتجاوز المتبقي (${remainingBefore.toFixed(2)})`);
    }

    const payment: Payment = { ...input, id: uid("pay"), debtId, createdAt: new Date().toISOString() };
    await db.payments.add(payment);

    /* المجموع بعد الإضافة (totalPaid يشمل الدفعة الجديدة — دون جمعها مرتين) */
    const total = await this.totalPaid(debtId);
    const status = computeDebtStatus(debt, total);
    await db.debts.update(debtId, { status, updatedAt: new Date().toISOString() });
    await auditService.log("تسجيل دفعة", "payment", payment.id, `مبلغ ${input.amount} على العملية ${debt.number}`);
    await journalService.postPayment(payment, debt, status);
    return payment;
  },
  async settle(debtId: string, date: string): Promise<void> {
    const debt = await db.debts.get(debtId);
    if (!debt) return;
    const total = await this.totalPaid(debtId);
    const remaining = Math.round((debt.amount - total) * 100) / 100;
    if (remaining > 0.01) {
      await this.addPayment(debtId, { date, amount: remaining, currency: debt.currency, method: "cash", notes: "تسوية نهائية" });
    } else {
      await db.debts.update(debtId, { status: "settled", updatedAt: new Date().toISOString() });
    }
    await auditService.log("تسوية نهائية", "debt", debtId, debt.number);
  },
  async cancel(debtId: string): Promise<void> {
    await db.debts.update(debtId, { status: "cancelled", updatedAt: new Date().toISOString() });
    await auditService.log("إلغاء عملية", "debt", debtId);
  },
  async remove(debtId: string): Promise<void> {
    await db.payments.where("debtId").equals(debtId).delete();
    await db.debts.delete(debtId);
    await auditService.log("حذف عملية", "debt", debtId);
  },
};

/* ====== خدمة المحاسبة ====== */
export interface AccountBalance { account: Account; opening: number; debit: number; credit: number; balance: number; }

export const journalService = {
  async postDebtCreation(debt: Debt): Promise<void> {
    const debtorAcc = await db.accounts.where("code").equals("1300").first();
    const revenueAcc = await db.accounts.where("code").equals("4100").first();
    const expenseAcc = await db.accounts.where("code").equals("5300").first();
    const payableAcc = await db.accounts.where("code").equals("2100").first();
    if (!debtorAcc || !revenueAcc || !payableAcc || !expenseAcc) return;
    const entry: JournalEntry = {
      id: uid("je"),
      number: await nextNumber("JE"),
      date: debt.date,
      description: `إنشاء ذمة ${debt.number} — ${debt.reason || ""}`,
      currency: debt.currency,
      lines: debt.type === "receivable"
        ? [{ accountId: debtorAcc.id, debit: debt.amount, credit: 0 }, { accountId: revenueAcc.id, debit: 0, credit: debt.amount }]
        : [{ accountId: expenseAcc.id, debit: debt.amount, credit: 0 }, { accountId: payableAcc.id, debit: 0, credit: debt.amount }],
      createdAt: new Date().toISOString(),
    };
    await db.journalEntries.add(entry);
  },
  async postPayment(payment: Payment, debt: Debt, finalStatus: Debt["status"]): Promise<void> {
    const cashAcc = await db.accounts.where("code").equals("1100").first();
    const bankAcc = await db.accounts.where("code").equals("1200").first();
    const debtorAcc = await db.accounts.where("code").equals("1300").first();
    const payableAcc = await db.accounts.where("code").equals("2100").first();
    if (!cashAcc || !bankAcc || !debtorAcc || !payableAcc) return;
    const cashSide = payment.method === "cash" ? cashAcc : bankAcc;
    const entry: JournalEntry = {
      id: uid("je"),
      number: await nextNumber("JE"),
      date: payment.date,
      description: `دفعة ${payment.amount} على الذمة ${debt.number}${finalStatus === "settled" ? " (تسوية نهائية)" : ""}`,
      currency: payment.currency,
      lines: debt.type === "receivable"
        ? [{ accountId: cashSide.id, debit: payment.amount, credit: 0 }, { accountId: debtorAcc.id, debit: 0, credit: payment.amount }]
        : [{ accountId: payableAcc.id, debit: payment.amount, credit: 0 }, { accountId: cashSide.id, debit: 0, credit: payment.amount }],
      createdAt: new Date().toISOString(),
    };
    await db.journalEntries.add(entry);
  },
  async add(input: Omit<JournalEntry, "id" | "number" | "createdAt">): Promise<JournalEntry> {
    const totalD = input.lines.reduce((s, l) => s + l.debit, 0);
    const totalC = input.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalD - totalC) > 0.01) throw new Error("القيد غير متوازن: مجموع المدين لا يساوي مجموع الدائن");
    const entry: JournalEntry = { ...input, id: uid("je"), number: await nextNumber("JE"), createdAt: new Date().toISOString() };
    await db.journalEntries.add(entry);
    await auditService.log("ترحيل قيد", "journal", entry.id, `رقم ${entry.number}`);
    return entry;
  },
  async remove(id: string): Promise<void> {
    await db.journalEntries.delete(id);
    await auditService.log("حذف قيد", "journal", id);
  },
};

export const accountingService = {
  /**
   * أرصدة الحسابات موحّدة بالعملة الأساسية عبر أسعار الصرف،
   * مع إمكانية الاحتساب حتى تاريخ محدد (asOf) للتقارير اللحظية.
   */
  async balances(rates: Record<string, number>, base: string, asOf?: string): Promise<AccountBalance[]> {
    const [accounts, entries] = await Promise.all([db.accounts.toArray(), db.journalEntries.toArray()]);
    const map = new Map<string, AccountBalance>();
    for (const acc of accounts) {
      const cur = acc.currency || base;
      map.set(acc.id, {
        account: acc,
        opening: toBase(acc.openingBalance, cur, rates, base),
        debit: 0, credit: 0, balance: 0,
      });
    }
    for (const entry of entries) {
      if (asOf && entry.date > asOf) continue;
      for (const line of entry.lines) {
        const row = map.get(line.accountId);
        if (!row) continue;
        row.debit += toBase(line.debit, entry.currency, rates, base);
        row.credit += toBase(line.credit, entry.currency, rates, base);
      }
    }
    for (const row of map.values()) {
      const { account } = row;
      const normal = account.type === "asset" || account.type === "expense" ? 1 : -1;
      row.balance = Math.round((row.opening + (row.debit - row.credit) * normal) * 100) / 100;
      row.debit = Math.round(row.debit * 100) / 100;
      row.credit = Math.round(row.credit * 100) / 100;
      row.opening = Math.round(row.opening * 100) / 100;
    }
    return [...map.values()].sort((a, b) => a.account.code.localeCompare(b.account.code));
  },
  async inRange(from: string, to: string): Promise<JournalEntry[]> {
    return db.journalEntries.where("date").between(from, to, true, true).sortBy("date");
  },
};

/* ====== خدمة المستندات ====== */
export const documentsService = {
  async list(): Promise<LegalDoc[]> {
    return db.documents.orderBy("createdAt").reverse().toArray();
  },
  async get(id: string): Promise<LegalDoc | undefined> {
    return db.documents.get(id);
  },
  async byNumber(number: string): Promise<LegalDoc | undefined> {
    return db.documents.where("number").equals(number).first();
  },
  async save(input: Omit<LegalDoc, "id" | "number" | "createdAt" | "updatedAt" | "history">, existingId?: string): Promise<LegalDoc> {
    const now = new Date().toISOString();
    if (existingId) {
      const existing = await db.documents.get(existingId);
      await db.documents.update(existingId, { ...input, updatedAt: now, history: [...(existing?.history || []), { at: now, action: "تعديل" }] });
      const updated = await db.documents.get(existingId);
      await auditService.log("تعديل مستند", "document", existingId);
      return updated!;
    }
    const doc: LegalDoc = {
      ...input,
      id: uid("doc"),
      number: await nextNumber("DOC"),
      history: [{ at: now, action: "إنشاء" }],
      createdAt: now,
      updatedAt: now,
    };
    await db.documents.add(doc);
    await auditService.log("إنشاء مستند", "document", doc.id, doc.number);
    return doc;
  },
  async finalize(id: string): Promise<void> {
    await db.documents.update(id, { status: "final", updatedAt: new Date().toISOString() });
    await auditService.log("اعتماد مستند", "document", id);
  },
  /** إلحاق توقيع (بيومتري عبر حساس البصمة أو يدوي) بالمستند */
  async sign(id: string, signature: Omit<DocSignature, "id">): Promise<LegalDoc | undefined> {
    const doc = await db.documents.get(id);
    if (!doc) return undefined;
    const sig: DocSignature = { ...signature, id: uid("sig") };
    const signatures = [...(doc.signatures || []), sig];
    await db.documents.update(id, { signatures, updatedAt: new Date().toISOString(), history: [...(doc.history || []), { at: new Date().toISOString(), action: `توثيق توقيع: ${signature.role} (${signature.method === "biometric" ? "بصمة" : "يدوي"})` }] });
    await auditService.log("توثيق توقيع على مستند", "document", id, `${signature.role} — ${signature.method}`);
    return db.documents.get(id);
  },
  /** إزالة توقيع مُلحق بمستند */
  async unsign(id: string, signatureId: string): Promise<void> {
    const doc = await db.documents.get(id);
    if (!doc) return;
    await db.documents.update(id, { signatures: (doc.signatures || []).filter((s) => s.id !== signatureId), updatedAt: new Date().toISOString() });
    await auditService.log("إزالة توقيع من مستند", "document", id);
  },
  async remove(id: string): Promise<void> {
    await db.documents.delete(id);
    await auditService.log("حذف مستند", "document", id);
  },
  async duplicate(id: string): Promise<LegalDoc | undefined> {
    const src = await db.documents.get(id);
    if (!src) return undefined;
    const { id: _i, number: _n, createdAt: _c, updatedAt: _u, history: _h, ...rest } = src;
    const now = new Date().toISOString();
    /* النسخة الجديدة تُنشأ بدون التواقيع البيومترية — إثباتات التوثيق مرتبطة
       رقمياً بمستندها الأصلي (تحدي بصمة المستند)، فلا تُنقل للنسخ. */
    const doc: LegalDoc = { ...rest, signatures: [], id: uid("doc"), number: await nextNumber("DOC"), history: [{ at: now, action: "نسخة من " + src.number }], createdAt: now, updatedAt: now };
    await db.documents.add(doc);
    return doc;
  },
};

/* ====== النسخ الاحتياطي ====== */
export const BACKUP_VERSION = 3;

const BACKUP_TABLES = ["parties", "debts", "payments", "accounts", "journalEntries", "templates", "documents", "auditLogs", "notifications", "settings", "ledgerAccounts", "ledgerEntries"];

/** التحقق من سلامة بنية النسخة الاحتياطية قبل الاستيراد */
export function validateBackup(data: Record<string, unknown>): { ok: boolean; error?: string } {
  if (!data || typeof data !== "object") return { ok: false, error: "الملف لا يحتوي على بيانات صالحة" };
  const t = data as Record<string, unknown>;
  if (t.version === undefined && !BACKUP_TABLES.some((k) => Array.isArray(t[k]))) {
    return { ok: false, error: "ملف غير معروف — ليس نسخة احتياطية من سجل" };
  }
  for (const key of BACKUP_TABLES) {
    if (t[key] !== undefined && !Array.isArray(t[key])) {
      return { ok: false, error: `بنية النسخة غير سليمة (الجدول ${key})` };
    }
  }
  return { ok: true };
}

export const backupService = {
  async exportAll(): Promise<Record<string, unknown>> {
    const [parties, debts, payments, accounts, journalEntries, templates, documents, auditLogs, notifications, settings, ledgerAccounts, ledgerEntries] = await Promise.all([
      db.parties.toArray(), db.debts.toArray(), db.payments.toArray(), db.accounts.toArray(),
      db.journalEntries.toArray(), db.templates.toArray(), db.documents.toArray(), db.auditLogs.toArray(),
      db.notifications.toArray(), db.settings.toArray(), db.ledgerAccounts.toArray(), db.ledgerEntries.toArray(),
    ]);
    return { version: BACKUP_VERSION, parties, debts, payments, accounts, journalEntries, templates, documents, auditLogs, notifications, settings, ledgerAccounts, ledgerEntries };
  },
  async importAll(data: Record<string, unknown>, replace = false): Promise<void> {
    const check = validateBackup(data);
    if (!check.ok) throw new Error(check.error || "نسخة احتياطية غير صالحة");
    const t = data as Record<string, unknown[]>;
    await db.transaction("rw", [db.parties, db.debts, db.payments, db.accounts, db.journalEntries, db.templates, db.documents, db.auditLogs, db.notifications, db.settings, db.ledgerAccounts, db.ledgerEntries], async () => {
      if (replace) {
        const clears: Promise<unknown>[] = [
          db.parties.clear(), db.debts.clear(), db.payments.clear(), db.accounts.clear(),
          db.journalEntries.clear(), db.templates.clear(), db.documents.clear(), db.auditLogs.clear(), db.notifications.clear(),
        ];
        /* امسح جداول الدفتر فقط إن كانت النسخة الاحتياطية تحتويها —
           لتجنب فقدان بيانات الدفتر عند استعادة نسخة قديمة (قبل v2) لا تتضمنها. */
        if (t.ledgerAccounts !== undefined) clears.push(db.ledgerAccounts.clear());
        if (t.ledgerEntries !== undefined) clears.push(db.ledgerEntries.clear());
        /* ⚠️ إصلاح: مسح جدول الإعدادات بالكامل قبل الاستعادة — وإلا بقيت العدادات
           (counter:DOC…) القديمة من قاعدة البيانات الحالية فتُستخدم أرقام مكررة. */
        clears.push(db.settings.clear());
        await Promise.all(clears);
      }
      /* إصلاح: الشرط `!== undefined` بدل `&& length` — لضمان استبدال الجداول
         الفارغة في النسخة المحفوظة بدلاً من الإبقاء على بيانات قديمة. */
      if (t.parties !== undefined) await db.parties.bulkPut(t.parties as Party[]);
      if (t.debts !== undefined) await db.debts.bulkPut(t.debts as Debt[]);
      if (t.payments !== undefined) await db.payments.bulkPut(t.payments as Payment[]);
      if (t.accounts !== undefined) await db.accounts.bulkPut(t.accounts as Account[]);
      if (t.journalEntries !== undefined) await db.journalEntries.bulkPut(t.journalEntries as JournalEntry[]);
      if (t.templates !== undefined) await db.templates.bulkPut(t.templates as DocTemplate[]);
      if (t.documents !== undefined) await db.documents.bulkPut(t.documents as LegalDoc[]);
      if (t.auditLogs !== undefined) await db.auditLogs.bulkPut(t.auditLogs as AuditLog[]);
      if (t.notifications !== undefined) await db.notifications.bulkPut(t.notifications as AppNotification[]);
      if (t.settings !== undefined) await db.settings.bulkPut(t.settings as { key: string; value: unknown }[]);
      if (t.ledgerAccounts !== undefined) await db.ledgerAccounts.bulkPut(t.ledgerAccounts as LedgerAccount[]);
      if (t.ledgerEntries !== undefined) await db.ledgerEntries.bulkPut(t.ledgerEntries as LedgerEntry[]);
      /* حماية العدادات: إن كانت النسخة قديمة (بلا عدادات أو بعدادات أقل من
         الأرقام الموجودة فعلاً) تُرفع العدادات إلى أقصى رقم — يمنع تكرار
         أرقام المستندات/العمليات/القيود بعد الاستعادة. */
      await bumpCounters();
      /* حماية من إعادة البذر: الاستعادة تعني وجود بيانات فعلية — لا حاجة
         لإعادة البيانات التجريبية عند التشغيل التالي حتى لو كانت النسخة
         قديمة جداً بلا علامة seeded. */
      await db.settings.put({ key: "seeded", value: true });
    });
    await auditService.log("استعادة نسخة احتياطية", "backup", undefined, `replace=${replace}`);
  },
};

/** رفع العدادات إلى أقصى رقم موجود فعلاً في الجداول (إن كانت أقل) */
async function bumpCounters(): Promise<void> {
  const parseMax = (rows: { number: string }[], prefix: string): number => {
    let max = 0;
    for (const r of rows) {
      const m = r.number.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max;
  };
  const [docs, debts, entries] = await Promise.all([db.documents.toArray(), db.debts.toArray(), db.journalEntries.toArray()]);
  const targets: [string, number][] = [
    ["DOC", parseMax(docs, "DOC")],
    ["DEBT", parseMax(debts, "DEBT")],
    ["JE", parseMax(entries, "JE")],
  ];
  for (const [prefix, max] of targets) {
    if (max <= 0) continue;
    const key = `counter:${prefix}`;
    const row = await db.settings.get(key);
    const current = (row?.value as number) || 0;
    if (current < max) await db.settings.put({ key, value: max });
  }
}

/* ====== النسخ الاحتياطية المحلية التلقائية (داخل الجهاز) ======
 * تُنشأ عند تشغيل التطبيق وتُحفظ في IndexedDB مع احتفاظ محدود (الأقدم يُحذف تلقائياً).
 * تشكل شبكة أمان فورية حتى دون ربط Google Drive.
 */
export const localBackupService = {
  async list(): Promise<LocalBackup[]> {
    return db.backups.orderBy("at").reverse().toArray();
  },
  async create(): Promise<LocalBackup> {
    const data = await backupService.exportAll();
    const json = JSON.stringify({ app: "sajil", exportedAt: new Date().toISOString(), data });
    const backup: LocalBackup = {
      id: uid("bak"),
      at: new Date().toISOString(),
      size: new Blob([json]).size,
      data,
    };
    await db.backups.add(backup);
    await auditService.log("نسخة احتياطية محلية تلقائية", "backup", backup.id);
    return backup;
  },
  async restore(id: string): Promise<void> {
    const backup = await db.backups.get(id);
    if (!backup) throw new Error("النسخة غير موجودة");
    await backupService.importAll(backup.data, true);
  },
  async remove(id: string): Promise<void> {
    await db.backups.delete(id);
  },
  /** تطبيق سياسة الاحتفاظ: حذف النسخ الأقدم من العدد المسموح */
  async applyRetention(keep: number): Promise<number> {
    const all = await db.backups.orderBy("at").reverse().toArray();
    const excess = all.slice(keep);
    if (excess.length === 0) return 0;
    await db.backups.bulkDelete(excess.map((b) => b.id));
    return excess.length;
  },
};

/* ====== الحذف التلقائي للبيانات (سياسة الاحتفاظ) ======
 * يُنفَّذ عند تشغيل التطبيق (وبيد المستخدم من الإعدادات):
 *   • سجل التدقيق والتنبيهات الأقدم من المدة المحددة.
 *   • العمليات الملغاة (ودفعاتها) الأقدم من المدة المحددة.
 *   • النسخ الاحتياطية المحلية الأقدم من العدد المسموح.
 * كل عملية موثقة في سجل التدقيق قبل حذف السجل القديم نفسه.
 */
export const cleanupService = {
  /** حذف سجلات التدقيق والتنبيهات الأقدم من cutoff */
  async pruneLogs(cutoffIso: string): Promise<{ logs: number; notifications: number }> {
    const logs = await db.auditLogs.where("at").below(cutoffIso).delete();
    const notifications = await db.notifications.where("at").below(cutoffIso).delete();
    return { logs, notifications };
  },
  /** حذف العمليات الملغاة ودفعاتها الأقدم من cutoff */
  async pruneCancelledDebts(cutoffIso: string): Promise<number> {
    const cancelled = await db.debts.where("status").equals("cancelled").toArray();
    const old = cancelled.filter((d) => d.createdAt < cutoffIso);
    for (const d of old) {
      await db.payments.where("debtId").equals(d.id).delete();
      await db.debts.delete(d.id);
    }
    return old.length;
  },
  /** تشغيل التنظيف الكامل وفق الإعدادات — يُرجع ملخص ما حُذف */
  async run(settings: Pick<AppSettings, "autoCleanupEnabled" | "cleanupAuditDays" | "cleanupCancelledMonths" | "localBackupKeep">): Promise<{ logs: number; notifications: number; debts: number; backups: number } | null> {
    if (!settings.autoCleanupEnabled) return null;
    const now = Date.now();
    const result = { logs: 0, notifications: 0, debts: 0, backups: 0 };

    if (settings.cleanupAuditDays > 0) {
      const cutoff = new Date(now - settings.cleanupAuditDays * 86400000).toISOString();
      const r = await this.pruneLogs(cutoff);
      result.logs = r.logs;
      result.notifications = r.notifications;
    }
    if (settings.cleanupCancelledMonths > 0) {
      const cutoff = new Date(now - settings.cleanupCancelledMonths * 30 * 86400000).toISOString();
      result.debts = await this.pruneCancelledDebts(cutoff);
    }
    if (settings.localBackupKeep > 0) {
      result.backups = await localBackupService.applyRetention(settings.localBackupKeep);
    }

    const total = result.logs + result.notifications + result.debts + result.backups;
    if (total > 0) {
      await auditService.log("تنظيف تلقائي للبيانات", "cleanup", undefined,
        `سجل تدقيق: ${result.logs} · تنبيهات: ${result.notifications} · عمليات ملغاة: ${result.debts} · نسخ محلية: ${result.backups}`);
    }
    return result;
  },
};

/* ====== التذكيرات ====== */
export async function ensureReminders(): Promise<void> {
  /* التنبيهات التلقائية للاستحقاقات أُزيلت مع تحويل الذمم إلى منطق عمليات محاسبية */
}

/* ====== خدمة دفتر الحسابات (كشف الحساب الموحد) ====== */
export const ledgerService = {
  async accounts(): Promise<LedgerAccount[]> {
    return db.ledgerAccounts.toArray();
  },
  async getAccount(id: string): Promise<LedgerAccount | undefined> {
    return db.ledgerAccounts.get(id);
  },
  async createAccount(input: Omit<LedgerAccount, "id" | "createdAt">): Promise<LedgerAccount> {
    const acc: LedgerAccount = { ...input, id: uid("lacc"), createdAt: new Date().toISOString() };
    await db.ledgerAccounts.add(acc);
    await auditService.log("إنشاء حساب دفتر", "ledger", acc.id, acc.name);
    return acc;
  },
  async removeAccount(id: string): Promise<void> {
    await db.ledgerEntries.where("accountId").equals(id).delete();
    await db.ledgerAccounts.delete(id);
    await auditService.log("حذف حساب دفتر", "ledger", id);
  },
  async entriesOf(accountId: string): Promise<LedgerEntry[]> {
    return db.ledgerEntries.where("accountId").equals(accountId).sortBy("seq");
  },
  async nextSeq(accountId: string): Promise<number> {
    const all = await this.entriesOf(accountId);
    return all.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  },
  async addEntry(accountId: string, input: Omit<LedgerEntry, "id" | "accountId" | "seq" | "createdAt">): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      ...input,
      id: uid("lent"),
      accountId,
      seq: await this.nextSeq(accountId),
      createdAt: new Date().toISOString(),
    };
    await db.ledgerEntries.add(entry);
    await auditService.log("إضافة عملية للدفتر", "ledger", entry.id, entry.description);
    return entry;
  },
  async addDualEntry(
    accountId: string,
    base: { date: string; entity: string; reference: string; description: string },
    first: { description: string; credit: number; debit: number },
    second: { description: string; credit: number; debit: number }
  ): Promise<void> {
    const groupId = uid("grp");
    const seq = await this.nextSeq(accountId);
    const now = new Date().toISOString();
    const rows: LedgerEntry[] = [
      { ...base, id: uid("lent"), accountId, seq, description: first.description, credit: first.credit, debit: first.debit, groupId, groupLabel: base.description, createdAt: now },
      { ...base, id: uid("lent"), accountId, seq: seq + 1, description: second.description, credit: second.credit, debit: second.debit, groupId, createdAt: now },
    ];
    await db.ledgerEntries.bulkAdd(rows);
    await auditService.log("ترحيل قيد محاسبي مزدوج بالدفتر", "ledger", accountId, base.description);
  },
  async updateEntry(id: string, patch: Partial<LedgerEntry>): Promise<void> {
    await db.ledgerEntries.update(id, { ...patch, updatedAt: new Date().toISOString() });
    await auditService.log("تعديل عملية دفتر", "ledger", id);
  },
  async removeEntry(id: string): Promise<void> {
    await db.ledgerEntries.delete(id);
    await auditService.log("حذف عملية دفتر", "ledger", id);
  },
};
