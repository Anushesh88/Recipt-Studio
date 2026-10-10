import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// Customers and items remembered from past receipts (the server adds them as
// receipts are created), for autofill in the Generate form

export interface SavedCustomer {
  id: string;
  name: string;
  email: string | null;
  gstin: string | null;
  address: string | null;
  state_code: string | null;
}

export interface SavedItem {
  id: string;
  description: string;
  hsn: string | null;
  unit: string | null;
  unit_price: string;
  gst_rate: string | null;
}

export const catalogKeys = {
  customers: ['customers'] as const,
  items: ['items'] as const,
};

export function useSavedCustomers() {
  return useQuery({
    queryKey: catalogKeys.customers,
    queryFn: async () => (await apiClient.get<SavedCustomer[]>('/customers')).data,
  });
}

export function useSavedItems() {
  return useQuery({
    queryKey: catalogKeys.items,
    queryFn: async () => (await apiClient.get<SavedItem[]>('/items')).data,
  });
}

export async function forgetCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

export async function forgetItem(id: string): Promise<void> {
  await apiClient.delete(`/items/${id}`);
}

// Case-insensitive lookups, like the server's
export const findByName = <T extends { name: string }>(list: T[] | undefined, name: string) =>
  list?.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
export const findByDescription = <T extends { description: string }>(list: T[] | undefined, description: string) =>
  list?.find((i) => i.description.toLowerCase() === description.trim().toLowerCase());
