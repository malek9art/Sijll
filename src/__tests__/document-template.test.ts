import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { extractVariableKeys, legacyTextToHtml, missingRequiredVariables, normalizePrintProfile, replaceTemplateVariables, templateVariables } from "@/lib/document-template";

const baseTemplate = {
  id: "tpl-test",
  name: "اختبار",
  type: "custom" as const,
  content: "<p>إقرار {{party_name}}</p><p>{{custom_note}}</p>",
  isDefault: false,
  isBuiltin: false,
  createdAt: new Date().toISOString(),
};

describe("document template engine", () => {
  it("يستخرج المتغيرات ويضيف تعريفاً للمتغير المخصص", () => {
    const variables = templateVariables(baseTemplate);
    expect(extractVariableKeys(baseTemplate.content)).toEqual(["party_name", "custom_note"]);
    expect(variables.find((v) => v.key === "party_name")?.source).toBe("party");
    expect(variables.find((v) => v.key === "custom_note")?.source).toBe("manual");
  });

  it("يستبدل المتغيرات مع حماية HTML للقيم", () => {
    const html = replaceTemplateVariables("<p>{{custom_note}}</p>", { custom_note: "<script>alert(1)</script>" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("يحسب المتغيرات المطلوبة الناقصة", () => {
    const variables = templateVariables({ ...baseTemplate, variables: [{ key: "custom_note", label: "ملاحظة", type: "text", source: "manual", required: true, order: 0 }] });
    const missing = missingRequiredVariables({ ...baseTemplate, variables }, { party_name: "طرف" });
    expect(missing.map((v) => v.key)).toEqual(["custom_note"]);
  });

  it("يحوّل النص القديم إلى HTML ويحافظ على نمط الورق", () => {
    expect(legacyTextToHtml("سطر أول\n\nسطر ثانٍ")).toContain("<p>");
    const paper = normalizePrintProfile({ defaultMode: "paper" });
    expect(paper.showLogo).toBe(false);
    expect(paper.showQr).toBe(false);
    expect(DEFAULT_SETTINGS.baseCurrency).toBe("SAR");
  });
});
