// "Pay by UPI": the {{receipt.upi_link}} a QR code encodes, so any UPI app
// opens with the payee, the bill amount and a note filled in. Mirrors
// upi_link() in backend app/services/receipt_service.py character for character.
import type { VariableValues } from "./variables";

const MONEY = /^\d+(\.\d+)?$/;

// encodeURIComponent, keeping "@" (Python's quote(safe="@!'()*~"))
const encode = (value: string) => encodeURIComponent(value).replace(/%40/g, "@");

export function upiLink(upiId: string | null | undefined, payee: string | null | undefined, total: string | null | undefined, currency: string, note: string): string {
  if (!upiId) return "";
  const params: [string, string][] = [["pa", upiId], ["pn", payee ?? ""]];
  // UPI only takes rupees; without a total the payer types the amount
  if (total && MONEY.test(total) && Number(total) > 0 && currency.toUpperCase() === "INR") {
    params.push(["am", Number(total).toFixed(2)]);
  }
  params.push(["cu", "INR"], ["tn", note]);
  return "upi://pay?" + params.filter(([, value]) => value).map(([key, value]) => `${key}=${encode(value)}`).join("&");
}

// {{receipt.total}} and {{receipt.upi_link}}, worked out from the bill
export function billValues(values: VariableValues, total: string | undefined, gst: boolean): VariableValues {
  const amount = total && MONEY.test(total) ? Number(total).toFixed(2) : "";
  const number = values["receipt.number"];
  const kind = gst ? "Invoice" : "Receipt";
  return {
    ...values,
    "receipt.total": amount,
    "receipt.upi_link": upiLink(values["business.upi_id"], values["business.name"], amount, values["receipt.currency"] ?? "", number ? `${kind} ${number}` : kind),
  };
}

// The QR content that makes a QR code a "Pay by UPI" code
export const UPI_QR_CONTENT = "{{receipt.upi_link}}";
