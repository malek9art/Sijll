/* ====== محرر المستند الاحترافي — Tiptap / RTL ====== */
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Node } from "@tiptap/core";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, FilePlus2, Heading2, Italic, List, ListOrdered, Minus, Redo2, RotateCcw, Table2, Underline as UnderlineIcon } from "lucide-react";
import { Button } from "@/components/ui";
import type { TemplateVariable } from "@/lib/types";

const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => ["div", { "data-page-break": "true" }],
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, json: Record<string, unknown>) => void;
  variables: TemplateVariable[];
  onInsertVariable: (key: string) => void;
  editable?: boolean;
  placeholder?: string;
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 px-0"
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({ value, onChange, variables, onInsertVariable, editable = true, placeholder = "اكتب نص المستند هنا…" }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      PageBreak,
    ],
    content: value || "<p></p>",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "document-editor-content",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML(), current.getJSON() as unknown as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === (value || "<p></p>")) return;
    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="grid min-h-72 place-items-center rounded-xl border border-slate-200 text-sm text-slate-400">جارٍ تجهيز المحرر…</div>;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {editable && (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/50">
            <ToolButton label="تراجع" onClick={() => editor.chain().focus().undo().run()}><RotateCcw size={15} /></ToolButton>
            <ToolButton label="إعادة" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolButton>
            <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <ToolButton label="عنوان فرعي" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolButton>
            <ToolButton label="عريض" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolButton>
            <ToolButton label="مائل" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolButton>
            <ToolButton label="تحته خط" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolButton>
            <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <ToolButton label="قائمة نقطية" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolButton>
            <ToolButton label="قائمة مرقمة" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolButton>
            <ToolButton label="محاذاة يمين" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={15} /></ToolButton>
            <ToolButton label="توسيط" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={15} /></ToolButton>
            <ToolButton label="محاذاة يسار" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={15} /></ToolButton>
            <ToolButton label="ضبط النص" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify size={15} /></ToolButton>
            <ToolButton label="إدراج فاصل نصي" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></ToolButton>
            <ToolButton label="فاصل صفحة" onClick={() => editor.chain().focus().insertContent({ type: "pageBreak" }).run()}><FilePlus2 size={15} /></ToolButton>
            <ToolButton label="إدراج جدول" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={15} /></ToolButton>
          </div>
          {variables.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
              <span className="ml-1 text-[10px] font-bold text-slate-400">إدراج متغير:</span>
              {variables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().insertContent(`{{${variable.key}}}`).run();
                    onInsertVariable(variable.key);
                  }}
                  title={variable.label}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
                >
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
