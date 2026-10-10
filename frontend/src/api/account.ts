import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export type NumberingMode = 'sequential' | 'nanoid';
// What the user mostly makes, asked once after sign-up (null = not asked yet)
export type InvoicingMode = 'receipts' | 'gst' | 'both';

export interface Account {
  id: string;
  email: string;
  business_name: string | null;
  receipt_prefix: string;
  numbering_mode: NumberingMode;
  // GST tax invoices: the supplier's address and GSTIN, and the invoice series prefix
  business_address: string | null;
  gstin: string | null;
  invoice_prefix: string;
  invoicing_mode: InvoicingMode | null;
  // How the account signs in: a password, Google, or both
  has_password: boolean;
  google_linked: boolean;
}

export type AccountChanges = Partial<
  Pick<Account, 'business_name' | 'receipt_prefix' | 'numbering_mode' | 'business_address' | 'gstin' | 'invoice_prefix' | 'invoicing_mode'>
>;

// What a GST invoice takes from Settings
export const hasGstProfile = (account: Account | undefined): account is Account =>
  Boolean(account?.business_name && account.business_address && account.gstin);

export const accountKeys = { me: ['account'] as const };

export function useAccount() {
  return useQuery({
    queryKey: accountKeys.me,
    queryFn: async () => (await apiClient.get<Account>('/auth/me')).data,
  });
}

export async function updateAccount(changes: AccountChanges): Promise<Account> {
  return (await apiClient.patch<Account>('/auth/me', changes)).data;
}

// The welcome question and Settings
export const INVOICING_OPTIONS: { value: InvoicingMode; label: string; hint: string }[] = [
  { value: "receipts", label: "Simple receipts", hint: "I'm not GST-registered, or don't need tax invoices." },
  { value: "gst", label: "GST tax invoices", hint: "I have a GSTIN and bill with CGST / SGST / IGST." },
  { value: "both", label: "Both", hint: "Receipts for some sales, GST invoices for others." },
];
