import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { FolderPlus, UserPlus, UserMinus } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  creator: { id: string; username: string };
  members: { id: string; userId: string; permission: string; user: { id: string; username: string } }[];
}

export function SharedFoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const load = () => {
    api.get<Folder[]>('/admin/shared-folders').then(setFolders).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/admin/shared-folders', { name });
    setName('');
    setShowCreate(false);
    load();
  };

  const addMember = async (folderId: string) => {
    const userId = prompt('Enter user ID to add:');
    if (!userId) return;
    const permission = prompt('Permission (READ or READWRITE):', 'READ');
    if (!permission) return;
    await api.post(`/admin/shared-folders/${folderId}/members`, { userId, permission });
    load();
  };

  const removeMember = async (folderId: string, userId: string) => {
    await api.delete(`/admin/shared-folders/${folderId}/members/${userId}`);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Shared Folders</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer">
          <FolderPlus className="w-4 h-4" /> Create Folder
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="project-name" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" required />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer">Cancel</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {folders.map((f) => (
          <div key={f.id} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{f.name}</h3>
                <p className="text-sm text-slate-400 font-mono">{f.path}</p>
                <p className="text-xs text-slate-400 mt-1">Created by {f.creator.username}</p>
              </div>
              <button onClick={() => addMember(f.id)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200 cursor-pointer">
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>
            {f.members.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {f.members.map((m) => (
                  <span key={m.id} className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm">
                    {m.user.username}
                    <span className="text-xs text-slate-400">({m.permission})</span>
                    <button onClick={() => removeMember(f.id, m.userId)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {folders.length === 0 && <p className="text-center py-8 text-slate-400">No shared folders</p>}
      </div>
    </div>
  );
}
