// A starter template filled with its made-up sample business, for the gallery
// thumbnails: the same form model and preview maths as the Generate page.
import type { Account } from "../../api/account";
import type { StarterTemplate } from "../../lib/starterTemplates";
import { buildFormModel, emptyLineItem, previewFromForm, type FormModel, type GenerateValues, type PreviewData } from "../generate/formModel";

export const SAMPLE_NUMBERS = { receipt: "R-0001", gst_invoice: "INV/26-27/0001" } as const;
const SAMPLE_DATE = "2026-10-11";

// The Generate form as the sample business would fill it in, and its Settings
export function starterValues({ canvas, sample }: StarterTemplate): { model: FormModel; values: GenerateValues; account: Account } {
  const model = buildFormModel(canvas);
  const values = structuredClone(model.defaults);
  values.business.name = sample.business.name;
  values.customer = { ...values.customer, ...sample.customer };
  // Place of supply defaults to the seller's state, as on the Generate form
  const place = sample.receipt?.place_of_supply ?? sample.business.gstin?.slice(0, 2) ?? "";
  values.receipt = { ...values.receipt, ...sample.receipt, place_of_supply: place, date: SAMPLE_DATE };
  values.custom = { ...values.custom, ...sample.custom };
  values.items = sample.items.map((item) => ({ ...emptyLineItem(), ...item }));
  values.tax_percent = sample.tax_percent ?? values.tax_percent;
  values.discount = sample.discount ?? values.discount;
  const account: Account = {
    id: "sample", email: "", receipt_prefix: "R-", numbering_mode: "sequential", invoice_prefix: "INV/", invoicing_mode: "both",
    has_password: true, google_linked: false,
    business_name: sample.business.name, business_address: sample.business.address, gstin: sample.business.gstin ?? null,
  };
  return { model, values, account };
}

export function starterPreview(starter: StarterTemplate): PreviewData {
  const { model, values, account } = starterValues(starter);
  return previewFromForm(values, SAMPLE_NUMBERS[starter.canvas.documentType], model.gst, account);
}
