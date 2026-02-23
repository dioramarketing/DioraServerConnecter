import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './pages/Login';
import { PendingPage } from './pages/Pending';
import { MainPage } from './pages/Main';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceStatus = useAuthStore((s) => s.deviceStatus);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (accessToken) {
      const serverUrl = useAuthStore.getState().serverUrl;
      fetch(`${serverUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            useAuthStore.setState({ user: data.data, deviceStatus: 'approved' });
          } else {
            useAuthStore.getState().logout();
          }
        })
        .catch(() => useAuthStore.getState().logout())
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (deviceStatus === 'pending') return <PendingPage />;
  return <MainPage />;
}
