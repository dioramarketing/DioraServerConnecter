import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Container,
  ScrollText,
  BarChart3,
  FolderOpen,
  Bell,
  MessageSquare,
  LogOut,
  Server,
  Upload,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/devices', icon: Smartphone, label: 'Devices' },
  { to: '/containers', icon: Container, label: 'Containers' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
  { to: '/logs', icon: ScrollText, label: 'Activity Logs' },
  { to: '/shared-folders', icon: FolderOpen, label: 'Shared Folders' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/releases', icon: Upload, label: 'Releases' },
];

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <Server className="w-6 h-6 text-blue-400" />
        <span className="font-bold text-lg">DSC Admin</span>
      </div>

      <nav className="flex-1 py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-300 border-r-2 border-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => logout()}
        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-white border-t border-slate-700 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </aside>
  );
}
