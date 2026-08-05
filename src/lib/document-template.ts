/* ====== محرك القوالب والمتغيرات المشترك بين المحرر والمعاينة والطباعة ====== */
import type { AppSettings, DocTemplate, LegalDoc, Party, TemplatePrintProfile, TemplateVariable, TemplateVariableSource, TemplateVariableType } from "./types";
import { CURRENCIES, DEFAULT_TEMPLATE_PRINT_PROFILE } from "./types";
import { amountToWordsAr, fmtDate, fmtMoney, hijriDate, toDigits } from "./utils";

const KEY_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*\}\}/g;

const SYSTEM_VARIABLES: Record<string, Omit<TemplateVariable, "key" | "order">> = {
  org_name: { label: "اسم المصدر / المنشأة", type: "text", source: "system", required: false },
  org_address: { label: "عنوان المصدر / المنشأة", type: "text", source: "system", required: false },
  org_phone: { label: "هاتف المصدر / المنشأة", type: "text", source: "system", required: false },
  org_license: { label: "الترخيص / السجل", type: "text", source: "system", required: false },
  org_city: { label: "مدينة المصدر / المنشأة", type: "text", source: "system", required: false },
  party_name: { label: "اسم الطرف", type: "party", source: "party", required: true },
  party_id: { label: "رقم هوية الطرف", type: "text", source: "party", required: false },
  party_phone: { label: "هاتف الطرف", type: "text", source: "party", required: false },
  party_address: { label: "عنوان الطرف", type: "text", source: "party", required: false },
  party_nationality: { label: "جنسية الطرف", type: "text", source: "party", required: false },
  amount: { label: "المبلغ بالأرقام", type: "currency", source: "document", required: false },
  amount_words: { label: "المبلغ بالكلمات", type: "text", source: "document", required: false },
  currency: { label: "العملة", type: "text", source: "document", required: true },
  date_gregorian: { label: "التاريخ الميلادي", type: "date", source: "document", required: true },
  date_hijri: { label: "التاريخ الهجري", type: "text", source: "document", required: false },
  due_date: { label: "تاريخ السداد المتفق عليه", type: "date", source: "document", required: false },
  witness1: { label: "الشاهد الأول", type: "witness", source: "manual", required: false },
  witness2: { label: "الشاهد الثاني", type: "witness", source: "manual", required: false },
  doc_number: { label: "رقم المستند", type: "text", source: "document", required: true },
  debt_reason: { label: "سبب الالتزام / الدين", type: "multiline", source: "document", required: false },
};

export const TEMPLATE_VARIABLE_TYPES: { key: TemplateVariableType; label: string }[] = [
  { key: "text", label: "نص قصير" },
  { key: "multiline", label: "نص متعدد الأسطر" },
  { key: "number", label: "رقم" },
  { key: "currency", label: "مبلغ مالي" },
  { key: "date", label: "تاريخ" },
  { key: "party", label: "طرف من السجل" },
  { key: "witness", label: "شاهد" },
  { key: "select", label: "قائمة اختيار" },
  { key: "boolean", label: "نعم / لا" },
];

export const TEMPLATE_VARIABLE_SOURCES: { key: TemplateVariableSource; label: string }[] = [
  { key: "system", label: "إعدادات النظام" },
  { key: "document", label: "بيانات المستند" },
  { key: "party", label: "بيانات الطرف" },
  { key: "manual", label: "إدخال يدوي" },
];

export function normalizeVariableKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^([^a-z])/, "v_$1")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "custom_value";
}

export function extractVariableKeys(content: string): string[] {
  const keys: string[] = [];
  for (const match of content.matchAll(KEY_RE)) {
    const key = normalizeVariableKey(match[1]);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export function legacyVariables(content: string): TemplateVariable[] {
  return extractVariableKeys(content).map((key, order) => ({
    key,
    order,
    ...(SYSTEM_VARIABLES[key] || { label: key, type: "text", source: "manual", required: false }),
  }));
}

export function templateVariables(template: Pick<DocTemplate, "content" | "variables">): TemplateVariable[] {
  const existing = template.variables?.length ? template.variables : legacyVariables(template.content);
  const keysInContent = extractVariableKeys(template.content);
  const merged = [...existing];
  for (const key of keysInContent) {
    if (!merged.some((variable) => variable.key === key)) {
      merged.push({
        key,
        order: merged.length,
        ...(SYSTEM_VARIABLES[key] || { label: key, type: "text", source: "manual", required: false }),
      });
    }
  }
  return merged.sort((a, b) => a.order - b.order).map((v, order) => ({ ...v, order }));
}

export function normalizeTemplate(template: DocTemplate): DocTemplate {
  const variables = templateVariables(template);
  return {
    ...template,
    variables,
    printProfile: { ...DEFAULT_TEMPLATE_PRINT_PROFILE, ...(template.printProfile || {}) },
    version: template.version || 1,
    updatedAt: template.updatedAt || template.createdAt,
  };
}

export function normalizePrintProfile(profile?: Partial<TemplatePrintProfile>): TemplatePrintProfile {
  const merged = { ...DEFAULT_TEMPLATE_PRINT_PROFILE, ...(profile || {}) };
  if (merged.defaultMode === "paper") {
    return {
      ...merged,
      showLogo: false,
      showSystemHeader: false,
      showSystemFooter: false,
      showQr: false,
      showDigitalVerification: false,
      signatureMode: "manual",
    };
  }
  return merged;
}

export function legacyTextToHtml(text: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs.map((part) => `<p>${escape(part).replace(/\n/g, "<br>")}</p>`).join("") : "<p></p>";
}

export function templateEditorHtml(template: Pick<DocTemplate, "content" | "editorHtml">): string {
  return template.editorHtml?.trim() || legacyTextToHtml(template.content);
}

export function validateVariableKey(key: string, existing: TemplateVariable[], currentKey?: string): string | null {
  const normalized = normalizeVariableKey(key);
  if (!normalized || !/^[a-z][a-z0-9_-]*$/.test(normalized)) return "يجب أن يبدأ المفتاح بحرف إنجليزي ويحتوي على أحرف أو أرقام أو _ أو - فقط";
  if (existing.some((variable) => variable.key === normalized && variable.key !== currentKey)) return "يوجد متغير آخر بنفس المفتاح";
  return null;
}

export function missingRequiredVariables(template: DocTemplate, values: Record<string, string>): TemplateVariable[] {
  return templateVariables(template).filter((variable) => {
    const value = String(values[variable.key] || "").trim();
    return variable.required && (!value || /^_+$/.test(value));
  });
}

export function resolveDocumentValues(
  doc: Pick<LegalDoc, "amount" | "currency" | "date" | "dueDate" | "reason" | "number" | "variableValues" | "parties">,
  party: Pick<Party, "name" | "idNumber" | "phone" | "address" | "nationality"> | undefined,
  settings: AppSettings,
  arabic = settings.arabicDigits,
): Record<string, string> {
  const witness1 = doc.parties.find((p) => p.role.includes("الشاهد الأول"));
  const witness2 = doc.parties.find((p) => p.role.includes("الشاهد الثاني"));
  return {
    org_name: settings.orgName,
    org_address: settings.orgAddress,
    org_phone: settings.orgPhone,
    org_license: settings.orgLicense,
    org_city: settings.orgCity,
    party_name: party?.name || "________________",
    party_id: party?.idNumber || "________________",
    party_phone: party?.phone || "________________",
    party_address: party?.address || "________________",
    party_nationality: party?.nationality || "________________",
    amount: doc.amount !== undefined ? fmtMoney(doc.amount, doc.currency, arabic, 2) : "________________",
    amount_words: doc.amount !== undefined ? amountToWordsAr(doc.amount, CURRENCIES[doc.currency].name) : "________________",
    currency: CURRENCIES[doc.currency].label,
    date_gregorian: fmtDate(doc.date, arabic),
    date_hijri: hijriDate(doc.date),
    due_date: doc.dueDate ? fmtDate(doc.dueDate, arabic) : "________________",
    witness1: witness1?.name || "________________",
    witness2: witness2?.name || "________________",
    doc_number: toDigits(doc.number, arabic),
    debt_reason: doc.reason || "________________",
    ...(doc.variableValues || {}),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function replaceTemplateVariables(content: string, values: Record<string, string>, missing = "________________"): string {
  return content.replace(KEY_RE, (_match, key: string) => escapeHtml(values[normalizeVariableKey(key)] ?? missing));
}

export function resolvedDocumentHtml(
  doc: Pick<LegalDoc, "body" | "bodyHtml" | "amount" | "currency" | "date" | "dueDate" | "reason" | "number" | "variableValues" | "parties">,
  party: Pick<Party, "name" | "idNumber" | "phone" | "address" | "nationality"> | undefined,
  settings: AppSettings,
  arabic = settings.arabicDigits,
): string {
  const source = doc.bodyHtml?.trim() || legacyTextToHtml(doc.body || "");
  return replaceTemplateVariables(source, resolveDocumentValues(doc, party, settings, arabic));
}

export function profileForTemplate(template: DocTemplate, mode?: "paper" | "digital"): TemplatePrintProfile {
  const base = normalizePrintProfile(template.printProfile);
  if (mode === "paper") {
    return {
      ...base,
      defaultMode: "paper",
      showLogo: false,
      showSystemHeader: false,
      showSystemFooter: false,
      showQr: false,
      showDigitalVerification: false,
      signatureMode: "manual",
    };
  }
  return mode === "digital" ? { ...base, defaultMode: "digital" } : base;
}
