import { useAuthStore } from '../stores/auth';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { serverUrl, accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Only set Content-Type for requests with a body
  if (options.body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${serverUrl}/api/v1${path}`, { ...options, headers });
  } catch {
    throw new Error('Network error: cannot reach server');
  }

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  // Handle non-JSON responses
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    throw new Error('Unexpected response format');
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid response from server');
  }

  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data.data as T;
}

async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const { serverUrl, accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    return await fetch(`${serverUrl}/api/v1${path}`, { ...options, headers });
  } catch {
    throw new Error('Network error: cannot reach server');
  }
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
