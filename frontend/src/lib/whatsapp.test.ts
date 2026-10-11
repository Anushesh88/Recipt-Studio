import { describe, it, expect } from "vitest";
import { receiptMessage, whatsappNumber, whatsappUrl } from "./whatsapp";

describe("WhatsApp links", () => {
  it("normalises phone numbers, adding India's code to 10-digit mobiles", () => {
    expect(["98765 43210", "+91 98765-43210", "098765 43210", "919876543210", "+44 7700 900123", "12345", ""].map(whatsappNumber))
      .toEqual(["919876543210", "919876543210", "919876543210", "919876543210", "447700900123", "", ""]);
  });

  it("opens a chat with the message, or lets WhatsApp ask who to send to", () => {
    expect(whatsappUrl("9876543210", "Hi & thanks")).toBe("https://wa.me/919876543210?text=Hi%20%26%20thanks");
    expect(whatsappUrl("", "Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("writes the message", () => {
    expect(receiptMessage({
      customerName: "Asha", businessName: "Brew & Bloom Café", kind: "receipt", number: "R-0001", total: "588.00", currency: "INR",
      link: "https://api.example.com/public/receipts/abc",
    })).toBe("Hello Asha,\nHere is your receipt R-0001 from Brew & Bloom Café for ₹588.00.\nView or download it: https://api.example.com/public/receipts/abc\nThank you!");
    expect(receiptMessage({ customerName: null, businessName: null, kind: "invoice", number: "INV/26-27/0001", total: "10.00", currency: "USD", link: "L" }))
      .toBe("Hello,\nHere is your invoice INV/26-27/0001 for $10.00.\nView or download it: L\nThank you!");
  });
});
