import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useWsStore } from '../stores/ws';
import {
  Users, Shield, Server, Activity, Cpu, FolderOpen,
  Plus, Check, X, Trash2, Play, Square, Save,
  ChevronLeft, ChevronRight, RefreshCw,
  HardDrive, AlertCircle, Settings,
} from 'lucide-react';

type SubTab = 'users' | 'devices' | 'containers' | 'logs' | 'metrics' | 'folders';

// ── Users Management ─────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [error, setError] = useState('');
  const [editingResources, setEditingResources] = useState<string | null>(null);
  const [resForm, setResForm] = useState({ cpuCores: 2, memoryGb: 8, storageSsdGb: 50, storageHddGb: 200 });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/admin/users');
      setUsers(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    setError('');
    setSaving(true);
    try {
      await api.post('/auth/register', form);
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'USER' });
      loadUsers();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleSuspend = async (id: string) => {
    try { await api.patch(`/admin/users/${id}`, { status: 'SUSPENDED' }); loadUsers(); } catch (err: any) { setError(err.message); }
  };

  const handleActivate = async (id: string) => {
    try { await api.patch(`/admin/users/${id}`, { status: 'ACTIVE' }); loadUsers(); } catch (err: any) { setError(err.message); }
  };

  const startEditResources = (user: any) => {
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
      loadUsers();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <span className="flex-1">{error}</span> <button onClick={() => setError('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{users.length} users</span>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" />
            <input type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.username || !form.email || !form.password} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer">{saving ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="font-medium text-slate-800">{u.username}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : u.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                <button onClick={() => startEditResources(u)} className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer" title="Resource Limits"><Settings className="w-4 h-4" /></button>
                {u.status === 'ACTIVE' ? (
                  <button onClick={() => handleSuspend(u.id)} className="p-1.5 text-yellow-500 hover:text-yellow-700 cursor-pointer" title="Suspend"><X className="w-4 h-4" /></button>
                ) : (
                  <button onClick={() => handleActivate(u.id)} className="p-1.5 text-green-500 hover:text-green-700 cursor-pointer" title="Activate"><Check className="w-4 h-4" /></button>
                )}
                <button onClick={() => handleDelete(u.id, u.username)} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Resource limits edit */}
            {editingResources === u.id && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-3">Resource Limits</div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">CPU Cores</label>
                    <input type="number" min={1} max={8} value={resForm.cpuCores} onChange={(e) => setResForm({ ...resForm, cpuCores: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">RAM (GB)</label>
                    <select value={resForm.memoryGb} onChange={(e) => setResForm({ ...resForm, memoryGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none">
                      {[1, 2, 4, 8, 16, 32].map(v => (
                        <option key={v} value={v}>{v} GB</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">SSD (GB)</label>
                    <input type="number" min={0} max={200} value={resForm.storageSsdGb} onChange={(e) => setResForm({ ...resForm, storageSsdGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">HDD (GB)</label>
                    <input type="number" min={0} max={1000} value={resForm.storageHddGb} onChange={(e) => setResForm({ ...resForm, storageHddGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => saveResources(u.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer"><Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setEditingResources(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
                </div>
                {u.resourceAllocation && (
                  <div className="mt-2 text-xs text-slate-400">
                    Current: {u.resourceAllocation.cpuCores} cores, {Math.round(u.resourceAllocation.memoryMb / 1024)} GB RAM, {u.resourceAllocation.storageSsdGb} GB SSD, {u.resourceAllocation.storageHddGb} GB HDD
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Devices Management ───────────────────────────────────
function DevicesTab() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    try { const data = await api.get<any[]>('/devices/pending'); setDevices(data); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDevices(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    try { await api.post(`/devices/${id}/${action}`); loadDevices(); }
    catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error} <button onClick={() => setError('')} className="ml-auto cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{devices.length} pending devices</span>
        <button onClick={loadDevices} className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {devices.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">No pending devices</div>
      ) : (
        <div className="space-y-3">
          {devices.map((d: any) => (
            <div key={d.id} className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-slate-800">{d.name}</div>
                  <div className="text-xs text-slate-500 mt-1">OS: {d.os} | User: {d.user?.username || d.userId}</div>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono">{d.fingerprint}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(d.id, 'approve')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 cursor-pointer"><Check className="w-3.5 h-3.5" /> Approve</button>
                  <button onClick={() => handleAction(d.id, 'reject')} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 cursor-pointer"><X className="w-3.5 h-3.5" /> Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Containers Management ────────────────────────────────
function ContainersTab() {
  const [containers, setContainers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [createRes, setCreateRes] = useState({ cpuCores: 2, memoryGb: 8, storageSsdGb: 50, storageHddGb: 200 });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadContainers = async () => {
    setLoading(true);
    try { const data = await api.get<any[]>('/containers'); setContainers(data); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadAvailableUsers = async (currentContainers: any[]) => {
    try {
      const users = await api.get<any[]>('/admin/users');
      const containerUserIds = new Set(currentContainers.map(c => c.userId));
      setAvailableUsers(users.filter((u: any) => !containerUserIds.has(u.id)));
    } catch (err: any) { setError(`Failed to load users: ${err.message}`); }
  };

  useEffect(() => { loadContainers(); }, []);
  useEffect(() => { if (showCreate) loadAvailableUsers(containers); }, [showCreate, containers]);

  const handleCreate = async () => {
    if (!selectedUserId) return;
    setError('');
    setCreating(true);
    try {
      const { memoryGb, ...restRes } = createRes;
      await api.post('/containers', { userId: selectedUserId, ...restRes, memoryMb: memoryGb * 1024 });
      setShowCreate(false);
      setSelectedUserId('');
      loadContainers();
    } catch (err: any) { setError(err.message); }
    finally { setCreating(false); }
  };

  const handleAction = async (userId: string, action: 'start' | 'stop') => {
    try { await api.post(`/containers/${userId}/${action}`); setTimeout(loadContainers, 1000); }
    catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <span className="flex-1">{error}</span> <button onClick={() => setError('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{containers.length} containers</span>
        <div className="flex gap-2">
          <button onClick={loadContainers} className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"><Plus className="w-4 h-4" /> Create Container</button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg outline-none">
            <option value="">Select user...</option>
            {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.username} ({u.email})</option>)}
          </select>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="block text-xs text-slate-500 mb-1">CPU</label><input type="number" min={1} max={8} value={createRes.cpuCores} onChange={(e) => setCreateRes({ ...createRes, cpuCores: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">RAM (GB)</label>
              <select value={createRes.memoryGb} onChange={(e) => setCreateRes({ ...createRes, memoryGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none">
                {[1, 2, 4, 8, 16, 32].map(v => <option key={v} value={v}>{v} GB</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-500 mb-1">SSD (GB)</label><input type="number" min={0} max={200} value={createRes.storageSsdGb} onChange={(e) => setCreateRes({ ...createRes, storageSsdGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">HDD (GB)</label><input type="number" min={0} max={1000} value={createRes.storageHddGb} onChange={(e) => setCreateRes({ ...createRes, storageHddGb: +e.target.value })} className="w-full px-2.5 py-1.5 text-sm border rounded-lg outline-none" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!selectedUserId || creating} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer">{creating ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {containers.map((c: any) => (
          <div key={c.id} className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500 mt-1">User: {c.user?.username} | Port: {c.sshPort}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
                {c.status === 'RUNNING' ? (
                  <button onClick={() => handleAction(c.userId, 'stop')} className="p-1.5 text-red-500 hover:text-red-700 cursor-pointer" title="Stop"><Square className="w-4 h-4" /></button>
                ) : c.status === 'STOPPED' ? (
                  <button onClick={() => handleAction(c.userId, 'start')} className="p-1.5 text-green-500 hover:text-green-700 cursor-pointer" title="Start"><Play className="w-4 h-4" /></button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared Folders Management ────────────────────────────
function SharedFoldersTab() {
  const [folders, setFolders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ userId: '', permission: 'READWRITE' as 'READ' | 'READWRITE' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [f, u] = await Promise.all([
        api.get<any[]>('/admin/shared-folders'),
        api.get<any[]>('/admin/users'),
      ]);
      setFolders(f);
      setUsers(u);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError('');
    setSaving(true);
    try {
      await api.post('/admin/shared-folders', { name: newName.trim() });
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleAddMember = async (folderId: string) => {
    if (!memberForm.userId) return;
    setError('');
    setSaving(true);
    try {
      await api.post(`/admin/shared-folders/${folderId}/members`, memberForm);
      setAddingMember(null);
      setMemberForm({ userId: '', permission: 'READWRITE' });
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (folderId: string, userId: string) => {
    try {
      await api.delete(`/admin/shared-folders/${folderId}/members/${userId}`);
      load();
    } catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <span className="flex-1">{error}</span> <button onClick={() => setError('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{folders.length} shared folders</span>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"><Plus className="w-4 h-4" /> Create Folder</button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-500" />
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Folder name (alphanumeric, -, _)" className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" autoFocus />
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer">{saving ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Creates a folder at /data/hdd/shared/{newName || '...'}, mounted as /shared/{newName || '...'} in containers</p>
        </div>
      )}

      {folders.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">No shared folders yet</div>
      ) : (
        <div className="space-y-4">
          {folders.map((f: any) => (
            <div key={f.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-medium text-slate-800">{f.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{f.path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">by {f.creator?.username}</span>
                  <button onClick={() => { setAddingMember(f.id); setMemberForm({ userId: '', permission: 'READWRITE' }); }} className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 cursor-pointer"><Plus className="w-3 h-3" /> Add User</button>
                </div>
              </div>

              {/* Add member */}
              {addingMember === f.id && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                  <select value={memberForm.userId} onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value })} className="flex-1 px-2.5 py-1.5 text-sm border rounded-lg outline-none">
                    <option value="">Select user...</option>
                    {users.filter(u => !f.members?.some((m: any) => m.userId === u.id)).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                  <select value={memberForm.permission} onChange={(e) => setMemberForm({ ...memberForm, permission: e.target.value as 'READ' | 'READWRITE' })} className="px-2.5 py-1.5 text-sm border rounded-lg outline-none">
                    <option value="READ">Read Only</option>
                    <option value="READWRITE">Read & Write</option>
                  </select>
                  <button onClick={() => handleAddMember(f.id)} disabled={!memberForm.userId || saving} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer">{saving ? 'Adding...' : 'Add'}</button>
                  <button onClick={() => setAddingMember(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
                </div>
              )}

              {/* Members list */}
              {f.members && f.members.length > 0 && (
                <div className="border-t border-slate-100">
                  {f.members.map((m: any) => (
                    <div key={m.id} className="px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700">{m.user?.username}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.permission === 'READWRITE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{m.permission}</span>
                      </div>
                      <button onClick={() => handleRemoveMember(f.id, m.userId)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity Logs ────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadLogs = async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const offset = (p - 1) * pageSize;
      const data = await api.get<any>(`/admin/logs?limit=${pageSize}&offset=${offset}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(page); }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading && logs.length === 0) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error} <button onClick={() => setError('')} className="ml-auto cursor-pointer"><X className="w-3.5 h-3.5" /></button></div>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-4 py-2.5 font-medium w-40">Time</th><th className="px-4 py-2.5 font-medium w-36">Type</th><th className="px-4 py-2.5 font-medium">Description</th><th className="px-4 py-2.5 font-medium w-28">IP</th></tr></thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No logs</td></tr>
            ) : logs.map((log: any) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString('ko-KR')}</td>
                <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">{log.activityType}</span></td>
                <td className="px-4 py-2.5 text-slate-700">{log.description}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{log.ipAddress || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /> Prev</button>
        <span className="text-sm text-slate-500">Page {page} of {totalPages} ({total} total)</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer">Next <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── System Metrics ───────────────────────────────────────
function MetricsTab() {
  const metrics = useWsStore((s) => s.metrics);
  if (!metrics) return <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">Waiting for metrics data...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Host System</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3"><Cpu className="w-5 h-5 text-blue-500" /><div><p className="text-sm text-slate-500">CPU</p><p className="font-bold text-lg">{metrics.host?.cpuPercent?.toFixed(1) ?? 0}%</p></div></div>
          <div className="flex items-center gap-3"><HardDrive className="w-5 h-5 text-purple-500" /><div><p className="text-sm text-slate-500">Memory</p><p className="font-bold text-lg">{((metrics.host?.memoryUsedMb ?? 0) / 1024).toFixed(1)} / {((metrics.host?.memoryTotalMb ?? 0) / 1024).toFixed(0)} GB</p></div></div>
        </div>
        {metrics.host?.diskUsage && <div className="mt-4 space-y-2">{metrics.host.diskUsage.map((disk: any, i: number) => <div key={i} className="flex justify-between text-sm"><span className="text-slate-500 font-mono">{disk.mount}</span><span className="text-slate-700">{disk.usedGb?.toFixed(1)} / {disk.totalGb?.toFixed(0)} GB</span></div>)}</div>}
      </div>
      {metrics.containers && metrics.containers.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Containers</h3>
          <div className="space-y-3">{metrics.containers.map((c: any) => <div key={c.containerId} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"><span className="text-sm font-medium text-slate-700">{c.userId}</span><div className="flex gap-4 text-sm text-slate-500"><span>CPU: {c.cpuPercent?.toFixed(1)}%</span><span>RAM: {c.memoryUsedMb?.toFixed(0)} MB</span></div></div>)}</div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Panel ─────────────────────────────────────
export function AdminPanel() {
  const [subTab, setSubTab] = useState<SubTab>('users');

  const subTabs: { id: SubTab; icon: typeof Users; label: string }[] = [
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'devices', icon: Shield, label: 'Devices' },
    { id: 'containers', icon: Server, label: 'Containers' },
    { id: 'folders', icon: FolderOpen, label: 'Shared Folders' },
    { id: 'logs', icon: Activity, label: 'Logs' },
    { id: 'metrics', icon: Cpu, label: 'Metrics' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Admin Panel</h1>
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {subTabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setSubTab(id)} className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg cursor-pointer whitespace-nowrap ${subTab === id ? 'bg-white text-blue-600 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>
      {subTab === 'users' && <UsersTab />}
      {subTab === 'devices' && <DevicesTab />}
      {subTab === 'containers' && <ContainersTab />}
      {subTab === 'folders' && <SharedFoldersTab />}
      {subTab === 'logs' && <LogsTab />}
      {subTab === 'metrics' && <MetricsTab />}
    </div>
  );
}
