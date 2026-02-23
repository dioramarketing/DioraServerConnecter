import { create } from 'zustand';
import { api } from '../api/client';

interface User {
  userId: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ requiresTwoFa?: boolean; twoFaSessionId?: string; requiresDeviceApproval?: boolean }>;
  verify2fa: (sessionId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (username, password) => {
    const data = await api.post<any>('/auth/login', {
      username,
      password,
      deviceFingerprint: 'dashboard-web',
      deviceName: 'Admin Dashboard',
      deviceOs: (navigator as any).userAgentData?.platform || navigator.platform || 'Web',
    });

    if (data.requiresTwoFa) {
      return { requiresTwoFa: true, twoFaSessionId: data.twoFaSessionId };
    }
    if (data.requiresDeviceApproval) {
      return { requiresDeviceApproval: true };
    }

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user });
    return {};
  },

  verify2fa: async (sessionId, code) => {
    const data = await api.post<any>('/auth/2fa/verify', { sessionId, code });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user });
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) { set({ isLoading: false }); return; }
      const user = await api.get<User>('/auth/me');
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
