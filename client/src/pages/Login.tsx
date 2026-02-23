import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../stores/auth';
import { invoke } from '@tauri-apps/api/core';
import { Server, Settings } from 'lucide-react';

interface DeviceInfo {
  fingerprint: string;
  name: string;
  os: string;
}

export function LoginPage() {
  const { login, verify2fa, serverUrl, setServerUrl } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [twoFa, setTwoFa] = useState<{ sessionId: string; code: string } | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Get device info from Rust backend
      let deviceInfo: DeviceInfo;
      try {
        deviceInfo = await invoke<DeviceInfo>('get_device_info');
      } catch {
        // Fallback for dev mode without Tauri
        deviceInfo = { fingerprint: 'dev-fallback', name: 'Dev Machine', os: navigator.platform };
      }

      const result = await login(username, password, deviceInfo.fingerprint, deviceInfo.name, deviceInfo.os);
      if (result.requiresTwoFa && result.twoFaSessionId) {
        setTwoFa({ sessionId: result.twoFaSessionId, code: '' });
      } else if (result.requiresDeviceApproval) {
        setError('Device pending approval. Contact admin.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFa) return;
    setLoading(true);
    try {
      await verify2fa(twoFa.sessionId, twoFa.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Server className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">DioraServer</h1>
          <button onClick={() => setShowSettings(!showSettings)} className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <label className="block text-xs font-medium text-slate-500 mb-1">Server URL</label>
            <div className="flex gap-2">
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded outline-none" />
              <button onClick={() => { setServerUrl(urlInput); setShowSettings(false); }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded cursor-pointer">Save</button>
            </div>
          </div>
        )}

        {!twoFa ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2fa} className="space-y-4">
            <p className="text-sm text-slate-600">Verification code sent to your email.</p>
            <input type="text" maxLength={6} value={twoFa.code} onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })} className="w-full px-3 py-3 border border-slate-300 rounded-lg text-center text-2xl tracking-widest outline-none" required />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
