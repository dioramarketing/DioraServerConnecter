import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWsStore } from '../../stores/ws';
import { useAuthStore } from '../../stores/auth';
import { Wifi, WifiOff } from 'lucide-react';

export function Layout() {
  const user = useAuthStore((s) => s.user);
  const connected = useWsStore((s) => s.connected);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              {connected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-slate-500">{connected ? 'Connected' : 'Disconnected'}</span>
            </span>
            <span className="text-slate-700 font-medium">{user?.username}</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
