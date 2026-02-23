import { useAuthStore } from '../stores/auth';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { serverUrl, accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${serverUrl}/api/v1${path}`, { ...options, headers });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data.data as T;
}

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const { serverUrl, accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return fetch(`${serverUrl}/api/v1${path}`, { ...options, headers });
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: requestRaw,
};
