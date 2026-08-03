/* ====== بيانات التهيئة: دليل الحسابات، القوالب القانونية المحترفة، الحساب الشخصي ====== */
import type { Account, Debt, DocTemplate, JournalEntry, LegalDoc, LedgerAccount, LedgerEntry, Party } from "./types";
import { uid } from "./utils";

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: "acc-assets", code: "1000", name: "الأصول", type: "asset", openingBalance: 0, isActive: true },
  { id: "acc-cash", code: "1100", name: "النقدية (الصندوق)", type: "asset", parentId: "acc-assets", openingBalance: 25000, isActive: true },
  { id: "acc-bank", code: "1200", name: "البنوك والحسابات البنكية", type: "asset", parentId: "acc-assets", openingBalance: 75000, isActive: true },
  { id: "acc-debtors", code: "1300", name: "الذمم المدينة (مدينون)", type: "asset", parentId: "acc-assets", openingBalance: 0, isActive: true },
  { id: "acc-fixed", code: "1400", name: "الأصول الثابتة", type: "asset", parentId: "acc-assets", openingBalance: 0, isActive: true },
  { id: "acc-liabs", code: "2000", name: "الخصوم", type: "liability", openingBalance: 0, isActive: true },
  { id: "acc-payables", code: "2100", name: "الذمم الدائنة (دائنون)", type: "liability", parentId: "acc-liabs", openingBalance: 0, isActive: true },
  { id: "acc-loans", code: "2200", name: "قروض", type: "liability", parentId: "acc-liabs", openingBalance: 0, isActive: true },
  { id: "acc-equity", code: "3000", name: "حقوق الملكية", type: "equity", openingBalance: 0, isActive: true },
  { id: "acc-capital", code: "3100", name: "رأس المال", type: "equity", parentId: "acc-equity", openingBalance: 100000, isActive: true },
  { id: "acc-income", code: "4000", name: "الإيرادات", type: "income", openingBalance: 0, isActive: true },
  { id: "acc-revenue", code: "4100", name: "إيرادات النشاط", type: "income", parentId: "acc-income", openingBalance: 0, isActive: true },
  { id: "acc-other-inc", code: "4200", name: "إيرادات أخرى", type: "income", parentId: "acc-income", openingBalance: 0, isActive: true },
  { id: "acc-expense", code: "5000", name: "المصاريف", type: "expense", openingBalance: 0, isActive: true },
  { id: "acc-salaries", code: "5100", name: "رواتب وأجور", type: "expense", parentId: "acc-expense", openingBalance: 0, isActive: true },
  { id: "acc-rent", code: "5200", name: "إيجارات", type: "expense", parentId: "acc-expense", openingBalance: 0, isActive: true },
  { id: "acc-general", code: "5300", name: "مصاريف عمومية وإدارية", type: "expense", parentId: "acc-expense", openingBalance: 0, isActive: true },
  { id: "acc-legal", code: "5400", name: "مصاريف قانونية", type: "expense", parentId: "acc-expense", openingBalance: 0, isActive: true },
];

/* ====== القوالب القانونية — صياغة احترافية محكمة ====== */
export const DEFAULT_TEMPLATES: DocTemplate[] = [
  {
    id: "tpl-ack",
    name: "إقرار دين",
    type: "acknowledgment",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `إقـــرار بمديونيــة والتــزام بالســداد

الحمد لله وحده، وبعد:

في يوم {{date_gregorian}} الموافق {{date_hijri}}، أقر أنا الموقع أدناه:
الاسم: {{party_name}}
الجنسية: {{party_nationality}} — رقم الهوية: {{party_id}}
محل الإقامة: {{party_address}} — الهاتف: {{party_phone}}

إقراراً صحيحاً صريحاً لا رجعة فيه ولا نكول، وبكامل أهليتي المعتبرة شرعاً ونظاماً، وسلامة إرادتي وخلوها من أي إكراه أو غبن أو غلط:

أولاً: أقر بأن في ذمتي ومسؤوليتي المالية، لصالح: {{org_name}}، مبلغاً قدره:
{{amount_words}}
(بالأرقام: {{amount}} {{currency}})، وذلك بموجب {{debt_reason}}.

ثانياً: ألتزم بسداد المبلغ المذكور كاملاً دون أي نقصان أو خصم، وبدون أي فوائد أو زيادة من أي نوع كانت، ويبرأ طرف من ذمتي بقدر ما يثبت سداده بموجب سندات قبض أو إيصالات رسمية.

ثالثاً: يُعد هذا الإقرار حجة قاطعة في مواجهتي، وسنداً مثبتاً للدين لا يحول دون المطالبة به دونه، ويحق للدائن التمسك به أمام أي جهة مختصة، كما يصح الرجوع عليّ بكامل المبلغ أو ما تبقى منه دون حاجة إلى إثبات إضافي.

رابعاً: أي سداد جزئي لا يُعد إسقاطاً لما تبقى من الدين، ولا تجديدًا للالتزام، ويبقى الأصل قائماً حتى الوفاء الكامل.

خامساً: حُرر هذا الإقرار برضا الطرفين وبكامل إرادتهما، وخضع لأحكام القوانين النافذة، ولا يتضمن أي شرط مخالف للنظام العام أو الشريعة الإسلامية.

حرر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

المقر بما فيه: {{party_name}}
التوقيع والبصمة: ____________________`,
  },
  {
    id: "tpl-commit",
    name: "تعهد بسداد",
    type: "commitment",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `تعهــد والتــزام بســداد مبلــغ

أنا الموقع أدناه:
{{party_name}} — رقم الهوية: {{party_id}} — العنوان: {{party_address}} — الهاتف: {{party_phone}}

أتعهد وألتزم بموجب هذا المستند، وبكامل إرادتي واختياري، تجاه: {{org_name}}، بما يلي:

أولاً: سداد المبلغ الثابت في ذمتي وقدره: {{amount_words}} (بالأرقام: {{amount}} {{currency}})، سداداً كاملاً ناجزاً، دون أي فوائد أو تحميلات إضافية.

ثانياً: إتمام السداد في موعد أقصاه {{due_date}}، ويجوز لي السداد قبل هذا الموعد أو على دفعات متتالية، على أن يُحتسب كل سداد من أصل المبلغ.

ثالثاً: في حال إخلالي بهذا التعهد، يحق للدائن مطالبة ذمتي بكافة الطرق النظامية المشروعة، ويظل هذا التعهد قائماً منتجاً لآثاره حتى الوفاء الكامل.

رابعاً: أتحمل بموجب هذا التعهد صحة البيانات الواردة أعلاه، وأقر بأن التوقيع أدناه توقيعي الصحيح المعتمد لديّ.

حرر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

المتعهد الملتزم: {{party_name}}
التوقيع: ____________________`,
  },
  {
    id: "tpl-settle",
    name: "اتفاقية تسوية",
    type: "settlement",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `اتفاقيــة تســوية نهائيــة للمديونيــة

الطرف الأول: {{org_name}} — {{org_address}} — هاتف: {{org_phone}}
الطرف الثاني: {{party_name}} — رقم الهوية: {{party_id}} — العنوان: {{party_address}} — الهاتف: {{party_phone}}

تمهيد: حيث أن الطرف الثاني مدين للطرف الأول بمبالغ ناشئة عن {{debt_reason}}، وحيث رغب الطرفان في تسوية نهائية ودية تحفظ الحقوق وتنهي النزاع، فقد اتفقا — بعد تمام الأهلية وحرية الإرادة — على ما يلي:

المادة الأولى: يقر الطرف الثاني إقراراً قطعياً بمديونيته للطرف الأول بمبلغ إجمالي قدره: {{amount_words}} (بالأرقام: {{amount}} {{currency}})، ويعد هذا الإقرار سنداً ملزماً له.

المادة الثانية: يلتزم الطرف الثاني بسداد المبلغ المذكور سداداً كاملاً في موعد غايته {{due_date}}، ولا تُحتسب على المبلغ أي فوائد أو زيادات من أي نوع.

المادة الثالثة: يجوز للطرف الثاني السداد على دفعات، ويُعد كل مبلغ يُسدد إبراءً جزئياً للذمة بقدره، ولا يسقط الالتزام بالباقي.

المادة الرابعة: هذه التسوية نهائية وقاطعة للنزاع حول موضوعها؛ فبمجرد الوفاء الكامل وفق المادة الثانية، تُبرأ ذمة الطرف الثاني براءة تامة ولا تبقى للطرف الأول أي مطالبة متعلقة بها.

المادة الخامسة: في حال إخلال الطرف الثاني بأي التزام جوهري هنا، يحق للطرف الأول اعتبار التسوية منفسخة من تلقاء نفسها والمطالبة بكامل حقه أصلاً دون أي إسقاط، مع احتفاظه بكافة حقوقه الأخرى.

المادة السادسة: حُررت هذه الاتفاقية من نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها، وخضعت لأحكام القوانين النافذة.

حررت بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

الطرف الأول: {{org_name}} — التوقيع: ____________
الطرف الثاني: {{party_name}} — التوقيع: ____________`,
  },
  {
    id: "tpl-notice",
    name: "إنذار قانوني",
    type: "notice",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `إنــذار ومطالبــة بالوفــاء

إلى السيد/ {{party_name}}
العنوان: {{party_address}} — الهاتف: {{party_phone}}

الموضوع: مطالبة بسداد مبلغ مستحق قدره {{amount}} {{currency}}

تحية طيبة وبعد،

بالإشارة إلى {{debt_reason}}، وبما أن المبلغ المشار إليه قد استحق في ذمتكم لصالح: {{org_name}}، ولم يتم الوفاء به حتى تاريخه رغم المطالبات؛

لذا نلفت نظركم بموجب هذا الإنذار إلى أن المبلغ المستحق عليكم يبلغ: {{amount_words}} (بالأرقام: {{amount}} {{currency}})، ونطالبكم بالوفاء به كاملاً خلال مدة أقصاها خمسة عشر (١٥) يوماً من تاريخ تبلغكم هذا الإنذار، دون تحميلكم أي فوائد أو زيادات.

وفي حال انقضاء المدة المذكورة دون سداد، سنضطر آسفين لاتخاذ ما يلزم من إجراءات نظامية مشروعة للمطالبة بحقنا، مع احتفاظنا بكافة الحقوق الأخرى، وتحميلكم ما يترتب على ذلك من تكاليف.

نأمل اعتبار هذا الإنذار فرصة أخيرة للوفاء الودي وتجنيب الطرفين عناء الإجراءات.

صدر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

الصادر عنه: {{org_name}}
التوقيع: ____________________`,
  },
  {
    id: "tpl-poa",
    name: "توكيل",
    type: "poa",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `وكالــة وتفعيــض

أنا الموقع أدناه: {{party_name}} — الجنسية: {{party_nationality}} — رقم الهوية: {{party_id}} — العنوان: {{party_address}} — الهاتف: {{party_phone}}

أقر بموجب هذا المستند، وأنا بكامل أهليتي المعتبرة شرعاً ونظاماً، أنني قد وكلت وفوضت:
الاسم: {{org_name}} — العنوان: {{org_address}} — الهاتف: {{org_phone}}

وكالة خاصة في متابعة واستيفاء حوقي المالية، ولا سيما المطالبة بمبلغ: {{amount_words}} (بالأرقام: {{amount}} {{currency}}) الناشئ عن {{debt_reason}}، وله في سبيل ذلك:

أولاً: مراجعة الجهات الرسمية وغير الرسمية، وتقديم الطلبات والمستندات، والتوقيع عليها، واستلام الردود.

ثانياً: التفاوض والتسوية والصلح، وقبض المبالغ المستحقة لي وإبراء الذمم بقدر المقبوض، وتوقيع الإيصالات والمخالصات اللازمة.

ثالثاً: تفويض الغير في بعض ما ذُكر أعلاه بما لا يتجاوز حدود هذه الوكالة.

وتظل هذه الوكالة سارية حتى إتمام موضوعها أو إلغائها كتابة من قبلي، ولا يُعد سكوتي إلغاءً لها.

حرر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

الموكل: {{party_name}}
التوقيع: ____________________`,
  },
  {
    id: "tpl-receipt",
    name: "سند قبض",
    type: "receipt",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `سنــد قبــض وإبــراء جزئــي

أقر أنا: {{org_name}} — {{org_address}} — هاتف: {{org_phone}}

بأنني استلمت من السيد/ {{party_name}} — رقم الهوية: {{party_id}} — مبلغاً وقدره:
{{amount_words}}
(بالأرقام: {{amount}} {{currency}})

وذلك سداداً عن {{debt_reason}}، وبموجب هذا السند تُبرأ ذمة السيد/ {{party_name}} من المبلغ المقبوض فقط، ويبقى ما عدا ذلك قائماً في ذمته حتى الوفاء الكامل.

حرر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

المستلم: {{org_name}}
التوقيع: ____________________`,
  },
  {
    id: "tpl-release",
    name: "إخلاء طرف",
    type: "release",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `إخــلاء طرف وإبــراء نهائــي للذمــة

نحن: {{org_name}} — {{org_address}}

نشهد ونقر بموجب هذا المستند بأن السيد/ {{party_name}} — رقم الهوية: {{party_id}} — قد أوفى بجميع التزاماته المالية تجاهنا الناشئة عن {{debt_reason}}، والبالغة إجمالاً: {{amount_words}} (بالأرقام: {{amount}} {{currency}})، وقد تم استيفاء كامل المبلغ بتاريخ {{date_gregorian}}.

وعليه، فقد برئت ذمة المذكور براءة تامة كاملة من كل حق مالي أو مطالبة ناشئة عن الموضوع المشار إليه حتى تاريخه، ولا يبقى لنا قِبله أي حق أو دعوى أو مطالبة، ونُسقط بموجبه حق الرجوع عليه به مستقبلاً.

حُرر هذا الإخلاء ليُعمل به لدى من يلزم، وهو حجة علينا بما ورد فيه.

صدر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

الصادر عنه: {{org_name}}
التوقيع: ____________________`,
  },
  {
    id: "tpl-contract",
    name: "عقد اتفاق",
    type: "contract",
    isDefault: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    content: `عقــد اتفــاق والتــزام متبادــل

الطرف الأول: {{org_name}} — {{org_address}} — هاتف: {{org_phone}}
الطرف الثاني: {{party_name}} — رقم الهوية: {{party_id}} — العنوان: {{party_address}} — الهاتف: {{party_phone}}

بعد أن أقر الطرفان بأهليتهما الشرعية والنظامية للتعاقد، ورضا كل منهما بما تضمنه هذا العقد، اتفقا على ما يلي:

المادة الأولى (الموضوع): ينظم هذا العقد الالتزام المالي الناشئ عن: {{debt_reason}}.

المادة الثانية (قيمة الالتزام): يلتزم الطرف الثاني لصالح الطرف الأول بمبلغ إجمالي قدره: {{amount_words}} (بالأرقام: {{amount}} {{currency}})، دون أي فوائد أو تحميلات.

المادة الثالثة (الأجل): يكون الوفاء بالالتزام في موعد أقصاه {{due_date}}، ويجوز السداد قبله أو على دفعات يُحتسب كل منها من أصل المبلغ.

المادة الرابعة (الإثبات): تُثبت الدفعات بموجب سندات قبض أو إيصالات مكتوبة، ولا يُعتد بأي سداد غير موثق.

المادة الخامسة (الإخلال): في حال إخلال أي طرف بالتزام جوهري هنا، يحق للطرف الآخر المطالبة بالتنفيذ أو التعويض المشروع وفق الأنظمة النافذة.

المادة السادسة (أحكام عامة): هذا العقد ملزم للطرفين وخلفائهما، ولا يعدل إلا كتابة وباتفاق الطرفين، وحُرر من نسختين بيد كل طرف نسخة للعمل بها.

حرر بتاريخ {{date_gregorian}} الموافق {{date_hijri}}.

الطرف الأول: {{org_name}} — التوقيع: ____________
الطرف الثاني: {{party_name}} — التوقيع: ____________

الشاهد الأول: {{witness1}} — التوقيع: ____________
الشاهد الثاني: {{witness2}} — التوقيع: ____________`,
  },
];

/* ====== الحساب الشخصي الافتراضي: كشف الحساب الموحد (25 عملية) ====== */
export const ABDULAZIZ_NAME = "عبدالعزيز عبدالغني سلطان عبدالولي عبده";

interface SeedOp {
  date: string;
  entity: string;
  ref: string;
  desc: string;
  credit: number;
  debit?: number;
  group?: string;
  groupLabel?: string;
}

export const ABDULAZIZ_OPS: SeedOp[] = [
  { date: "2025-07-02", entity: "تحويل بنكي", ref: "FT25183NW98X", desc: "تحويل من عبدالباقي علي ناجي القدسي إلى عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 1001.25 },
  { date: "2025-10-14", entity: "عالم الصرافة", ref: "3127310439", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 200 },
  { date: "2025-10-21", entity: "عالم الصرافة", ref: "1554091197", desc: "تم التحويل بتوجيهكم إلى عبدالعزيز عبدالغني سلطان عبدالولي عبده المرسل مالك أحمد عبدالله علي الوصابي", credit: 150 },
  { date: "2025-11-11", entity: "شبكة الامتياز إكسبرس", ref: "1163185546", desc: "تم التحويل بتوجيهكم إلى محمد عفيف مهيوب أحمد قاسم", credit: 200 },
  { date: "2025-11-27", entity: "تعويض", ref: "لا يوجد", desc: "تعويض خسارة الأخ عبدالمجيد سفره من ظهران الجنوب ذهابا وإيابا وذلك لعرض مجوهرات تابعة لعبد العزيز ثقة بكلامه بأنها أصلية وأثبت أنها مقلدة", credit: 1800 },
  { date: "2025-11-28", entity: "براق ويسترن يونيون", ref: "0263146212", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 200 },
  { date: "2025-12-03", entity: "براق ويسترن يونيون", ref: "4657045007", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 2000 },
  { date: "2025-12-05", entity: "براق ويسترن يونيون", ref: "5342060467", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 1500 },
  { date: "2025-12-24", entity: "براق ويسترن يونيون", ref: "3607177658", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 500 },
  { date: "2026-01-05", entity: "براق ويسترن يونيون", ref: "4304379267", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 500 },
  { date: "2026-01-07", entity: "براق ويسترن يونيون", ref: "8621684386", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 1000 },
  { date: "2026-01-08", entity: "دادية أون لاين", ref: "9950174700", desc: "تم التحويل بتوجيهكم إلى محمد عفيف مهيوب أحمد قاسم", credit: 2500 },
  { date: "2026-01-11", entity: "إقرار والتزام", ref: "لا يوجد", desc: "الحركة الأولى: سداد الرصيد الفعلي المحسوب من العمليات السابقة", credit: 0, debit: 11551.25, group: "grp-ack", groupLabel: "قيد الإقرار المحاسبي المزدوج — إقرار بالدين وتسوية الحساب مع عبدالعزيز عبدالغني سلطان عبدالولي عبده" },
  { date: "2026-01-11", entity: "إقرار والتزام", ref: "لا يوجد", desc: "الحركة الثانية: إقرار عبدالعزيز عبدالغني سلطان عبدالولي عبده بالمديونية لمالك أحمد عبدالله علي الوصابي بالكامل بمبلغ 35,314 ريال سعودي وتم اعتماد هذا الرصيد كرصيد افتتاحي جديد", credit: 35314, debit: 0, group: "grp-ack" },
  { date: "2026-01-12", entity: "بنك الكريمي", ref: "3136244287", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان", credit: 401.88 },
  { date: "2026-01-17", entity: "براق ويسترن يونيون", ref: "4947450806", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 150 },
  { date: "2026-01-17", entity: "شبكة الامتياز إكسبرس", ref: "1192205516", desc: "تم التحويل بتوجيهكم إلى محمد منصور سرحان علي الحميري", credit: 1500 },
  { date: "2026-01-17", entity: "سند قيد بسيط", ref: "لا يوجد", desc: "إلى حساب نايف سلطان عبد الولي عبده الأحمدي ضمانة مالك بالسداد", credit: 15673.55 },
  { date: "2026-01-18", entity: "شبكة الامتياز إكسبرس", ref: "1198916634", desc: "تم التحويل بتوجيهكم إلى محمد منصور سرحان علي الحميري", credit: 1500 },
  { date: "2026-01-23", entity: "براق ويسترن يونيون", ref: "8575152594", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 300 },
  { date: "2026-01-28", entity: "براق ويسترن يونيون", ref: "6029763290", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 600 },
  { date: "2026-02-01", entity: "الشبكة الموحدة للأموال", ref: "1534097279", desc: "تم التحويل بتوجيهكم إلى مروى عبدالعليم محمد عبده", credit: 2380 },
  { date: "2026-02-06", entity: "براق ويسترن يونيون", ref: "6677611671", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 150 },
  { date: "2026-02-07", entity: "براق ويسترن يونيون", ref: "2136078327", desc: "تحويل لصالح عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 200 },
  { date: "2026-02-16", entity: "براق ويسترن يونيون", ref: "3288768734", desc: "تحويل من مالك أحمد عبدالله علي الوصابي إلى عبدالعزيز عبدالغني سلطان عبدالولي عبده", credit: 300 },
  { date: "2026-02-17", entity: "سند قيد بسيط", ref: "لا يوجد", desc: "إلى حساب الصندوق الرئيسي حوالة عبدالعزيز عبدالغني سلطان عبدالولي عبده من عالم الصرافة ضمانة مالك بالسداد", credit: 10000 },
];

export async function seedIfEmpty(): Promise<void> {
  const { db } = await import("./db");
  const seeded = await db.settings.get("seeded");
  if (seeded) return;

  await db.transaction(
    "rw",
    [
      db.accounts, db.templates, db.settings, db.parties, db.debts, db.payments,
      db.journalEntries, db.documents, db.notifications, db.ledgerAccounts, db.ledgerEntries,
    ],
    async () => {
      await db.accounts.bulkPut(DEFAULT_ACCOUNTS);
      await db.templates.bulkPut(DEFAULT_TEMPLATES);

      const now = new Date().toISOString();

      const pAziz: Party = {
        id: uid("pty"), name: ABDULAZIZ_NAME, type: "individual",
        idType: "بطاقة شخصية", idNumber: "", phone: "", address: "المملكة العربية السعودية",
        nationality: "يمنية", notes: "حساب مديونية متابعة — كشف حساب موحد", createdAt: now,
      };
      await db.parties.bulkPut([pAziz]);

      const laccAziz: LedgerAccount = {
        id: uid("lacc"), name: ABDULAZIZ_NAME, currency: "SAR", type: "receivable",
        notes: "كشف حساب موحد — 25 عملية بترتيبها الزمني (من 02/07/2025 إلى 17/02/2026)", createdAt: now,
      };
      await db.ledgerAccounts.add(laccAziz);

      const entries: LedgerEntry[] = ABDULAZIZ_OPS.map((op, i) => ({
        id: uid("lent"),
        accountId: laccAziz.id,
        seq: i + 1,
        date: op.date,
        entity: op.entity,
        reference: op.ref,
        description: op.desc,
        credit: op.credit,
        debit: op.debit || 0,
        groupId: op.group,
        groupLabel: op.groupLabel,
        createdAt: now,
      }));
      await db.ledgerEntries.bulkAdd(entries);

      const debtAziz: Debt = {
        id: uid("debt"), number: "DEBT-0001", type: "receivable", partyId: pAziz.id,
        amount: 68469.43, currency: "SAR", date: "2026-02-17", status: "active",
        reason: "إجمالي المديونية المقر بها وفق كشف الحساب الموحد حتى 17/02/2026 (رصيد افتتاحي 35,314 ر.س + عمليات لاحقة)",
        createdAt: now, updatedAt: now,
      };
      await db.debts.bulkPut([debtAziz]);

      const acc = (code: string) => DEFAULT_ACCOUNTS.find((a) => a.code === code)!;
      const mk = (n: string, date: string, description: string, lines: { a: string; d: number; c: number }[]): JournalEntry => ({
        id: uid("je"), number: n, date, description, currency: "SAR" as const,
        lines: lines.map((l) => ({ accountId: acc(l.a).id, debit: l.d, credit: l.c })),
        createdAt: now,
      });
      await db.journalEntries.bulkPut([
        mk("JE-0001", "2026-01-11", "قيد الإقرار المحاسبي المزدوج — رصيد افتتاحي معتمد 35,314 ر.س (عبدالعزيز عبدالغني سلطان عبدالولي عبده)", [{ a: "1300", d: 35314, c: 0 }, { a: "4100", d: 0, c: 35314 }]),
        mk("JE-0002", "2026-02-17", "زيادة المديونية — عمليات لاحقة حتى 17/02/2026 بمبلغ 33,155.43 ر.س", [{ a: "1300", d: 33155.43, c: 0 }, { a: "4100", d: 0, c: 33155.43 }]),
      ]);

      const doc: LegalDoc = {
        id: uid("doc"), number: "DOC-0001", type: "acknowledgment",
        title: "إقرار مديونية — عبدالعزيز عبدالغني سلطان عبدالولي عبده",
        templateId: "tpl-ack", partyId: pAziz.id, amount: 68469.43, currency: "SAR",
        date: "2026-02-17", dueDate: "2026-05-17",
        reason: "إجمالي المديونية المقر بها وفق كشف الحساب الموحد حتى 17/02/2026",
        body: DEFAULT_TEMPLATES[0].content,
        parties: [{ role: "الطرف الثاني", name: ABDULAZIZ_NAME, idType: "بطاقة شخصية" }],
        status: "final", history: [{ at: now, action: "إنشاء" }], createdAt: now, updatedAt: now,
      };
      await db.documents.put(doc);

      await db.settings.bulkPut([
        { key: "seeded", value: true },
        { key: "counter:DEBT", value: 1 },
        { key: "counter:DOC", value: 1 },
        { key: "counter:JE", value: 2 },
      ]);
    }
  );
}
