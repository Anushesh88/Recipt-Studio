import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface FeedbackItem {
  id: string;
  email: string;
  message: string;
  page: string | null;
  created_at: string | null;
}

export async function sendFeedback(message: string, page: string): Promise<void> {
  await apiClient.post('/feedback', { message, page });
}

// GET /admin/feedback: only for admin accounts (ADMIN_EMAILS on the server)
export const useFeedbackList = () =>
  useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: async () => (await apiClient.get<FeedbackItem[]>('/admin/feedback')).data,
  });
