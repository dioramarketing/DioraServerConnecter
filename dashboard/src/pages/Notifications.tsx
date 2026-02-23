import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Bell, CheckCheck } from 'lucide-react';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notif[]>([]);

  const load = () => api.get<Notif[]>('/notifications').then(setNotifications).catch(() => {});
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  const typeIcon: Record<string, string> = {
    INFO: 'text-blue-500',
    WARNING: 'text-yellow-500',
    ERROR: 'text-red-500',
    DEVICE_APPROVAL: 'text-green-500',
    SYSTEM: 'text-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
        <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 cursor-pointer">
          <CheckCheck className="w-4 h-4" /> Mark All Read
        </button>
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className={`bg-white rounded-lg p-4 border ${n.isRead ? 'border-slate-200' : 'border-blue-300 bg-blue-50/30'} flex items-start gap-3 cursor-pointer`} onClick={() => !n.isRead && markRead(n.id)}>
            <Bell className={`w-5 h-5 mt-0.5 ${typeIcon[n.type] || 'text-slate-400'}`} />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-medium text-slate-800 text-sm">{n.title}</span>
                <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
            </div>
            {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />}
          </div>
        ))}
        {notifications.length === 0 && <p className="text-center py-8 text-slate-400">No notifications</p>}
      </div>
    </div>
  );
}
