import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// Request body for POST /receipts (money and quantities are decimal strings)
export interface ReceiptDataInput {
  business: { name: string | null };
  customer: { name: string | null; email: string | null };
  receipt: {
    number: string | null;
    date: string | null;
    payment_method: string | null;
    currency: string;
    notes: string | null;
  };
  custom: Record<string, string>;
  items: { description: string; qty: string; unit_price: string }[];
  tax_rate: string;
  discount: string;
}

export interface ReceiptRecord {
  id: string;
  template_id: string | null;
  receipt_number: string;
  total_amount: string;
  currency: string;
  created_at: string | null;
  data: ReceiptDataInput & {
    items: { description: string; qty: string; unit_price: string; line_total: string }[];
    computed: { subtotal: string; tax: string; discount: string; total: string };
  };
}

export interface NextNumber {
  mode: 'sequential' | 'nanoid';
  next_number: string | null;
}

export interface ReceiptSummary {
  id: string;
  template_id: string | null;
  receipt_number: string;
  customer_name: string | null;
  total_amount: string;
  currency: string;
  created_at: string | null;
}

export const receiptKeys = {
  all: ['receipts'] as const,
  nextNumber: ['receipts', 'next-number'] as const,
};

// Newest first
export function useReceipts() {
  return useQuery({
    queryKey: receiptKeys.all,
    queryFn: async () => (await apiClient.get<ReceiptSummary[]>('/receipts')).data,
  });
}

// Preview of what a blank receipt number would become (doesn't consume it)
export function useNextNumber() {
  return useQuery({
    queryKey: receiptKeys.nextNumber,
    queryFn: async () => (await apiClient.get<NextNumber>('/receipts/next-number')).data,
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

export function receiptApiError(error: unknown): ReceiptApiError | null {
  if (!axios.isAxiosError(error)) return null;
  const detail: unknown = error.response?.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'code' in detail) {
    return detail as ReceiptApiError;
  }
  return null;
}
