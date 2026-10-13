import { describe, expect, it } from "vitest";
import { billValues, upiLink } from "./upi";
import { resolveVariables } from "./variables";

describe("Pay by UPI", () => {
  it("builds the same link as the server", () => {
    // backend tests/test_upi_qr.py, character for character
    expect(upiLink("brewbloom@okhdfc", "Brew & Bloom Café", "588.5", "INR", "Receipt R-0001")).toBe(
      "upi://pay?pa=brewbloom@okhdfc&pn=Brew%20%26%20Bloom%20Caf%C3%A9&am=588.50&cu=INR&tn=Receipt%20R-0001",
    );
  });

  it("leaves out the amount when UPI can't take it, and the link without an ID", () => {
    expect(upiLink("", "Shop", "10", "INR", "Receipt")).toBe("");
    expect(upiLink("shop@upi", "Shop", "10", "USD", "Receipt")).not.toContain("am=");
    expect(upiLink("shop@upi", "Shop", "—", "INR", "Receipt")).not.toContain("am=");
  });

  it("adds the bill total and link to a receipt's values", () => {
    const values = billValues({ "business.upi_id": "shop@okhdfc", "business.name": "Shop", "receipt.number": "INV/26-27/0004", "receipt.currency": "INR" }, "1180", true);
    expect(values["receipt.total"]).toBe("1180.00");
    expect(resolveVariables("{{receipt.upi_link}}", values)).toBe("upi://pay?pa=shop@okhdfc&pn=Shop&am=1180.00&cu=INR&tn=Invoice%20INV%2F26-27%2F0004");
  });
});
