/* ====== المستندات القانونية ====== */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, FileText, Printer, Trash2, Copy, LayoutTemplate, QrCode, Save, PenLine, MessageCircle, Eye, Variable, Archive, Settings2, XCircle,
} from "lucide-react";
import { db, documentsService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useNavigate } from "@/lib/router";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea } from "@/components/ui";
import { CURRENCIES, CURRENCY_KEYS, DEFAULT_TEMPLATE_PRINT_PROFILE, DOC_TYPES, DOC_TYPE_KEYS, type Currency, type DocParty, type DocTemplate, type DocType, type DocumentPrintMode, type TemplatePrintProfile, type TemplateVariable, type TemplateVariableType, type TemplateVariableSource } from "@/lib/types";
import { amountToWordsAr, fmtDate, fmtMoney, hijriDate, toDigits, todayISO, uid } from "@/lib/utils";
import { DocumentPreview } from "./DocumentPreview";
import { RichTextEditor } from "./RichTextEditor";
import { extractVariableKeys, missingRequiredVariables, normalizePrintProfile, normalizeTemplate, normalizeVariableKey, profileForTemplate, replaceTemplateVariables, resolvedDocumentHtml, templateEditorHtml, templateVariables, validateVariableKey, TEMPLATE_VARIABLE_SOURCES, TEMPLATE_VARIABLE_TYPES } from "@/lib/document-template";

export function DocumentsPage() {
  const { settings, toast } = useApp();
  const navigate = useNavigate();
  const arabic = settings.arabicDigits;
  const [tab, setTab] = useState("docs");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [templateEditor, setTemplateEditor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const docs = useLiveQuery(() => documentsService.list()) || [];
  const templates = useLiveQuery(() => db.templates.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const totalPages = Math.max(1, Math.ceil(docs.length / pageSize));
  const paginatedDocs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return docs.slice(start, start + pageSize);
  }, [docs, page]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="المستندات القانونية"
        description="إقرارات، تعهدات، تسويات، إنذارات، وكلاء — بترقيم موحد وتحقق بالرمز QR"
        actions={
          <>
            <Button variant="outline" onClick={() => setTab("templates")}><LayoutTemplate size={16} /> إدارة القوالب</Button>
            <Button variant="outline" onClick={() => { setTemplateEditor("new"); setTab("templates"); }}><Plus size={16} /> قالب جديد</Button>
            <Button onClick={() => { setEditId(null); setEditorOpen(true); }}><Plus size={17} /> مستند جديد</Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { key: "docs", label: "المستندات", icon: <FileText size={14} />, count: docs.length },
          { key: "templates", label: "القوالب", icon: <LayoutTemplate size={14} />, count: templates.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === "docs" && (
          <Card className="overflow-hidden">
            {docs.length === 0 ? (
              <EmptyState icon={<FileText size={28} />} title="لا توجد مستندات بعد"
                description="أنشئ مستنداً قانونياً من قالب احترافي جاهز"
                action={<Button onClick={() => setEditorOpen(true)}><Plus size={16} /> مستند جديد</Button>} />
            ) : (
              <>
              <Table headers={["الرقم", "النوع", "العنوان", "الطرف", "التاريخ", "الحالة", ""]} dense>
                {paginatedDocs.map((d) => {
                  const party = d.partyId ? partyMap.get(d.partyId) : undefined;
                  return (
                    <tr key={d.id} className="transition-colors hover:bg-brand-50/40 dark:hover:bg-slate-800/40">
                      <Td className="font-bold text-brand-700 dark:text-brand-300" dir="ltr">{toDigits(d.number, arabic)}</Td>
                      <Td>
                        <Badge className="bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                          {DOC_TYPES[d.type].icon} {DOC_TYPES[d.type].label}
                        </Badge>
                      </Td>
                      <Td className="max-w-56 truncate font-semibold">{d.title}</Td>
                      <Td className="max-w-40 truncate text-slate-500 dark:text-slate-400">{party?.name || d.parties[0]?.name || "—"}</Td>
                      <Td>{fmtDate(d.date, arabic)}</Td>
                      <Td>
                        <Badge className={d.status === "final" ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"}>
                          {d.status === "final" ? "معتمد" : "مسودة"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button title="عرض وطباعة / PDF" onClick={() => navigate(`print/doc/${d.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 cursor-pointer"><Printer size={15} /></button>
                          <button title="مشاركة PDF عبر واتساب" onClick={() => navigate(`print/doc/${d.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-[#25D366] dark:hover:bg-slate-800 cursor-pointer"><MessageCircle size={15} /></button>
                          {d.printProfile?.defaultMode === "paper" ? <Badge className="bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">ورقي</Badge> : <button title="تحقق QR" onClick={() => navigate(`verify/${d.number}`)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"><QrCode size={15} /></button>}
                          <button aria-label="تعديل" title="تعديل" onClick={() => { setEditId(d.id); setEditorOpen(true); }} className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-slate-800 cursor-pointer"><PenLine size={15} /></button>
                          <button aria-label="نسخ" title="نسخ" onClick={async () => { const n = await documentsService.duplicate(d.id); if (n) toast("success", "تم إنشاء نسخة", n.number); }} className="rounded-lg p-2 text-slate-400 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-slate-800 cursor-pointer"><Copy size={15} /></button>
                          <button aria-label="حذف" title="حذف" onClick={() => setDeleteFor(d.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    عرض {toDigits((page - 1) * pageSize + 1, arabic)}–{toDigits(Math.min(page * pageSize, docs.length), arabic)} من {toDigits(docs.length, arabic)} مستند
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← السابق</Button>
                    <span className="min-w-[80px] text-center text-[13px] font-bold text-slate-700 dark:text-slate-200">
                      {toDigits(page, arabic)} / {toDigits(totalPages, arabic)}
                    </span>
                    <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي →</Button>
                  </div>
                </div>
              )}
              </>
            )}
          </Card>
        )}

        {tab === "templates" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.filter((t) => !(t as DocTemplate).archivedAt).map((t) => (
              <Card key={t.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-lg dark:bg-brand-500/10">{DOC_TYPES[t.type].icon}</div>
                  {t.isDefault && <Badge className="bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">افتراضي</Badge>}
                </div>
                <p className="mt-3 font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="mt-1 line-clamp-3 flex-1 text-xs leading-6 text-slate-400">{t.content.replace(/\{\{[\w]+\}\}/g, "…")}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setTemplateEditor(t.id)}><PenLine size={13} /> {t.isBuiltin ? "تخصيص" : "تحرير"}</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const copy = { ...t, id: uid("tpl"), name: `${t.name} (نسخة)`, isBuiltin: false, isDefault: false };
                    await db.templates.add(copy);
                    toast("success", "تم نسخ القالب");
                  }}><Copy size={13} /></Button>
                  {!t.isBuiltin && <Button size="sm" variant="ghost" title="أرشفة القالب" onClick={async () => { await db.templates.update(t.id, { archivedAt: new Date().toISOString() }); toast("info", "تمت أرشفة القالب"); }}><Archive size={13} /></Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <DocEditor
          docId={editId}
          templates={templates}
          parties={parties}
          onClose={() => setEditorOpen(false)}
          onSaved={(id, print) => {
            setEditorOpen(false);
            toast("success", "تم حفظ المستند");
            if (print) navigate(`print/doc/${id}`);
          }}
        />
      )}

      {templateEditor && (
        <TemplateEditor templateId={templateEditor === "new" ? null : templateEditor} onClose={() => setTemplateEditor(null)} />
      )}

      {deleteFor && (
        <Modal open onClose={() => setDeleteFor(null)} title="حذف المستند">
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">سيتم حذف هذا المستند نهائياً. لا يمكن التراجع.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteFor(null)}>إلغاء</Button>
            <Button variant="danger" onClick={async () => { await documentsService.remove(deleteFor); setDeleteFor(null); toast("info", "تم حذف المستند"); }}><Trash2 size={15} /> حذف</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ====== محرر المستند الاحترافي ====== */
function DocEditor({ docId, templates, parties, onClose, onSaved }: {
  docId: string | null;
  templates: DocTemplate[];
  parties: { id: string; name: string; idNumber?: string; idType?: string }[];
  onClose: () => void;
  onSaved: (id: string, print: boolean) => void;
}) {
  const { settings, toast } = useApp();
  const existing = useLiveQuery(() => (docId ? db.documents.get(docId) : undefined), [docId]);
  const [docType, setDocType] = useState<DocType>(existing?.type || "acknowledgment");
  const [templateId, setTemplateId] = useState(existing?.templateId || "");
  const [title, setTitle] = useState(existing?.title || "");
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const [amount, setAmount] = useState(existing?.amount !== undefined ? String(existing.amount) : "");
  const [currency, setCurrency] = useState<Currency>(existing?.currency || settings.baseCurrency);
  const [date, setDate] = useState(existing?.date || todayISO());
  const [dueDate, setDueDate] = useState(existing?.dueDate || "");
  const [reason, setReason] = useState(existing?.reason || "");
  const [witness1, setWitness1] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الأول"))?.name || "");
  const [witness1Id, setWitness1Id] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الأول"))?.idNumber || "");
  const [witness2, setWitness2] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الثاني"))?.name || "");
  const [witness2Id, setWitness2Id] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الثاني"))?.idNumber || "");
  const [bodyHtml, setBodyHtml] = useState(existing?.bodyHtml || (existing ? templateEditorHtml({ content: existing.body }) : "<p></p>"));
  const [bodyJson, setBodyJson] = useState<Record<string, unknown> | undefined>(existing?.bodyJson);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(existing?.variableValues || {});
  const [printMode, setPrintMode] = useState<DocumentPrintMode>(existing?.printProfile?.defaultMode || "digital");
  const [printProfile, setPrintProfile] = useState<TemplatePrintProfile>(normalizePrintProfile(existing?.printProfile));
  const [printAfter, setPrintAfter] = useState(true);
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!docId || !existing || hydratedRef.current) return;
    hydratedRef.current = true;
    setDocType(existing.type);
    setTemplateId(existing.templateId);
    setTitle(existing.title);
    setPartyId(existing.partyId || "");
    setAmount(existing.amount !== undefined ? String(existing.amount) : "");
    setCurrency(existing.currency);
    setDate(existing.date);
    setDueDate(existing.dueDate || "");
    setReason(existing.reason || "");
    setWitness1(existing.parties.find((p) => p.role.includes("الشاهد الأول"))?.name || "");
    setWitness1Id(existing.parties.find((p) => p.role.includes("الشاهد الأول"))?.idNumber || "");
    setWitness2(existing.parties.find((p) => p.role.includes("الشاهد الثاني"))?.name || "");
    setWitness2Id(existing.parties.find((p) => p.role.includes("الشاهد الثاني"))?.idNumber || "");
    setBodyHtml(existing.bodyHtml || templateEditorHtml({ content: existing.body }));
    setBodyJson(existing.bodyJson);
    setVariableValues(existing.variableValues || {});
    setPrintMode(existing.printProfile?.defaultMode || "digital");
    setPrintProfile(normalizePrintProfile(existing.printProfile));
    setDirty(false);
  }, [docId, existing]);

  const template = useMemo(() => {
    const raw = templates.find((item) => item.id === templateId);
    return raw ? normalizeTemplate(raw) : undefined;
  }, [templateId, templates]);
  const variables = template ? templateVariables(template) : [];
  const party = parties.find((item) => item.id === partyId);
  const customVariables = variables.filter((variable) => variable.source === "manual" && !["witness1", "witness2"].includes(variable.key));

  const draftDoc = useMemo(() => ({
    body: bodyHtml,
    bodyHtml,
    amount: amount ? Number(amount) : undefined,
    currency,
    date,
    dueDate: dueDate || undefined,
    reason: reason || undefined,
    number: existing?.number || "DOC-PREVIEW",
    variableValues,
    parties: [
      ...(party ? [{ role: "الطرف الثاني", name: party.name, idNumber: party.idNumber, idType: party.idType }] : []),
      ...(witness1.trim() ? [{ role: "الشاهد الأول", name: witness1.trim(), idNumber: witness1Id.trim() || undefined }] : []),
      ...(witness2.trim() ? [{ role: "الشاهد الثاني", name: witness2.trim(), idNumber: witness2Id.trim() || undefined }] : []),
    ],
  }), [amount, bodyHtml, currency, date, dueDate, existing?.number, party, reason, variableValues, witness1, witness1Id, witness2, witness2Id]);

  const previewHtml = useMemo(() => resolvedDocumentHtml(draftDoc, party, settings, settings.arabicDigits), [draftDoc, party, settings]);
  const resolvedValues = useMemo(() => ({ ...variableValues, ...resolvePreviewValues(draftDoc, party, settings) }), [draftDoc, party, settings, variableValues]);
  const missing = template ? missingRequiredVariables(template, resolvedValues) : [];

  const markDirty = () => setDirty(true);

  const applyTemplate = (nextId: string) => {
    const nextRaw = templates.find((item) => item.id === nextId);
    if (!nextRaw) return;
    if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تطبيق القالب الجديد؟")) return;
    const next = normalizeTemplate(nextRaw);
    setTemplateId(next.id);
    setDocType(next.type);
    setBodyHtml(templateEditorHtml(next));
    setBodyJson(next.editorJson);
    setVariableValues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => next.variables?.some((variable) => variable.key === key))));
    setPrintMode(next.printProfile?.defaultMode || "digital");
    setPrintProfile(profileForTemplate(next, next.printProfile?.defaultMode || "digital"));
    setDirty(true);
  };

  const changeType = (nextType: DocType) => {
    setDocType(nextType);
    const first = templates.find((item) => item.type === nextType && !item.archivedAt);
    if (first) applyTemplate(first.id);
    else {
      setTemplateId("");
      setBodyHtml("<p></p>");
      setBodyJson(undefined);
      setDirty(true);
    }
  };

  const changePrintMode = (mode: DocumentPrintMode) => {
    setPrintMode(mode);
    if (template) setPrintProfile(profileForTemplate(template, mode));
    else setPrintProfile(mode === "paper" ? { ...DEFAULT_TEMPLATE_PRINT_PROFILE, defaultMode: "paper", showLogo: false, showSystemHeader: false, showSystemFooter: false, showQr: false, showDigitalVerification: false, signatureMode: "manual" } : DEFAULT_TEMPLATE_PRINT_PROFILE);
    setDirty(true);
  };

  const save = async (status: "draft" | "final") => {
    if (!templateId || !template) {
      toast("error", "اختر قالباً أولاً");
      return;
    }
    if (!bodyHtml.replace(/<[^>]+>/g, "").trim()) {
      toast("error", "أدخل نص المستند");
      return;
    }
    const missingValues = missingRequiredVariables(template, resolvedValues);
    if (missingValues.length > 0) {
      toast("error", "بيانات مطلوبة ناقصة", missingValues.map((item) => item.label).join("، "));
      return;
    }
    const docParties: DocParty[] = [];
    if (party) docParties.push({ role: "الطرف الثاني", name: party.name, idNumber: party.idNumber, idType: party.idType });
    if (witness1.trim()) docParties.push({ role: "الشاهد الأول", name: witness1.trim(), idNumber: witness1Id.trim() || undefined });
    if (witness2.trim()) docParties.push({ role: "الشاهد الثاني", name: witness2.trim(), idNumber: witness2Id.trim() || undefined });

    const saved = await documentsService.save({
      type: docType,
      title: title.trim() || template.name,
      templateId: template.id,
      partyId: partyId || undefined,
      amount: amount ? Number(amount) : undefined,
      currency,
      date,
      dueDate: dueDate || undefined,
      reason: reason.trim() || undefined,
      body: bodyHtml,
      bodyHtml,
      bodyJson,
      variableValues,
      templateVersion: template.version || 1,
      printProfile: { ...printProfile, defaultMode: printMode },
      parties: docParties,
      status,
    }, docId || undefined);
    setDirty(false);
    onSaved(saved.id, status === "final" && printAfter);
  };

  const close = () => {
    if (!dirty || window.confirm("لديك تغييرات غير محفوظة. هل تريد الخروج دون حفظ؟")) onClose();
  };

  const effectiveProfile = { ...printProfile, defaultMode: printMode };

  return (
    <Modal open onClose={close} title={docId ? "محرر المستند" : "إنشاء مستند قانوني"} wide>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="نوع المستند" required>
              <Select value={docType} onChange={(e) => changeType(e.target.value as DocType)}>
                {DOC_TYPE_KEYS.map((key) => <option key={key} value={key}>{DOC_TYPES[key].icon} {DOC_TYPES[key].label}</option>)}
              </Select>
            </Field>
            <Field label="القالب" required>
              <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">— اختر قالباً —</option>
                {templates.filter((item) => item.type === docType && !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isBuiltin ? " · مدمج" : ""}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="عنوان المستند">
            <Input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} placeholder="مثال: إقرار دين — اسم الطرف" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="الطرف">
              <Select value={partyId} onChange={(e) => { setPartyId(e.target.value); markDirty(); }}>
                <option value="">— بدون طرف —</option>
                {parties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="نمط الطباعة">
              <Select value={printMode} onChange={(e) => changePrintMode(e.target.value as DocumentPrintMode)}>
                <option value="paper">رسمي ورقي — بلا شعار أو QR</option>
                <option value="digital">رقمي موثق — شعار وQR</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="المبلغ">
              <Input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); markDirty(); }} placeholder="0.00" />
            </Field>
            <Field label="العملة">
              <Select value={currency} onChange={(e) => { setCurrency(e.target.value as Currency); markDirty(); }}>
                {CURRENCY_KEYS.map((key) => <option key={key} value={key}>{CURRENCIES[key].label}</option>)}
              </Select>
            </Field>
            <Field label="تاريخ التحرير">
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); markDirty(); }} />
            </Field>
            <Field label="تاريخ السداد المتفق عليه">
              <Input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); markDirty(); }} />
            </Field>
          </div>

          <Field label="سبب الالتزام / الدين">
            <Textarea value={reason} onChange={(e) => { setReason(e.target.value); markDirty(); }} rows={2} placeholder="سبب الالتزام أو البيان القانوني…" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="الشاهد الأول">
              <Input value={witness1} onChange={(e) => { setWitness1(e.target.value); markDirty(); }} placeholder="اسم الشاهد" />
            </Field>
            <Field label="رقم هوية الشاهد الأول">
              <Input value={witness1Id} onChange={(e) => { setWitness1Id(e.target.value); markDirty(); }} placeholder="اختياري" />
            </Field>
            <Field label="الشاهد الثاني">
              <Input value={witness2} onChange={(e) => { setWitness2(e.target.value); markDirty(); }} placeholder="اسم الشاهد" />
            </Field>
            <Field label="رقم هوية الشاهد الثاني">
              <Input value={witness2Id} onChange={(e) => { setWitness2Id(e.target.value); markDirty(); }} placeholder="اختياري" />
            </Field>
          </div>

          {customVariables.length > 0 && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/10">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-brand-900 dark:text-brand-200">متغيرات هذا القالب</h3>
                  <p className="text-[11px] text-brand-700/70 dark:text-brand-300/70">حقول مخصصة يحددها صاحب القالب</p>
                </div>
                <Variable size={17} className="text-brand-600" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {customVariables.map((variable) => <VariableValueField key={variable.key} variable={variable} value={variableValues[variable.key] || ""} onChange={(value) => { setVariableValues((current) => ({ ...current, [variable.key]: value })); markDirty(); }} />)}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">نص الوثيقة</h3>
                <p className="text-[11px] text-slate-400">محرر RTL احترافي — إدراج المتغيرات من الشريط داخل المحرر</p>
              </div>
              {missing.length > 0 && <span className="text-[11px] font-bold text-amber-600">{missing.length} متغير ناقص</span>}
            </div>
            <RichTextEditor
              value={bodyHtml}
              variables={variables}
              onChange={(html, json) => { setBodyHtml(html); setBodyJson(json); markDirty(); }}
              onInsertVariable={() => markDirty()}
            />
          </div>
        </div>

        <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">معاينة حية</h3>
              <p className="text-[11px] text-slate-400">المعاينة تتغير مع كل تعديل وتستخدم نمط الطباعة المختار</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">A4</span>
          </div>
          <DocumentPreview title={title || template?.name || "عنوان المستند"} html={previewHtml} number={existing?.number || "DOC-PREVIEW"} date={date} profile={effectiveProfile} missingCount={missing.length} />
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            {printMode === "paper" ? "نمط ورقي: لا شعار، لا QR، ولا توثيق إلكتروني. اترك التوقيع والختم والبصمة للنسخة الورقية." : "نمط رقمي: ستظهر هوية النظام ورمز QR في صفحة الطباعة."}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          فتح المعاينة/الطباعة بعد الاعتماد
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={close}>إلغاء</Button>
          <Button variant="outline" onClick={() => void save("draft")}><Save size={15} /> حفظ مسودة</Button>
          <Button onClick={() => void save("final")}><Printer size={15} /> اعتماد وحفظ</Button>
        </div>
      </div>
    </Modal>
  );
}

function resolvePreviewValues(doc: { amount?: number; currency: Currency; date: string; dueDate?: string; reason?: string; number: string; parties: DocParty[]; variableValues?: Record<string, string> }, party: { name: string; idNumber?: string; phone?: string; address?: string; nationality?: string } | undefined, settings: ReturnType<typeof useApp>["settings"]): Record<string, string> {
  const w1 = doc.parties.find((item) => item.role.includes("الشاهد الأول"));
  const w2 = doc.parties.find((item) => item.role.includes("الشاهد الثاني"));
  return {
    org_name: settings.orgName, org_address: settings.orgAddress, org_phone: settings.orgPhone, org_license: settings.orgLicense, org_city: settings.orgCity,
    party_name: party?.name || "________________", party_id: party?.idNumber || "________________", party_phone: party?.phone || "________________", party_address: party?.address || "________________", party_nationality: party?.nationality || "________________",
    amount: doc.amount !== undefined ? fmtMoney(doc.amount, doc.currency, settings.arabicDigits, 2) : "________________", amount_words: doc.amount !== undefined ? amountToWordsAr(doc.amount, CURRENCIES[doc.currency].name) : "________________", currency: CURRENCIES[doc.currency].label,
    date_gregorian: fmtDate(doc.date, settings.arabicDigits), date_hijri: hijriDate(doc.date), due_date: doc.dueDate ? fmtDate(doc.dueDate, settings.arabicDigits) : "________________", witness1: w1?.name || "________________", witness2: w2?.name || "________________", doc_number: doc.number, debt_reason: doc.reason || "________________",
    ...(doc.variableValues || {}),
  };
}

function VariableValueField({ variable, value, onChange }: { variable: TemplateVariable; value: string; onChange: (value: string) => void }) {
  const props = { value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value) };
  if (variable.type === "multiline") return <Field label={variable.label} required={variable.required}><Textarea {...props} rows={2} placeholder={variable.defaultValue || "أدخل القيمة…"} /></Field>;
  if (variable.type === "select") return <Field label={variable.label} required={variable.required}><Select {...props}><option value="">— اختر —</option>{(variable.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>;
  if (variable.type === "date") return <Field label={variable.label} required={variable.required}><Input type="date" {...props} /></Field>;
  if (variable.type === "number" || variable.type === "currency") return <Field label={variable.label} required={variable.required}><Input type="number" step="0.01" {...props} placeholder={variable.defaultValue || "0.00"} /></Field>;
  return <Field label={variable.label} required={variable.required}><Input {...props} placeholder={variable.defaultValue || "أدخل القيمة…"} /></Field>;
}

/* ====== مدير القالب والمتغيرات ====== */
function TemplateEditor({ templateId, onClose }: { templateId: string | null; onClose: () => void }) {
  const { toast } = useApp();
  const tpl = useLiveQuery(() => (templateId ? db.templates.get(templateId) : undefined), [templateId]);
  const initial = tpl ? normalizeTemplate(tpl) : undefined;
  const [name, setName] = useState(initial?.name || "قالب جديد");
  const [type, setType] = useState<DocType>(initial?.type || "custom");
  const [description, setDescription] = useState(initial?.description || "");
  const [html, setHtml] = useState(initial ? templateEditorHtml(initial) : "<p></p>");
  const [json, setJson] = useState<Record<string, unknown> | undefined>(initial?.editorJson);
  const [variables, setVariables] = useState<TemplateVariable[]>(initial?.variables || []);
  const [profile, setProfile] = useState<TemplatePrintProfile>(normalizePrintProfile(initial?.printProfile));
  const [hydrated, setHydrated] = useState(!templateId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!tpl || hydrated) return;
    const normalized = normalizeTemplate(tpl);
    setName(normalized.name);
    setType(normalized.type);
    setDescription(normalized.description || "");
    setHtml(templateEditorHtml(normalized));
    setJson(normalized.editorJson);
    setVariables(normalized.variables || []);
    setProfile(normalizePrintProfile(normalized.printProfile));
    setHydrated(true);
  }, [tpl, hydrated]);

  const previewValues = Object.fromEntries(variables.map((variable) => [variable.key, variable.defaultValue || `«${variable.label}»`]));
  const previewHtml = replaceTemplateVariables(html, previewValues, "________________");
  const currentTemplate = { id: templateId || "preview", name, type, content: html, editorHtml: html, editorJson: json, variables, printProfile: profile, isDefault: false, isBuiltin: false, createdAt: new Date().toISOString(), version: initial?.version || 1 };

  const close = () => {
    if (!dirty || window.confirm("لديك تغييرات غير محفوظة. هل تريد الخروج دون حفظ؟")) onClose();
  };

  const saveTemplate = async () => {
    const cleanName = name.trim();
    if (!cleanName || !html.replace(/<[^>]+>/g, "").trim()) { toast("error", "أدخل اسم القالب ونصه"); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (tpl?.isBuiltin) {
        await db.templates.add({ ...currentTemplate, id: uid("tpl-custom"), name: `${cleanName} (نسخة مخصصة)`, isBuiltin: false, isDefault: false, createdAt: now, updatedAt: now, version: 1, description });
        toast("success", "تم حفظ نسخة مخصصة من القالب المدمج");
      } else if (templateId && tpl) {
        await db.templates.update(templateId, { name: cleanName, type, content: html, editorHtml: html, editorJson: json, variables, printProfile: profile, description, updatedAt: now, version: (tpl.version || 1) + 1 });
        toast("success", "تم حفظ القالب");
      } else {
        await db.templates.add({ ...currentTemplate, id: uid("tpl-custom"), name: cleanName, isBuiltin: false, isDefault: false, createdAt: now, updatedAt: now, version: 1, description });
        toast("success", "تم إنشاء القالب الجديد");
      }
      onClose();
    } catch (err) {
      toast("error", "تعذر حفظ القالب", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (templateId && !tpl) return <Modal open onClose={onClose} title="تحميل القالب"><div className="py-10 text-center text-sm text-slate-400">جارٍ تحميل بيانات القالب…</div></Modal>;

  return (
    <Modal open onClose={close} title={tpl?.isBuiltin ? `تخصيص: ${tpl.name}` : templateId ? "تحرير قالب" : "قالب جديد"} wide>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="space-y-4">
          {tpl?.isBuiltin && <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-6 text-amber-800">القالب مدمج ومحمي. سيتم حفظ التعديلات كنسخة مخصصة ولن يتغير القالب الأصلي.</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="اسم القالب" required><Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} /></Field>
            <Field label="نوع المستند" required><Select value={type} onChange={(e) => { setType(e.target.value as DocType); setDirty(true); }}>{DOC_TYPE_KEYS.map((key) => <option key={key} value={key}>{DOC_TYPES[key].label}</option>)}</Select></Field>
          </div>
          <Field label="وصف القالب"><Textarea value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} rows={2} placeholder="متى يستخدم هذا القالب؟" /></Field>
          <RichTextEditor value={html} variables={variables} onChange={(nextHtml, nextJson) => { setHtml(nextHtml); setJson(nextJson); setDirty(true); }} onInsertVariable={() => setDirty(true)} />
          <VariableManager variables={variables} content={html} onChange={(next) => { setVariables(next); setDirty(true); }} />
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex items-center gap-2"><Settings2 size={16} className="text-brand-600" /><h3 className="font-bold text-slate-900 dark:text-white">إعدادات الطباعة الافتراضية</h3></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="النمط الافتراضي"><Select value={profile.defaultMode} onChange={(e) => { setProfile((p) => normalizePrintProfile({ ...p, defaultMode: e.target.value as DocumentPrintMode })); setDirty(true); }}><option value="paper">رسمي ورقي بلا شعار</option><option value="digital">رقمي موثق</option></Select></Field>
              <Field label="التوقيع"><Select value={profile.signatureMode} onChange={(e) => { setProfile((p) => ({ ...p, signatureMode: e.target.value as TemplatePrintProfile["signatureMode"] })); setDirty(true); }}><option value="manual">يدوي على الورق</option><option value="biometric">بيومتري</option><option value="both">يدوي وبيومتري</option></Select></Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {(["showLogo", "showSystemHeader", "showSystemFooter", "showQr", "showDigitalVerification"] as const).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={profile[key]} disabled={profile.defaultMode === "paper"} onChange={(e) => { setProfile((p) => ({ ...p, [key]: e.target.checked })); setDirty(true); }} />{key === "showLogo" ? "إظهار الشعار" : key === "showSystemHeader" ? "ترويسة النظام" : key === "showSystemFooter" ? "تذييل النظام" : key === "showQr" ? "رمز QR" : "بيانات التحقق الرقمي"}</label>)}
            </div>
          </div>
        </div>
        <div className="xl:sticky xl:top-0 xl:self-start">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black text-slate-900 dark:text-white">معاينة القالب</h3><Eye size={16} className="text-brand-600" /></div>
          <DocumentPreview title={name} html={previewHtml} number="DOC-PREVIEW" date={todayISO()} profile={profile} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><Button variant="ghost" onClick={close}>إلغاء</Button><Button onClick={() => void saveTemplate()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ القالب"}</Button></div>
    </Modal>
  );
}

function VariableManager({ variables, content, onChange }: { variables: TemplateVariable[]; content: string; onChange: (variables: TemplateVariable[]) => void }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<TemplateVariableType>("text");
  const [source, setSource] = useState<TemplateVariableSource>("manual");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const add = () => {
    const normalized = normalizeVariableKey(key);
    const error = validateVariableKey(normalized, variables);
    if (error) { toast("error", "متغير غير صالح", error); return; }
    if (!label.trim()) { toast("error", "أدخل اسم المتغير الظاهر"); return; }
    const options = type === "select" ? optionsText.split("\n").map((item) => item.trim()).filter(Boolean) : undefined;
    onChange([...variables, { key: normalized, label: label.trim(), type, source, required, options, order: variables.length }]);
    setKey(""); setLabel(""); setType("text"); setSource("manual"); setRequired(false); setOptionsText(""); setOpen(false);
  };

  const update = (variableKey: string, patch: Partial<TemplateVariable>) => onChange(variables.map((variable) => variable.key === variableKey ? { ...variable, ...patch } : variable));
  const remove = (variableKey: string) => {
    if (extractVariableKeys(content).includes(variableKey)) { toast("error", "لا يمكن حذف المتغير", "احذف موضع المتغير من النص أولاً"); return; }
    onChange(variables.filter((variable) => variable.key !== variableKey).map((variable, order) => ({ ...variable, order })));
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">متغيرات القالب</h3><p className="text-[11px] text-slate-400">أضف المتغير ثم أدرجه من شريط المحرر</p></div><Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}><Plus size={14} /> متغير جديد</Button></div>
      {variables.length > 0 && <div className="mt-3 space-y-2">{variables.map((variable) => <div key={variable.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{variable.label}</p><code className="text-[10px] text-brand-700" dir="ltr">{`{{${variable.key}}}`}</code></div><div className="flex items-center gap-1"><Select value={variable.type} onChange={(e) => update(variable.key, { type: e.target.value as TemplateVariableType })} className="h-8 text-xs">{TEMPLATE_VARIABLE_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</Select><label className="flex items-center gap-1 text-[10px] text-slate-500"><input type="checkbox" checked={variable.required} onChange={(e) => update(variable.key, { required: e.target.checked })} />مطلوب</label></div><button type="button" onClick={() => remove(variable.key)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="حذف المتغير"><XCircle size={16} /></button></div>)}</div>}
      {open && <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-900/10"><Field label="المفتاح" required><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="payment_method" dir="ltr" /></Field><Field label="الاسم الظاهر" required><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="طريقة السداد" /></Field><Field label="نوع القيمة"><Select value={type} onChange={(e) => setType(e.target.value as TemplateVariableType)}>{TEMPLATE_VARIABLE_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</Select></Field><Field label="مصدر القيمة"><Select value={source} onChange={(e) => setSource(e.target.value as TemplateVariableSource)}>{TEMPLATE_VARIABLE_SOURCES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</Select></Field>{type === "select" && <Field label="خيارات القائمة (كل خيار في سطر)"><Textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={2} placeholder="نقداً\nتحويل\nشيك" /></Field>}<label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />متغير مطلوب</label><div className="flex justify-end gap-2 sm:col-span-2"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button><Button size="sm" onClick={add}>إضافة المتغير</Button></div></div>}
    </div>
  );
}
