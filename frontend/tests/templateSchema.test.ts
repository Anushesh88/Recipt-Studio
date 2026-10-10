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
      columns: [{ key: "description", label: "Desc", width: 1.0, align: "left" as const }],
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

  describe("limits mirrored from the backend", () => {
    const table = validItemsTable();
    const base = () => ({ schemaVersion: 1, page: validPage, elements: [validText, table] });
    const valid = (input: unknown) => canvasSchema.safeParse(input).success;

    it.each([
      ["line height", { elements: [{ ...validText, props: { ...validText.props, lineHeight: -5 } }] }],
      ["font weight", { elements: [{ ...validText, props: { ...validText.props, fontWeight: 123456 } }] }],
      ["y past the largest design height", { elements: [{ ...validText, y: 3001 }] }],
      ["empty id", { elements: [{ ...validText, id: "" }] }],
      ["row padding", { elements: [{ ...table, props: { ...table.props, rowPadding: -40 } }] }],
      ["no columns", { elements: [{ ...table, props: { ...table.props, columns: [] } }] }],
      ["unknown column field", { elements: [{ ...table, props: { ...table.props, columns: [{ key: "nope", label: "X", width: 1, align: "left" }] } }] }],
      ["negative column width", { elements: [{ ...table, props: { ...table.props, columns: [{ key: "qty", label: "Q", width: -3, align: "left" }] } }] }],
      ["duplicate column field", { elements: [{ ...table, props: { ...table.props, columns: [
        { key: "qty", label: "Q", width: 0.5, align: "left" }, { key: "qty", label: "Q2", width: 0.5, align: "left" },
      ] } }] }],
      ["huge page", { page: { ...validPage, height: 10_000_000 } }],
      ["page width off the preset", { page: { ...validPage, width: 5000 } }],
      ["wrong height mode for the preset", { page: { ...validPage, heightMode: "fixed" } }],
      ["huge margin", { page: { ...validPage, margin: 99999 } }],
      ["infinite y", { elements: [{ ...validText, y: Infinity }] }],
      ["asset id that isn't a uuid", { elements: [{ id: "logo", type: "image", x: 0, y: 0, width: 100, height: 40, props: { source: "logo", assetId: "nope", fit: "contain" } }] }],
    ])("rejects %s", (_name, change) => {
      expect(valid(base())).toBe(true);
      expect(valid({ ...base(), ...change })).toBe(false);
    });

    it("A4 and A5 pages keep their preset size", () => {
      const a4 = { preset: "a4" as const, width: 794, height: 1123, heightMode: "fixed" as const, background: "#FFFFFF", margin: 32 };
      expect(valid({ schemaVersion: 1, page: a4, elements: [] })).toBe(true);
      expect(messages({ schemaVersion: 1, page: { ...a4, height: 2000 }, elements: [] })).toContain("A a4 page is 1123px tall");
    });

    it.each([["L", 2953], ["M", 2331], ["Q", 1663], ["H", 1273]] as const)("QR content fits a level-%s code (%i bytes)", (level, capacity) => {
      const qr = (content: string) => ({ schemaVersion: 1, page: validPage, elements: [
        { id: "qr", type: "qr", x: 0, y: 0, width: 100, height: 100, props: { content, errorCorrection: level } },
      ] });
      expect(valid(qr("x".repeat(capacity)))).toBe(true);
      expect(messages(qr("x".repeat(capacity + 1))).some((m) => m.startsWith("Too much text for a QR code"))).toBe(true);
      expect(valid(qr("₹".repeat(Math.floor(capacity / 3) + 1)))).toBe(false); // 3 bytes each
    });
  });

  it("should reject templates over 256 KB", () => {
    const big = { ...validText, props: { ...validText.props, content: "x".repeat(256 * 1024 + 1) } };
    expect(messages({ schemaVersion: 1, page: validPage, elements: [big] }))
      .toContain("Template is larger than 256 KB");
  });
});
