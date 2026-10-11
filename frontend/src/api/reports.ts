import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { DocumentType } from '../lib/units';

export interface ReportItem {
  description: string;
  unit: string | null;
  quantity: string;
  amount: string; // quantity x price, before discounts and tax
  receipts: number;
}

export interface SalesReport {
  start: string;
  end: string;
  document_type: DocumentType | null;
  currency: string | null; // null: nothing sold in the period
  currencies: string[];
  receipt_count: number;
  items: ReportItem[];
  totals: { subtotal: string; discount: string; taxable: string; tax: string; cgst: string; sgst: string; igst: string; total: string };
}

export interface ReportQuery {
  start: string;
  end: string;
  currency?: string;
  document_type?: DocumentType;
}

// GET /reports/sales: items sold in the period (by receipt date) and the totals
export const useSalesReport = (query: ReportQuery, enabled: boolean) =>
  useQuery({
    queryKey: ['reports', 'sales', query],
    queryFn: async () => (await apiClient.get<SalesReport>('/reports/sales', { params: query })).data,
    enabled,
    placeholderData: keepPreviousData,
  });
