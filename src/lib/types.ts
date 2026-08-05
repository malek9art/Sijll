/* ===== نماذج بيانات سجل ===== */

export type Currency = "YER" | "SAR" | "USD" | "EUR";

export const CURRENCIES: Record<Currency, { label: string; symbol: string; name: string; rate: number }> = {
  YER: { label: "ريال يمني", symbol: "ر.ي", name: "ريال يمني", rate: 1 },
  SAR: { label: "ريال سعودي", symbol: "ر.س", name: "ريال سعودي", rate: 425 },
  USD: { label: "دولار أمريكي", symbol: "$", name: "دولار أمريكي", rate: 1600 },
  EUR: { label: "يورو", symbol: "€", name: "يورو", rate: 1850 },
};

export const CURRENCY_KEYS = Object.keys(CURRENCIES) as Currency[];

export type DebtType = "receivable" | "payable";
export type DebtStatus = "active" | "partial" | "settled" | "cancelled";

export const DEBT_TYPES: Record<DebtType, { label: string }> = {
  receivable: { label: "عملية دائنة (لنا)" },
  payable: { label: "عملية مدينة (علينا)" },
};

export const DEBT_STATUSES: Record<DebtStatus, { label: string; badge: string; dot: string }> = {
  active: { label: "مفتوحة", badge: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30", dot: "bg-sky-500" },
  partial: { label: "مسددة جزئياً", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30", dot: "bg-indigo-500" },
  settled: { label: "مسددة بالكامل", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", dot: "bg-emerald-500" },
  cancelled: { label: "ملغية", badge: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30", dot: "bg-slate-400" },
};

export type PaymentMethod = "cash" | "bank" | "transfer" | "check";
export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string }> = {
  cash: { label: "نقداً", icon: "💵" },
  bank: { label: "بنك", icon: "🏦" },
  transfer: { label: "تحويل", icon: "🔄" },
  check: { label: "شيك", icon: "🧾" },
};

export interface Party {
  id: string;
  name: string;
  type: "individual" | "company" | "institution";
  idType?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  nationality?: string;
  notes?: string;
  createdAt: string;
}

/* ===== عملية مالية (بمنطق محاسبي) =====
 * كل عملية = قيد افتتاحي لمديونية: طرف + مبلغ + اتجاه (لنا/علينا) + تاريخ التسجيل.
 * بدون تواريخ استحقاق أو سداد — السداد يتم عبر عمليات دفع لاحقة تُنقص الرصيد.
 */
export interface Debt {
  id: string;
  number: string;
  type: DebtType;
  partyId: string;
  amount: number;
  currency: Currency;
  /** تاريخ تسجيل العملية */
  date: string;
  status: DebtStatus;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  debtId: string;
  date: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

/* ====== دفتر الحسابات — كشف الحساب الموحد ====== */
export interface LedgerAccount {
  id: string;
  name: string;
  currency: Currency;
  /** مديونية طرف لنا (receivable) أم مديونية علينا لطرف (payable) */
  type: "receivable" | "payable";
  notes?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  /** الترتيب الزمني داخل الحساب */
  seq: number;
  date: string;
  /** الجهة المنفذة */
  entity: string;
  /** رقم المرجع */
  reference: string;
  /** البيان التفصيلي */
  description: string;
  /** دائن = زيادة في المديونية */
  credit: number;
  /** مدين = نقص في المديونية */
  debit: number;
  /** لربط حركات القيد المحاسبي المزدوج */
  groupId?: string;
  groupLabel?: string;
  createdAt: string;
  updatedAt?: string;
}

export const LEDGER_ENTITIES = [
  "تحويل بنكي",
  "عالم الصرافة",
  "شبكة الامتياز إكسبرس",
  "براق ويسترن يونيون",
  "دادية أون لاين",
  "بنك الكريمي",
  "الشبكة الموحدة للأموال",
  "تعويض",
  "إقرار والتزام",
  "سند قيد بسيط",
  "نقداً",
  "شيك",
  "أخرى",
];

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export const ACCOUNT_TYPES: Record<AccountType, { label: string; normal: "debit" | "credit" }> = {
  asset: { label: "أصول", normal: "debit" },
  liability: { label: "خصوم", normal: "credit" },
  equity: { label: "حقوق ملكية", normal: "credit" },
  income: { label: "إيرادات", normal: "credit" },
  expense: { label: "مصاريف", normal: "debit" },
};

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  currency?: Currency;
  openingBalance: number;
  isActive: boolean;
  description?: string;
}

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  description: string;
  currency: Currency;
  lines: JournalLine[];
  createdBy?: string;
  createdAt: string;
}

export type DocType =
  | "acknowledgment"
  | "commitment"
  | "settlement"
  | "notice"
  | "poa"
  | "receipt"
  | "release"
  | "contract"
  | "custom";

export const DOC_TYPES: Record<DocType, { label: string; icon: string }> = {
  acknowledgment: { label: "إقرار دين", icon: "📄" },
  commitment: { label: "تعهد بسداد", icon: "✍️" },
  settlement: { label: "اتفاقية تسوية", icon: "🤝" },
  notice: { label: "إنذار قانوني", icon: "⚠️" },
  poa: { label: "توكيل", icon: "📜" },
  receipt: { label: "سند قبض", icon: "🧾" },
  release: { label: "إخلاء طرف", icon: "✅" },
  contract: { label: "عقد", icon: "📑" },
  custom: { label: "قالب مخصص", icon: "📝" },
};

export const DOC_TYPE_KEYS = Object.keys(DOC_TYPES) as DocType[];

export type TemplateVariableType = "text" | "multiline" | "number" | "currency" | "date" | "party" | "witness" | "select" | "boolean";
export type TemplateVariableSource = "system" | "document" | "party" | "manual";

export interface TemplateVariable {
  key: string;
  label: string;
  type: TemplateVariableType;
  source: TemplateVariableSource;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  order: number;
}

export type DocumentPrintMode = "paper" | "digital";

export interface TemplatePrintProfile {
  defaultMode: DocumentPrintMode;
  showLogo: boolean;
  showSystemHeader: boolean;
  showSystemFooter: boolean;
  showQr: boolean;
  showDigitalVerification: boolean;
  signatureMode: "manual" | "biometric" | "both";
  paperSize: "A4";
}

export const DEFAULT_TEMPLATE_PRINT_PROFILE: TemplatePrintProfile = {
  defaultMode: "digital",
  showLogo: true,
  showSystemHeader: true,
  showSystemFooter: true,
  showQr: true,
  showDigitalVerification: true,
  signatureMode: "both",
  paperSize: "A4",
};

export interface DocTemplate {
  id: string;
  name: string;
  type: DocType;
  content: string;
  /** Tiptap HTML/JSON are optional to preserve old plain-text templates. */
  editorHtml?: string;
  editorJson?: Record<string, unknown>;
  variables?: TemplateVariable[];
  printProfile?: TemplatePrintProfile;
  description?: string;
  version?: number;
  updatedAt?: string;
  archivedAt?: string;
  isDefault: boolean;
  isBuiltin: boolean;
  createdAt: string;
}

export interface DocParty {
  role: string;
  name: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  phone?: string;
}

/* ====== التوقيع البيومتري الموثق للمستندات ======
 * عبر WebAuthn: تبقى البصمة داخل حساس الجهاز ولا تُخزَّن أو تُنقل أبداً.
 * ما يُحفظ هو إثبات تحقق بيومتري فوري (assertion) مربوط بمحتوى المستند
 * عبر challenge مشتق من بصمة المستند الرقمية (digest) + ختم زمني.
 */
export interface DocSignature {
  id: string;
  role: string;
  name: string;
  method: "biometric" | "manual";
  /** ختم زمني ISO للتوثيق */
  at: string;
  /** معرّف الاعتماد (b64) */
  credentialId?: string;
  /** التحدي المُرسل (b64) — مشتق من بصمة المستند */
  challenge?: string;
  /** clientDataJSON (b64) */
  clientDataJSON?: string;
  /** authenticatorData (b64) */
  authenticatorData?: string;
  /** توقيع الاعتماد (b64) */
  signature?: string;
  /** معرف الجهة المعتمدة */
  rpId?: string;
}

export interface LegalDoc {
  id: string;
  number: string;
  type: DocType;
  title: string;
  templateId: string;
  partyId?: string;
  amount?: number;
  currency: Currency;
  date: string;
  /** تاريخ السداد المتفق عليه (اختياري — يُستبدل في القالب {{due_date}}) */
  dueDate?: string;
  /** سبب الالتزام (اختياري — يُستبدل في القالب {{debt_reason}}) */
  reason?: string;
  body: string; // النص القديم/النصي للتوافق
  /** نسخة HTML المنسقة من المحرر الاحترافي */
  bodyHtml?: string;
  /** حالة محرر Tiptap المهيكلة */
  bodyJson?: Record<string, unknown>;
  /** القيم التي أدخلها المستخدم للمتغيرات وقت إنشاء المستند */
  variableValues?: Record<string, string>;
  /** نسخة القالب التي أُنشئ منها المستند */
  templateVersion?: number;
  /** نمط العرض والطباعة لهذا المستند */
  printProfile?: TemplatePrintProfile;
  parties: DocParty[];
  /** التواقيع المُلحقة (بيومترية عبر حساس البصمة أو يدوية) */
  signatures?: DocSignature[];
  status: "draft" | "final";
  history: { at: string; action: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}

export interface AppNotification {
  id: string;
  at: string;
  type: "reminder" | "system" | "success" | "warning";
  title: string;
  message: string;
  read: boolean;
}

export interface AppSettings {
  /** مصدر المستندات: شخصي أو منشأة */
  profileMode: "personal" | "org";
  orgName: string;
  orgAddress: string;
  orgPhone: string;
  orgEmail: string;
  orgLicense: string;
  orgCity: string;
  baseCurrency: Currency;
  arabicDigits: boolean;
  theme: "light" | "dark";
  pin?: string;
  /** معرف اعتماد WebAuthn للدخول البيومتري (بصمة / Face ID) */
  bioCredentialId?: string;
  /** معرّف عميل OAuth لربط النسخ الاحتياطي بـ Google Drive */
  driveClientId?: string;
  syncEnabled: boolean;
  exchangeRates: Record<string, number>;
  /* ====== الحذف التلقائي وسياسة الاحتفاظ ====== */
  /** تفعيل التنظيف التلقائي للبيانات عند تشغيل التطبيق */
  autoCleanupEnabled: boolean;
  /** الاحتفاظ بسجل التدقيق والتنبيهات (أيام) — ما هو أقدم يُحذف تلقائياً */
  cleanupAuditDays: number;
  /** حذف العمليات الملغاة ودفعاتها بعد (أشهر) */
  cleanupCancelledMonths: number;
  /* ====== النسخ الاحتياطي التلقائي ====== */
  /** إنشاء نسخة احتياطية محلية تلقائية (داخل الجهاز) عند كل تشغيل */
  localBackupEnabled: boolean;
  /** عدد النسخ الاحتياطية المحلية المحفوظة (الأقدم تُحذف تلقائياً) */
  localBackupKeep: number;
  /** عدد النسخ المحفوظة على Google Drive (الأقدم تُحذف تلقائياً) */
  driveBackupKeep: number;
  /** آخر نسخة احتياطية تلقائية ناجحة (ISO) */
  lastAutoBackupAt?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  profileMode: "personal",
  orgName: "",
  orgAddress: "",
  orgPhone: "",
  orgEmail: "",
  orgLicense: "",
  orgCity: "",
  baseCurrency: "SAR",
  arabicDigits: true,
  theme: "light",
  syncEnabled: false,
  exchangeRates: { YER: 0.00235, SAR: 1, USD: 3.75, EUR: 4.1 },
  autoCleanupEnabled: true,
  cleanupAuditDays: 180,
  cleanupCancelledMonths: 12,
  /* النسخ التلقائي معطل في الإصدار متعدد الحسابات؛ النسخ تتم يدوياً */
  localBackupEnabled: false,
  localBackupKeep: 6,
  driveBackupKeep: 20,
};

/* ====== نسخة احتياطية محلية تلقائية ====== */
export interface LocalBackup {
  id: string;
  at: string;
  /** حجم البيانات (بايت) */
  size: number;
  /** نسخة JSON كاملة من التصدير */
  data: Record<string, unknown>;
}
