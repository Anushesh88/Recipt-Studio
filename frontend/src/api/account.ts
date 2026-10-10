import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export type NumberingMode = 'sequential' | 'nanoid';

export interface Account {
  id: string;
  email: string;
  business_name: string | null;
  receipt_prefix: string;
  numbering_mode: NumberingMode;
}

export type AccountChanges = Partial<Pick<Account, 'business_name' | 'receipt_prefix' | 'numbering_mode'>>;

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
