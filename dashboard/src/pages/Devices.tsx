import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CheckCircle, XCircle, Ban } from 'lucide-react';

interface Device {
  id: string;
  userId: string;
  fingerprint: string;
  name: string;
  os: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  user: { id: string; username: string; email: string };
  approver: { id: string; username: string } | null;
}

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const load = () => api.get<Device[]>('/devices').then(setDevices).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api.post(`/devices/${id}/approve`); load(); };
  const reject = async (id: string) => { await api.post(`/devices/${id}/reject`); load(); };
  const revoke = async (id: string) => {
    if (!confirm('Revoke this device?')) return;
    await api.post(`/devices/${id}/revoke`);
    load();
  };

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    REVOKED: 'bg-slate-100 text-slate-700',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Devices</h1>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Device</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">OS</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Approved By</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Last Seen</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                <td className="px-4 py-3 text-slate-600">{d.user.username}</td>
                <td className="px-4 py-3 text-slate-500">{d.os}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[d.status] || ''}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{d.approver?.username || '-'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {d.status === 'PENDING' && (
                      <>
                        <button onClick={() => approve(d.id)} className="p-1.5 rounded hover:bg-green-50 cursor-pointer" title="Approve">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </button>
                        <button onClick={() => reject(d.id)} className="p-1.5 rounded hover:bg-red-50 cursor-pointer" title="Reject">
                          <XCircle className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                    {d.status === 'APPROVED' && (
                      <button onClick={() => revoke(d.id)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title="Revoke">
                        <Ban className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {devices.length === 0 && <p className="text-center py-8 text-slate-400">No devices found</p>}
      </div>
    </div>
  );
}
