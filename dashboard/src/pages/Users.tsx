import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { UserPlus, Trash2, Shield, ShieldOff, Settings, Save, X } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  resourceAllocation: { cpuCores: number; memoryMb: number; storageSsdGb: number; storageHddGb: number } | null;
  containers: { id: string; status: string; sshPort: number }[];
  _count: { devices: number; sshKeys: number };
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [error, setError] = useState('');
  const [editingResources, setEditingResources] = useState<string | null>(null);
  const [resForm, setResForm] = useState({ cpuCores: 2, memoryGb: 8, storageSsdGb: 50, storageHddGb: 200 });
  const [saving, setSaving] = useState(false);

  const load = () => api.get<User[]>('/admin/users').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'USER' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleSuspend = async (id: string, status: string) => {
    const newStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await api.patch(`/admin/users/${id}`, { status: newStatus });
    load();
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };

  const startEditResources = (user: User) => {
    setEditingResources(user.id);
    const ra = user.resourceAllocation;
    setResForm({
      cpuCores: ra?.cpuCores ?? 2,
      memoryGb: ra ? Math.round(ra.memoryMb / 1024) : 8,
      storageSsdGb: ra?.storageSsdGb ?? 50,
      storageHddGb: ra?.storageHddGb ?? 200,
    });
  };

  const saveResources = async (userId: string) => {
    setError('');
    setSaving(true);
    try {
      const { memoryGb, ...rest } = resForm;
      await api.put(`/admin/users/${userId}/resources`, { ...rest, memoryMb: memoryGb * 1024 });
      setEditingResources(null);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
          <h2 className="font-semibold mb-4">Create User</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
            <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg outline-none">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 cursor-pointer">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Resources</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Devices</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {u.resourceAllocation ? `${u.resourceAllocation.cpuCores}C / ${Math.round(u.resourceAllocation.memoryMb / 1024)}G RAM / ${u.resourceAllocation.storageSsdGb}G SSD` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-500">{u._count.devices}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEditResources(u)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title="Resource Limits">
                      <Settings className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleSuspend(u.id, u.status)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title={u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                      {u.status === 'ACTIVE' ? <ShieldOff className="w-4 h-4 text-orange-500" /> : <Shield className="w-4 h-4 text-green-500" />}
                    </button>
                    <button onClick={() => handleDelete(u.id, u.username)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center py-8 text-slate-400">No users found</p>}
      </div>

      {/* Resource Limits Modal */}
      {editingResources && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingResources(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Resource Limits</h2>
              <button onClick={() => setEditingResources(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              User: <span className="font-medium text-slate-700">{users.find(u => u.id === editingResources)?.username}</span>
            </p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">CPU Cores (1-8)</label>
                <input type="number" min={1} max={8} value={resForm.cpuCores}
                  onChange={(e) => setResForm({ ...resForm, cpuCores: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Memory GB (1-32)</label>
                <input type="number" min={1} max={32} value={resForm.memoryGb}
                  onChange={(e) => setResForm({ ...resForm, memoryGb: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">SSD GB (0-200)</label>
                <input type="number" min={0} max={200} value={resForm.storageSsdGb}
                  onChange={(e) => setResForm({ ...resForm, storageSsdGb: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">HDD GB (0-1000)</label>
                <input type="number" min={0} max={1000} value={resForm.storageHddGb}
                  onChange={(e) => setResForm({ ...resForm, storageHddGb: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveResources(editingResources)} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingResources(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
