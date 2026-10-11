// "Send on WhatsApp": a wa.me link that opens WhatsApp (app or web) with the
// message typed in, to one number or to a contact the user picks.

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
export const currencyPrefix = (currency: string) => SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;

// Digits only, with India's 91 added to a 10-digit mobile number. Empty if it
// can't be a phone number (WhatsApp then asks who to send to).
export function whatsappNumber(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
}

export function whatsappUrl(phone: string, message: string): string {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function receiptMessage(details: {
  customerName: string | null; businessName: string | null; kind: "receipt" | "invoice";
  number: string; total: string; currency: string; link: string;
}): string {
  const greeting = details.customerName ? `Hello ${details.customerName},` : "Hello,";
  const from = details.businessName ? ` from ${details.businessName}` : "";
  return [
    greeting,
    `Here is your ${details.kind} ${details.number}${from} for ${currencyPrefix(details.currency)}${details.total}.`,
    `View or download it: ${details.link}`,
    "Thank you!",
  ].join("\n");
}
