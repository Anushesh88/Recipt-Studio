import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { DocumentType } from '../lib/units';

export interface LineItemInput {
  description: string;
  qty: string;
  unit_price: string;
  // GST invoices only
  hsn?: string | null;
  unit?: string | null;
  discount?: string;
  gst_rate?: string | null; // percent
}

// Request body for POST /receipts (money and quantities are decimal strings)
export interface ReceiptDataInput {
  business: { name: string | null };
  customer: { name: string | null; email: string | null; address?: string | null; gstin?: string | null };
  receipt: {
    number: string | null;
    date: string | null;
    payment_method: string | null;
    currency: string;
    notes: string | null;
    place_of_supply?: string | null; // GST state code
    reverse_charge?: boolean;
  };
  custom: Record<string, string>;
  items: LineItemInput[];
  tax_rate: string;
  discount: string;
}

export interface StoredLineItem extends LineItemInput {
  line_total: string;
  taxable_value?: string | null;
  tax_amount?: string | null;
}

export interface GstComputed {
  supply: 'intra' | 'inter';
  state_tax_label: 'SGST' | 'UTGST';
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
}

export interface ComputedTotals {
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  gst?: GstComputed | null;
}

export interface ReceiptRecord {
  id: string;
  template_id: string | null;
  document_type: DocumentType;
  receipt_number: string;
  total_amount: string;
  currency: string;
  created_at: string | null;
  data: Omit<ReceiptDataInput, 'business'> & {
    business: { name: string | null; address?: string | null; gstin?: string | null };
    items: StoredLineItem[];
    computed: ComputedTotals;
  };
}

export interface NextNumber {
  // GST invoices: the per-financial-year invoice series
  mode: 'sequential' | 'nanoid' | 'invoice_series';
  next_number: string | null;
}

export interface ReceiptSummary {
  id: string;
  template_id: string | null;
  document_type: DocumentType;
  receipt_number: string;
  customer_name: string | null;
  total_amount: string;
  currency: string;
  created_at: string | null;
}

export const receiptKeys = {
  all: ['receipts'] as const,
  nextNumber: ['receipts', 'next-number'] as const,
  detail: (id: string) => ['receipts', 'detail', id] as const,
};

// Newest first
export function useReceipts() {
  return useQuery({
    queryKey: receiptKeys.all,
    queryFn: async () => (await apiClient.get<ReceiptSummary[]>('/receipts')).data,
  });
}

// Preview of what a blank receipt number would become (doesn't consume it). GST
// invoices are numbered in the series of their date's financial year.
export function useNextNumber(documentType: DocumentType = 'receipt', date?: string) {
  const gst = documentType === 'gst_invoice';
  return useQuery({
    queryKey: [...receiptKeys.nextNumber, documentType, gst ? date ?? '' : ''],
    queryFn: async () =>
      (await apiClient.get<NextNumber>('/receipts/next-number', {
        params: gst ? { document_type: documentType, ...(date ? { date } : {}) } : {},
      })).data,
  });
}

// One stored receipt ("Use again" pre-fills a new one from it)
export function useReceipt(receiptId: string | null | undefined) {
  return useQuery({
    queryKey: receiptKeys.detail(receiptId ?? ''),
    enabled: Boolean(receiptId),
    queryFn: async () => (await apiClient.get<ReceiptRecord>(`/receipts/${receiptId}`)).data,
  });
}

export async function createReceipt(templateId: string, data: ReceiptDataInput): Promise<ReceiptRecord> {
  return (await apiClient.post<ReceiptRecord>('/receipts', { template_id: templateId, data })).data;
}

// Structured errors from POST /receipts: {code, message, fields}
export interface ReceiptApiError {
  code: string;
  message: string;
  fields: string[];
}

// FastAPI's own request validation errors, as form field paths:
// {loc: ["body", "data", "items", 0, "qty"], msg} -> {field: "items.0.qty", message}
const FORM_FIELD_FOR: Record<string, string> = { tax_rate: "tax_percent" };

export function requestFieldErrors(error: unknown): { field: string; message: string }[] {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return [];
  const detail: unknown = error.response.data?.detail;
  if (!Array.isArray(detail)) return [];
  return detail.flatMap((d: { loc?: unknown[]; msg?: unknown }) => {
    const loc = d.loc ?? [];
    if (loc[0] !== "body" || loc[1] !== "data" || loc.length < 3) return [];
    const field = loc.slice(2).join(".");
    return [{ field: FORM_FIELD_FOR[field] ?? field, message: typeof d.msg === "string" ? d.msg : "Invalid value" }];
  });
}

export function receiptApiError(error: unknown): ReceiptApiError | null {
  if (!axios.isAxiosError(error)) return null;
  const detail: unknown = error.response?.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'code' in detail) {
    return detail as ReceiptApiError;
  }
  return null;
}
