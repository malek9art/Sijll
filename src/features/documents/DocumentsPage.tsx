/* ====== المستندات القانونية ====== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus, FileText, Printer, Trash2, Copy, LayoutTemplate, QrCode, Save, PenLine, MessageCircle,
} from "lucide-react";
import { db, documentsService } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useNavigate } from "@/lib/router";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Textarea } from "@/components/ui";
import { CURRENCIES, CURRENCY_KEYS, DOC_TYPES, DOC_TYPE_KEYS, type Currency, type DocParty, type DocType } from "@/lib/types";
import { fmtDate, PLACEHOLDERS, toDigits, todayISO } from "@/lib/utils";

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
                          <button title="تحقق QR" onClick={() => navigate(`verify/${d.number}`)} className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 cursor-pointer"><QrCode size={15} /></button>
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
            {templates.map((t) => (
              <Card key={t.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-lg dark:bg-brand-500/10">{DOC_TYPES[t.type].icon}</div>
                  {t.isDefault && <Badge className="bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">افتراضي</Badge>}
                </div>
                <p className="mt-3 font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="mt-1 line-clamp-3 flex-1 text-xs leading-6 text-slate-400">{t.content.replace(/\{\{[\w]+\}\}/g, "…")}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setTemplateEditor(t.id)}><PenLine size={13} /> تحرير</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const copy = { ...t, id: `tpl-${Date.now()}`, name: `${t.name} (نسخة)`, isBuiltin: false, isDefault: false };
                    await db.templates.add(copy);
                    toast("success", "تم نسخ القالب");
                  }}><Copy size={13} /></Button>
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
        <TemplateEditor templateId={templateEditor} onClose={() => setTemplateEditor(null)} />
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

/* ====== محرر المستند ====== */
function DocEditor({ docId, templates, parties, onClose, onSaved }: {
  docId: string | null; templates: { id: string; name: string; type: DocType; content: string }[];
  parties: { id: string; name: string; idNumber?: string; idType?: string }[]; onClose: () => void; onSaved: (id: string, print: boolean) => void;
}) {
  const { settings, toast } = useApp();
  const existing = useLiveQuery(() => (docId ? db.documents.get(docId) : undefined), [docId]);
  const [docType, setDocType] = useState<DocType>(existing?.type || "acknowledgment");
  const [templateId, setTemplateId] = useState(existing?.templateId || "");
  const [title, setTitle] = useState(existing?.title || "");
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const [amount, setAmount] = useState(existing?.amount ? String(existing.amount) : "");
  const [currency, setCurrency] = useState<Currency>(existing?.currency || settings.baseCurrency);
  const [date, setDate] = useState(existing?.date || todayISO());
  const [dueDate, setDueDate] = useState(existing?.dueDate || "");
  const [reason, setReason] = useState(existing?.reason || "");
  const [witness1, setWitness1] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الأول"))?.name || "");
  const [witness1Id, setWitness1Id] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الأول"))?.idNumber || "");

  /* تهيئة الحقول عند تحميل المستند الموجود (استعلام غير متزامن) */
  useEffect(() => {
    if (existing) {
      setDueDate((v) => v || existing.dueDate || "");
      setReason((v) => v || existing.reason || "");
    }
  }, [existing]);
  const [witness2, setWitness2] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الثاني"))?.name || "");
  const [witness2Id, setWitness2Id] = useState(existing?.parties.find((p) => p.role.includes("الشاهد الثاني"))?.idNumber || "");
  const [body, setBody] = useState(existing?.body || "");
  const [printAfter, setPrintAfter] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = templates.filter((t) => t.type === docType);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t) { setTemplateId(id); setBody(t.content); }
  };

  const insertPlaceholder = (key: string) => {
    const area = areaRef.current;
    if (!area) return;
    const start = area.selectionStart ?? body.length;
    const end = area.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + `{{${key}}}` + body.slice(end));
    requestAnimationFrame(() => { area.focus(); area.selectionStart = area.selectionEnd = start + key.length + 4; });
  };

  const save = async (print: boolean) => {
    if (!templateId || !body.trim()) { toast("error", "أكمل البيانات", "اختر قالباً وأدخل النص"); return; }
    const docParties: DocParty[] = [];
    const party = parties.find((p) => p.id === partyId);
    if (party) docParties.push({ role: "الطرف الثاني", name: party.name, idNumber: party.idNumber, idType: party.idType });
    if (witness1.trim()) docParties.push({ role: "الشاهد الأول", name: witness1.trim(), idNumber: witness1Id.trim() || undefined });
    if (witness2.trim()) docParties.push({ role: "الشاهد الثاني", name: witness2.trim(), idNumber: witness2Id.trim() || undefined });
    const doc = await documentsService.save({
      type: docType, title: title.trim() || templates.find((t) => t.id === templateId)?.name || "مستند",
      templateId, partyId: partyId || undefined, amount: amount ? parseFloat(amount) : undefined, currency, date,
      dueDate: dueDate || undefined, reason: reason.trim() || undefined,
      body, parties: docParties, status: "final",
    }, docId || undefined);
    onSaved(doc.id, print);
  };

  return (
    <Modal open onClose={onClose} title={docId ? "تعديل المستند" : "مستند قانوني جديد"} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نوع المستند" required>
          <Select value={docType} onChange={(e) => {
            const t = e.target.value as DocType;
            setDocType(t);
            const first = templates.find((x) => x.type === t);
            if (first) applyTemplate(first.id);
          }}>
            {DOC_TYPE_KEYS.map((k) => <option key={k} value={k}>{DOC_TYPES[k].icon} {DOC_TYPES[k].label}</option>)}
          </Select>
        </Field>
        <Field label="القالب" required>
          <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— اختر القالب —</option>
            {filtered.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="عنوان المستند" className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: إقرار دين — أحمد العريقي" />
        </Field>
        <Field label="الطرف (اختياري)">
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">— بدون طرف —</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="العملة">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCY_KEYS.map((c) => <option key={c} value={c}>{CURRENCIES[c].label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ التحرير">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="تاريخ الاستحقاق">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="سبب الدين / البيان" className="sm:col-span-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: قرض نقدي بموجب عقد مؤرخ..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الشاهد الأول">
            <Input value={witness1} onChange={(e) => setWitness1(e.target.value)} placeholder="اسم الشاهد" />
          </Field>
          <Field label="رقم هوية الشاهد الأول (اختياري)">
            <Input value={witness1Id} onChange={(e) => setWitness1Id(e.target.value)} placeholder="رقم الهوية" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الشاهد الثاني">
            <Input value={witness2} onChange={(e) => setWitness2(e.target.value)} placeholder="اسم الشاهد" />
          </Field>
          <Field label="رقم هوية الشاهد الثاني (اختياري)">
            <Input value={witness2Id} onChange={(e) => setWitness2Id(e.target.value)} placeholder="رقم الهوية" />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <Label>نص المستند</Label>
            <span className="text-[10px] text-slate-400">اضغط على أي عنصر نائب لإدراجه في موضع المؤشر</span>
          </div>
          <Textarea ref={areaRef} value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-doc text-[13px] leading-8" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((p) => (
              <button key={p.key} onClick={() => insertPlaceholder(p.key)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10.5px] font-semibold text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-brand-500/10 cursor-pointer"
                title={p.label}>
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          فتح نافذة الطباعة بعد الحفظ
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="outline" onClick={() => save(false)}><Save size={15} /> حفظ</Button>
          <Button onClick={() => save(printAfter)}><Printer size={15} /> حفظ وطباعة</Button>
        </div>
      </div>
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{children}</span>;
}

/* ====== محرر القالب ====== */
function TemplateEditor({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const tpl = useLiveQuery(() => db.templates.get(templateId), [templateId]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const { toast } = useApp();
  if (!tpl) return null;
  return (
    <Modal open onClose={onClose} title={`تحرير القالب: ${tpl.name}`} wide>
      <div className="space-y-4">
        <Field label="اسم القالب">
          <Input defaultValue={tpl.name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="نص القالب">
          <Textarea defaultValue={tpl.content} onChange={(e) => setContent(e.target.value)} rows={16} className="font-doc text-[13px] leading-8" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <span key={p.key} className="rounded-lg bg-slate-100 px-2 py-1 text-[10.5px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400" title={p.label}>
              {`{{${p.key}}}`}
            </span>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={async () => {
            await db.templates.update(templateId, { name: name || tpl.name, content });
            onClose();
            toast("success", "تم حفظ القالب");
          }}><Save size={15} /> حفظ القالب</Button>
        </div>
      </div>
    </Modal>
  );
}
