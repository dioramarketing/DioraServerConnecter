import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  FolderOpen,
  File,
  ArrowUp,
  Download,
  Upload,
  Trash2,
  FolderPlus,
  RefreshCw,
  Link,
  AlertCircle,
} from 'lucide-react';

interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'link' | 'other';
  size: number;
  modified: string;
  permissions: string;
  owner: string;
  group: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
           d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function FileManager() {
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<FileEntry[]>(`/files/ls?path=${encodeURIComponent(path)}`);
      setEntries(data);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  const navigateUp = () => {
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    loadDirectory(parent);
  };

  const handleClick = (entry: FileEntry) => {
    if (entry.type === 'directory' || entry.type === 'link') {
      const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
      loadDirectory(newPath);
    } else {
      handleDownload(entry.name);
    }
  };

  const handleDownload = async (name: string) => {
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    try {
      const res = await api.raw(`/files/read?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.tar`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
        await api.post('/files/write', { path: filePath, content: base64 });
        loadDirectory(currentPath);
      } catch (err: any) {
        setError(err.message);
      }
    };
    input.click();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const dirPath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
      await api.post('/files/mkdir', { path: dirPath });
      setShowNewFolder(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const itemPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      await api.post('/files/delete', { path: itemPath });
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">File Manager</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => loadDirectory(currentPath)} className="p-2 text-slate-500 hover:text-slate-700 cursor-pointer" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleUpload} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 cursor-pointer">
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
        </div>
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-2 mb-4 p-2.5 bg-white rounded-lg border border-slate-200">
        <button onClick={navigateUp} disabled={currentPath === '/'} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer">
          <ArrowUp className="w-4 h-4" />
        </button>
        <span className="text-sm font-mono text-slate-600 select-all">{currentPath}</span>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <FolderOpen className="w-4 h-4 text-blue-500" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="Folder name"
            className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded outline-none focus:border-blue-400"
            autoFocus
          />
          <button onClick={handleCreateFolder} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            Create
          </button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="px-3 py-1 text-sm bg-slate-200 text-slate-600 rounded hover:bg-slate-300 cursor-pointer">
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* File list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Empty directory</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium w-24">Size</th>
                <th className="px-4 py-2.5 font-medium w-44">Modified</th>
                <th className="px-4 py-2.5 font-medium w-28">Permissions</th>
                <th className="px-4 py-2.5 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.name}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleClick(entry)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {entry.type === 'directory' ? (
                        <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : entry.type === 'link' ? (
                        <Link className="w-4 h-4 text-purple-500 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={entry.type === 'directory' ? 'text-blue-600 font-medium' : 'text-slate-700'}>
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {entry.type === 'directory' ? '-' : formatSize(entry.size)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(entry.modified)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{entry.permissions}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {entry.type === 'file' && (
                        <button
                          onClick={() => handleDownload(entry.name)}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(entry.name)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
