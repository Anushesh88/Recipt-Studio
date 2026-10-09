import { describe, it, expect } from "vitest";
import { canvasSchema } from "../src/schema/templateSchema";
import { FONT_FAMILIES } from "../src/lib/units";

describe("Canvas Schema", () => {
  const validPage = { preset: "thermal80" as const, width: 302, height: 640, heightMode: "auto" as const, background: "#FFFFFF", margin: 12 };
  
  const validText = {
    id: "el_1", type: "text" as const, x: 10, y: 10, width: 100, height: 20, zIndex: 1, locked: false,
    props: { content: "Hello {{customer.name}}", fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "#000000", align: "left" as const, lineHeight: 1.3 }
  };

  const validItemsTable = (idSuffix = "1") => ({
    id: `table_${idSuffix}`, type: "items_table" as const, x: 10, y: 50, width: 280, height: 100, zIndex: 2, locked: false,
    props: {
      binding: "receipt.items" as const,
      columns: [{ key: "desc", label: "Desc", width: 1.0, align: "left" as const }],
      fontFamily: "Inter", fontSize: 12, lineHeight: 1.3, rowPadding: 4, headerBold: true, rowDivider: true, color: "#000000"
    }
  });

  it("should validate a valid canvas", () => {
    const result = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [validText, validItemsTable()]
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown variables", () => {
    const textWithUnknownVar = {
      ...validText,
      props: { ...validText.props, content: "Hello {{unknown.var}}" }
    };
    const result = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [textWithUnknownVar]
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(e => e.message.includes("Unknown variables"))).toBe(true);
    }
  });

  it("should reject a second items_table", () => {
    const result = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [validItemsTable("1"), validItemsTable("2")]
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(e => e.message.includes("Max one items_table"))).toBe(true);
    }
  });

  it("should reject unknown element types", () => {
    const result = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [{ id: "el_1", type: "unknown_type", x: 10, y: 10, width: 100, height: 20, props: {} }]
    });
    expect(result.success).toBe(false);
  });

  it("should reject out-of-range values", () => {
    const resultX = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [{ ...validText, x: -10 }]
    });
    expect(resultX.success).toBe(false);

    const resultFontSize = canvasSchema.safeParse({
      schemaVersion: 1,
      page: validPage,
      elements: [{ ...validText, props: { ...validText.props, fontSize: 5 } }]
    });
    expect(resultFontSize.success).toBe(false);
  });

  const messages = (input: unknown) => {
    const result = canvasSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("should reject duplicate element ids", () => {
    expect(messages({ schemaVersion: 1, page: validPage, elements: [validText, { ...validText }] }))
      .toContain("Duplicate element id: el_1");
  });

  it("should reject elements past the page width", () => {
    expect(messages({ schemaVersion: 1, page: validPage, elements: [{ ...validText, x: 250 }] }))
      .toContain("Element el_1 extends past the page width");
  });

  it("should bound the height only on fixed-height pages", () => {
    const low = { ...validText, y: 700 }; // below the 640px design height
    expect(messages({ schemaVersion: 1, page: validPage, elements: [low] })).toEqual([]);

    const fixedPage = { preset: "a5" as const, width: 559, height: 794, heightMode: "fixed" as const, background: "#FFFFFF", margin: 24 };
    expect(messages({ schemaVersion: 1, page: fixedPage, elements: [{ ...validText, y: 780 }] }))
      .toContain("Element el_1 extends past the page height");
  });

  it("should accept only the curated fonts", () => {
    for (const family of FONT_FAMILIES) {
      expect(messages({ schemaVersion: 1, page: validPage, elements: [{ ...validText, props: { ...validText.props, fontFamily: family } }] })).toEqual([]);
    }
    expect(canvasSchema.safeParse({
      schemaVersion: 1, page: validPage,
      elements: [{ ...validText, props: { ...validText.props, fontFamily: "Comic Sans MS" } }],
    }).success).toBe(false);
  });

  it("should reject templates over 256 KB", () => {
    const big = { ...validText, props: { ...validText.props, content: "x".repeat(256 * 1024 + 1) } };
    expect(messages({ schemaVersion: 1, page: validPage, elements: [big] }))
      .toContain("Template is larger than 256 KB");
  });
});
