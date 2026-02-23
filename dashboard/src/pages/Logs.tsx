import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface LogEntry {
  id: string;
  userId: string | null;
  activityType: string;
  description: string;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; username: string; email: string } | null;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (filter) params.set('activityType', filter);
    api.get<{ logs: LogEntry[]; total: number }>(`/admin/logs?${params}`).then((data) => {
      setLogs(data.logs);
      setTotal(data.total);
    }).catch(() => {});
  }, [page, filter]);

  const typeColor: Record<string, string> = {
    LOGIN: 'text-green-600',
    LOGIN_FAILED: 'text-red-600',
    LOGOUT: 'text-slate-500',
    DEVICE_REGISTER: 'text-blue-600',
    DEVICE_APPROVE: 'text-green-600',
    DEVICE_REJECT: 'text-red-600',
    CONTAINER_CREATE: 'text-blue-600',
    CONTAINER_REMOVE: 'text-red-600',
    TWO_FA_SENT: 'text-yellow-600',
    TWO_FA_FAILED: 'text-red-600',
    USER_CREATE: 'text-blue-600',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none">
          <option value="">All Types</option>
          {['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'DEVICE_REGISTER', 'DEVICE_APPROVE', 'DEVICE_REJECT', 'CONTAINER_CREATE', 'CONTAINER_START', 'CONTAINER_STOP', 'USER_CREATE', 'TWO_FA_SENT', 'TWO_FA_FAILED'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className={`px-4 py-3 font-mono text-xs ${typeColor[l.activityType] || 'text-slate-600'}`}>{l.activityType}</td>
                <td className="px-4 py-3 text-slate-600">{l.user?.username || '-'}</td>
                <td className="px-4 py-3 text-slate-700 max-w-md truncate">{l.description}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{l.ipAddress || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center py-8 text-slate-400">No logs found</p>}
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-slate-500">
        <span>{total} total entries</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 bg-white border border-slate-300 rounded disabled:opacity-50 cursor-pointer">Prev</button>
          <span className="px-3 py-1.5">Page {page + 1}</span>
          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total} className="px-3 py-1.5 bg-white border border-slate-300 rounded disabled:opacity-50 cursor-pointer">Next</button>
        </div>
      </div>
    </div>
  );
}
