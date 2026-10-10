import { create } from 'zustand';
import { queryClient } from '../api/queryClient';

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  setToken: (token) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    const changed = token !== get().token;
    set({ token });
    // Signing out (or in as someone else) drops the previous account's templates,
    // settings and receipts from the cache
    if (changed) queryClient.clear();
  },
}));
