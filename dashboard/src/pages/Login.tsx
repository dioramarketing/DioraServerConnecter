import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Server } from 'lucide-react';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const verify2fa = useAuthStore((s) => s.verify2fa);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFaState, setTwoFaState] = useState<{ sessionId: string; code: string } | null>(null);

  // Already logged in → redirect to main page
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.requiresTwoFa && result.twoFaSessionId) {
        setTwoFaState({ sessionId: result.twoFaSessionId, code: '' });
      } else if (result.requiresDeviceApproval) {
        setError('Device pending approval. Contact your administrator.');
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFaState) return;
    setError('');
    setLoading(true);
    try {
      await verify2fa(twoFaState.sessionId, twoFaState.code);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Server className="w-8 h-8 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">DioraServerConnecter</h1>
        </div>

        {!twoFaState ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2fa} className="space-y-4">
            <p className="text-sm text-slate-600">A verification code was sent to your email.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                value={twoFaState.code}
                onChange={(e) => setTwoFaState({ ...twoFaState, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
