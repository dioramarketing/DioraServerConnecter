import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Play, Square, RotateCcw, Trash2, Plus } from 'lucide-react';

interface ContainerInfo {
  id: string;
  userId: string;
  containerId: string | null;
  name: string;
  sshPort: number;
  status: string;
  user: { id: string; username: string; email: string; role: string };
}

export function ContainersPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const load = () => {
    api.get<ContainerInfo[]>('/containers').then(setContainers).catch(() => {});
    api.get<any[]>('/admin/users').then((u) => setUsers(u.map((x: any) => ({ id: x.id, username: x.username })))).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const action = async (fn: () => Promise<any>) => {
    try { await fn(); load(); } catch (err: any) { alert(err.message); }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    await action(() => api.post('/containers', { userId: selectedUser }));
    setShowCreate(false);
  };

  const statusColor: Record<string, string> = {
    RUNNING: 'bg-green-100 text-green-700',
    STOPPED: 'bg-slate-100 text-slate-700',
    CREATING: 'bg-blue-100 text-blue-700',
    ERROR: 'bg-red-100 text-red-700',
    REBUILDING: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Containers</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> Create Container
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" required>
                <option value="">Select user...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer">Cancel</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Container</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">SSH Port</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.user.username}</td>
                <td className="px-4 py-3 text-slate-500 font-mono">{c.sshPort}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[c.status] || ''}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {c.status === 'STOPPED' && (
                      <button onClick={() => action(() => api.post(`/containers/${c.userId}/start`))} className="p-1.5 rounded hover:bg-green-50 cursor-pointer" title="Start">
                        <Play className="w-4 h-4 text-green-500" />
                      </button>
                    )}
                    {c.status === 'RUNNING' && (
                      <button onClick={() => action(() => api.post(`/containers/${c.userId}/stop`))} className="p-1.5 rounded hover:bg-red-50 cursor-pointer" title="Stop">
                        <Square className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                    <button onClick={() => action(() => api.post(`/containers/${c.userId}/rebuild`))} className="p-1.5 rounded hover:bg-yellow-50 cursor-pointer" title="Rebuild">
                      <RotateCcw className="w-4 h-4 text-yellow-600" />
                    </button>
                    <button onClick={() => { if (confirm('Remove container?')) action(() => api.delete(`/containers/${c.userId}`)); }} className="p-1.5 rounded hover:bg-red-50 cursor-pointer" title="Remove">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {containers.length === 0 && <p className="text-center py-8 text-slate-400">No containers</p>}
      </div>
    </div>
  );
}
