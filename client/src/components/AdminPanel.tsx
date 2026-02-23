import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useWsStore } from '../stores/ws';
import {
  Users, Shield, Server, Activity, Cpu,
  Plus, Check, X, Trash2, Play, Square,
  ChevronLeft, ChevronRight, RefreshCw,
  HardDrive, AlertCircle,
} from 'lucide-react';

type SubTab = 'users' | 'devices' | 'containers' | 'logs' | 'metrics';

// ── Users Management ─────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [error, setError] = useState('');

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
    try {
      await api.post('/auth/register', form);
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'USER' });
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleSuspend = async (id: string) => {
    try {
      await api.patch(`/admin/users/${id}`, { status: 'SUSPENDED' });
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleActivate = async (id: string) => {
    try {
      await api.patch(`/admin/users/${id}`, { status: 'ACTIVE' });
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{users.length} users</span>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> Create User
        </button>
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
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-300 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2.5 font-medium">Username</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.username}</td>
                <td className="px-4 py-2.5 text-slate-500">{u.email}</td>
                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : u.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span></td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {u.status === 'ACTIVE' ? (
                      <button onClick={() => handleSuspend(u.id)} className="p-1 text-yellow-500 hover:text-yellow-700 cursor-pointer" title="Suspend"><X className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => handleActivate(u.id)} className="p-1 text-green-500 hover:text-green-700 cursor-pointer" title="Activate"><Check className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => handleDelete(u.id, u.username)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    try {
      const data = await api.get<any[]>('/devices/pending');
      setDevices(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDevices(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    try {
      await api.post(`/devices/${id}/${action}`);
      loadDevices();
    } catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
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
                  <button onClick={() => handleAction(d.id, 'approve')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 cursor-pointer">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => handleAction(d.id, 'reject')} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 cursor-pointer">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
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
  const [error, setError] = useState('');

  const loadContainers = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/containers');
      setContainers(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadAvailableUsers = async () => {
    try {
      const users = await api.get<any[]>('/admin/users');
      // Filter users who don't already have a container
      const containerUserIds = new Set(containers.map(c => c.userId));
      setAvailableUsers(users.filter((u: any) => !containerUserIds.has(u.id)));
    } catch { /* */ }
  };

  useEffect(() => { loadContainers(); }, []);
  useEffect(() => { if (showCreate) loadAvailableUsers(); }, [showCreate, containers]);

  const handleCreate = async () => {
    if (!selectedUserId) return;
    setError('');
    try {
      await api.post('/containers', { userId: selectedUserId });
      setShowCreate(false);
      setSelectedUserId('');
      loadContainers();
    } catch (err: any) { setError(err.message); }
  };

  const handleAction = async (userId: string, action: 'start' | 'stop') => {
    try {
      await api.post(`/containers/${userId}/${action}`);
      loadContainers();
    } catch (err: any) { setError(err.message); }
  };

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">{containers.length} containers</span>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> Create Container
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg outline-none">
            <option value="">Select user...</option>
            {availableUsers.map((u: any) => (
              <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!selectedUserId} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer">Create</button>
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
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c.status}
                </span>
                {c.status === 'RUNNING' ? (
                  <button onClick={() => handleAction(c.userId, 'stop')} className="p-1.5 text-red-500 hover:text-red-700 cursor-pointer" title="Stop">
                    <Square className="w-4 h-4" />
                  </button>
                ) : c.status === 'STOPPED' ? (
                  <button onClick={() => handleAction(c.userId, 'start')} className="p-1.5 text-green-500 hover:text-green-700 cursor-pointer" title="Start">
                    <Play className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Logs ────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const offset = (p - 1) * pageSize;
      const data = await api.get<any>(`/admin/logs?limit=${pageSize}&offset=${offset}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(page); }, [page]);

  if (loading) return <div className="p-4 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2.5 font-medium w-40">Time</th>
              <th className="px-4 py-2.5 font-medium w-36">Type</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium w-28">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
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
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-sm text-slate-500">Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── System Metrics ───────────────────────────────────────
function MetricsTab() {
  const metrics = useWsStore((s) => s.metrics);

  if (!metrics) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
        Waiting for metrics data...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Host metrics */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4">Host System</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-slate-500">CPU</p>
              <p className="font-bold text-lg">{metrics.host?.cpuPercent?.toFixed(1) ?? 0}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm text-slate-500">Memory</p>
              <p className="font-bold text-lg">{((metrics.host?.memoryUsedMb ?? 0) / 1024).toFixed(1)} / {((metrics.host?.memoryTotalMb ?? 0) / 1024).toFixed(0)} GB</p>
            </div>
          </div>
        </div>
        {metrics.host?.diskUsage && (
          <div className="mt-4 space-y-2">
            {metrics.host.diskUsage.map((disk: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-500 font-mono">{disk.mount}</span>
                <span className="text-slate-700">{disk.usedGb?.toFixed(1)} / {disk.totalGb?.toFixed(0)} GB</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Container metrics */}
      {metrics.containers && metrics.containers.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Containers</h3>
          <div className="space-y-3">
            {metrics.containers.map((c: any) => (
              <div key={c.containerId} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm font-medium text-slate-700">{c.userId}</span>
                <div className="flex gap-4 text-sm text-slate-500">
                  <span>CPU: {c.cpuPercent?.toFixed(1)}%</span>
                  <span>RAM: {c.memoryUsedMb?.toFixed(0)} MB</span>
                </div>
              </div>
            ))}
          </div>
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
    { id: 'logs', icon: Activity, label: 'Logs' },
    { id: 'metrics', icon: Cpu, label: 'Metrics' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Admin Panel</h1>

      {/* Sub tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
        {subTabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg cursor-pointer ${
              subTab === id
                ? 'bg-white text-blue-600 font-medium shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {subTab === 'users' && <UsersTab />}
      {subTab === 'devices' && <DevicesTab />}
      {subTab === 'containers' && <ContainersTab />}
      {subTab === 'logs' && <LogsTab />}
      {subTab === 'metrics' && <MetricsTab />}
    </div>
  );
}
