// The business profile in Settings (phone, email, UPI ID, PAN, bank details,
// licence numbers) and the {{business.*}} variables that print it. No API
// imports, so template code and tests can use it.
import type { Account } from "../api/account";

// Business profile: account field -> its {{business.<key>}} variable
export const PROFILE_FIELDS = {
  business_phone: "business.phone",
  business_email: "business.email",
  upi_id: "business.upi_id",
  pan: "business.pan",
  bank_details: "business.bank_details",
  licence: "business.licence",
} as const;
export type ProfileField = keyof typeof PROFILE_FIELDS;

// An account with no profile or brand kit yet (for made-up accounts)
export const NO_PROFILE: Pick<Account, ProfileField | "brand_logo_asset_id" | "brand_color" | "brand_fonts"> = {
  business_phone: null, business_email: null, upi_id: null, pan: null, bank_details: null, licence: null,
  brand_logo_asset_id: null, brand_color: null, brand_fonts: null,
};

// {{business.phone}} etc. from the account, or from a stored receipt's business
export const profileValues = (source: Partial<Record<ProfileField, string | null>> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([field, key]) => [key, source?.[field as ProfileField] ?? ""]));
