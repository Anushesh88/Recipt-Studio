import { describe, it, expect } from "vitest";
import { buildFormModel, emptyLineItem, previewFromForm, toPayload, valuesFromReceipt, type GenerateValues } from "./formModel";
import { STARTER_TEMPLATES } from "../../lib/starterTemplates";
import type { Account } from "../../api/account";
import type { ReceiptRecord } from "../../api/receipts";
import { fractionToPercent } from "../../lib/money";

const gstA4 = STARTER_TEMPLATES.find((t) => t.id === "gst-a4")!.canvas;
const account: Account = {
  id: "a", email: "a@example.com", business_name: "Sharma Traders", receipt_prefix: "R-", numbering_mode: "sequential",
  business_address: "12 MG Road, Pune", gstin: "27AAPFU0939F1ZV", invoice_prefix: "INV/", invoicing_mode: "gst",
};

const invoice = (change: (v: GenerateValues) => void) => {
  const model = buildFormModel(gstA4);
  const values = structuredClone(model.defaults);
  values.receipt.place_of_supply = "27";
  values.items = [{ ...emptyLineItem(), description: "Rice", qty: "2", unit_price: "500", gst_rate: "5" }];
  change(values);
  const result = model.schema.safeParse(values);
  return { model, values, issues: result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
};

describe("GST invoice form", () => {
  it("a walk-in sale needs no buyer details", () => {
    expect(invoice(() => {}).issues).toEqual([]);
  });

  it("a registered buyer needs name, address and HSN on every line", () => {
    expect(invoice((v) => { v.customer.gstin = "29aagcb7383j1z4"; }).issues).toEqual([
      "customer.name: Required on this GST invoice",
      "customer.address: Required on this GST invoice",
      "items.0.hsn: HSN/SAC is required for a registered buyer",
    ]);
  });

  it("an unregistered buyer needs name and address from Rs 50,000 taxable", () => {
    expect(invoice((v) => { v.items[0].unit_price = "25000"; }).issues).toHaveLength(2);
    expect(invoice((v) => { v.items[0].unit_price = "24999.99"; }).issues).toEqual([]);
  });

  it("checks GSTINs, GST rates and line discounts", () => {
    // (a GSTIN was typed, so the buyer's details are asked for too)
    expect(invoice((v) => { v.customer.gstin = "27AAPFU0939F1ZX"; }).issues).toContain(
      "customer.gstin: This GSTIN's last character doesn't match; check it for a typo.",
    );
    expect(invoice((v) => { v.items[0].gst_rate = ""; }).issues).toEqual(["items.0.gst_rate: A rate like 5 or 18"]);
    expect(invoice((v) => { v.items[0].gst_rate = "41"; }).issues).toEqual(["items.0.gst_rate: At most 40%"]);
    expect(invoice((v) => { v.items[0].discount = "1001"; }).issues).toEqual(["items.0.discount: More than the item's amount"]);
  });

  it("sends GST fields only for GST invoices, in INR", () => {
    const { model, values } = invoice((v) => { v.customer.gstin = "29aagcb7383j1z4"; v.items[0].unit = "bag"; });
    const payload = toPayload(values, model);
    expect(payload.receipt.currency).toBe("INR");
    expect(payload.customer.gstin).toBe("29AAGCB7383J1Z4");
    expect(payload.items[0]).toEqual({ description: "Rice", qty: "2", unit_price: "500", hsn: null, unit: "BAG", discount: "0", gst_rate: "5" });
    expect([payload.tax_rate, payload.discount]).toEqual(["0", "0"]);
  });

  it("previews CGST + SGST in the seller's state, IGST elsewhere", () => {
    const { values } = invoice(() => {});
    const intra = previewFromForm(values, "INV/26-27/0001", true, account);
    expect(intra.taxRows).toEqual([{ key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }]);
    expect([intra.totals.cgst, intra.totals.total, intra.values["customer.gstin"]]).toEqual(["25.00", "1050.00", "Unregistered"]);
    values.receipt.place_of_supply = "29";
    const inter = previewFromForm(values, null, true, account);
    expect(inter.taxRows).toEqual([{ key: "igst", label: "IGST" }]);
    expect([inter.totals.igst, inter.values["receipt.place_of_supply"]]).toEqual(["50.00", "Karnataka (29)"]);
  });
});

describe("Use again", () => {
  it("copies the customer and items, with a new number and today's date", () => {
    const model = buildFormModel(gstA4);
    const stored = {
      id: "r", template_id: "t", document_type: "gst_invoice", receipt_number: "INV/26-27/0001", total_amount: "1050.00",
      currency: "INR", created_at: null,
      data: {
        business: { name: "Sharma Traders", address: "12 MG Road", gstin: "27AAPFU0939F1ZV" },
        customer: { name: "Asha", email: null, address: "Kolkata", gstin: null },
        receipt: {
          number: "INV/26-27/0001", date: "2026-04-01", payment_method: "UPI", currency: "INR", notes: null,
          place_of_supply: "19", reverse_charge: false,
        },
        custom: {},
        items: [{ description: "Rice", qty: "2", unit_price: "500.00", hsn: "1006", unit: "BAG", discount: "0.00", gst_rate: "5.00", line_total: "1000.00" }],
        tax_rate: "0",
        discount: "0.00",
        computed: { subtotal: "1000.00", tax: "50.00", discount: "0.00", total: "1050.00", gst: null },
      },
    } as ReceiptRecord;
    const values = valuesFromReceipt(stored, model);
    expect(values.receipt.number).toBe("");
    expect(values.receipt.date).toBe(model.defaults.receipt.date);
    expect(values.customer).toEqual({ name: "Asha", email: "", address: "Kolkata", gstin: "" });
    expect(values.items[0]).toEqual({ description: "Rice", qty: "2", unit_price: "500.00", hsn: "1006", unit: "BAG", discount: "", gst_rate: "5" });
    expect(values.receipt.place_of_supply).toBe("19");
  });

  it("turns a stored tax fraction back into a percentage", () => {
    expect(["0.0825", "0.08", "0.0800", "0", "0.5", "1"].map(fractionToPercent)).toEqual(["8.25", "8", "8", "0", "50", "100"]);
  });
});
