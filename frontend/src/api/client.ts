import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  // Override with VITE_API_URL (e.g. in frontend/.env.local)
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired or invalid token: drop it so the router sends the user back to login
apiClient.interceptors.response.use(undefined, (error) => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const isLogin = axios.isAxiosError(error) && error.config?.url?.startsWith('/auth/');
  if (status === 401 && !isLogin) {
    useAuthStore.getState().setToken(null);
  }
  return Promise.reject(error);
});

// Readable message from a FastAPI error response
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!axios.isAxiosError(error)) return fallback;
  const detail: unknown = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ') || fallback;
  }
  return fallback;
}
