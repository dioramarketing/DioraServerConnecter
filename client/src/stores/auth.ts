import { create } from 'zustand';

interface User {
  userId: string;
  username: string;
  role: string;
}

interface ConnectionInfo {
  host: string;
  port: number;
  username: string;
  containerName: string;
  status: string;
  sshCommand: string;
  vsCodeUri: string;
}

interface AuthState {
  serverUrl: string;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  connectionInfo: ConnectionInfo | null;
  deviceStatus: 'unknown' | 'pending' | 'approved' | 'rejected';
  setServerUrl: (url: string) => void;
  login: (username: string, password: string, fingerprint: string, name: string, os: string) => Promise<{ requiresTwoFa?: boolean; twoFaSessionId?: string; requiresDeviceApproval?: boolean }>;
  verify2fa: (sessionId: string, code: string) => Promise<void>;
  logout: () => void;
  fetchConnectionInfo: () => Promise<void>;
}

async function apiRequest<T>(serverUrl: string, path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${serverUrl}/api/v1${path}`, { ...options, headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  serverUrl: localStorage.getItem('dsc-server-url') || 'http://localhost:4000',
  user: null,
  accessToken: localStorage.getItem('dsc-access-token'),
  refreshToken: localStorage.getItem('dsc-refresh-token'),
  connectionInfo: null,
  deviceStatus: 'unknown',

  setServerUrl: (url: string) => {
    localStorage.setItem('dsc-server-url', url);
    set({ serverUrl: url });
  },

  login: async (username, password, fingerprint, name, os) => {
    const { serverUrl } = get();
    const data = await apiRequest<any>(serverUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceFingerprint: fingerprint, deviceName: name, deviceOs: os }),
    });

    if (data.requiresTwoFa) return { requiresTwoFa: true, twoFaSessionId: data.twoFaSessionId };
    if (data.requiresDeviceApproval) {
      set({ deviceStatus: 'pending' });
      return { requiresDeviceApproval: true };
    }

    localStorage.setItem('dsc-access-token', data.accessToken);
    localStorage.setItem('dsc-refresh-token', data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, deviceStatus: 'approved' });
    return {};
  },

  verify2fa: async (sessionId, code) => {
    const { serverUrl } = get();
    const data = await apiRequest<any>(serverUrl, '/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, code }),
    });
    localStorage.setItem('dsc-access-token', data.accessToken);
    localStorage.setItem('dsc-refresh-token', data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, deviceStatus: 'approved' });
  },

  logout: () => {
    localStorage.removeItem('dsc-access-token');
    localStorage.removeItem('dsc-refresh-token');
    set({ user: null, accessToken: null, refreshToken: null, connectionInfo: null, deviceStatus: 'unknown' });
  },

  fetchConnectionInfo: async () => {
    const { serverUrl, accessToken } = get();
    if (!accessToken) return;
    try {
      const info = await apiRequest<ConnectionInfo>(serverUrl, '/connection/info', {}, accessToken);
      set({ connectionInfo: info });
    } catch {
      // Container may not exist yet
    }
  },
}));
