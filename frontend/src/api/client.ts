import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useServerStatus } from '../store/serverStatusStore';

export const apiClient = axios.create({
  // Override with VITE_API_URL (e.g. in frontend/.env.local)
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Whether each request was sent while the server may be asleep (WakingUpNotice)
const MAY_BE_ASLEEP = Symbol('mayBeAsleep');
type Tracked = { [MAY_BE_ASLEEP]?: boolean };
const counted = (config: unknown) => Boolean((config as Tracked | undefined)?.[MAY_BE_ASLEEP]);

apiClient.interceptors.request.use((config) => {
  (config as Tracked)[MAY_BE_ASLEEP] = useServerStatus.getState().sent();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use((response) => {
  useServerStatus.getState().answered(counted(response.config));
  return response;
}, (error) => {
  // Any reply, even an error, means the server is up; no reply at all doesn't
  if (axios.isAxiosError(error)) {
    if (error.response) useServerStatus.getState().answered(counted(error.config));
    else useServerStatus.getState().failed(counted(error.config));
  }
  // An expired or invalid token: drop it so the router sends the user back to login
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
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') {
    return detail.message;
  }
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ') || fallback;
  }
  return fallback;
}
