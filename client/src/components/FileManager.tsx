import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import {
  FolderOpen, File, FileText, FileImage, FileCode, FileArchive, FileVideo, FileAudio,
  ArrowUp, Download, Upload, Trash2, FolderPlus, RefreshCw, Link, AlertCircle,
  Search, X, Edit3, LayoutGrid, LayoutList, ChevronRight, Home, HardDrive,
  Eye, Copy, Scissors, Clipboard,
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
    return d.toLocaleDateString('ko-KR') + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

const EXT_ICONS: Record<string, typeof File> = {
  txt: FileText, md: FileText, log: FileText, csv: FileText, json: FileCode,
  js: FileCode, ts: FileCode, jsx: FileCode, tsx: FileCode, py: FileCode,
  html: FileCode, css: FileCode, xml: FileCode, yaml: FileCode, yml: FileCode,
  sh: FileCode, sql: FileCode, rs: FileCode, go: FileCode, java: FileCode,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, svg: FileImage, webp: FileImage, bmp: FileImage, ico: FileImage,
  mp4: FileVideo, avi: FileVideo, mov: FileVideo, mkv: FileVideo, webm: FileVideo,
  mp3: FileAudio, wav: FileAudio, flac: FileAudio, ogg: FileAudio,
  zip: FileArchive, tar: FileArchive, gz: FileArchive, rar: FileArchive, '7z': FileArchive,
};

const PREVIEWABLE_EXT = new Set(['txt', 'md', 'log', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'sh', 'sql', 'rs', 'go', 'java', 'toml', 'cfg', 'conf', 'env', 'gitignore', 'dockerfile', 'makefile']);

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_ICONS[ext] || File;
}

function isPreviewable(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const lower = name.toLowerCase();
  return PREVIEWABLE_EXT.has(ext) || lower.startsWith('.') || lower === 'makefile' || lower === 'dockerfile';
}

export function FileManager() {
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Rename
  const [renamingItem, setRenamingItem] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Preview
  const [previewFile, setPreviewFile] = useState<{ name: string; content: string; truncated: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Clipboard (cut/copy)
  const [clipboard, setClipboard] = useState<{ path: string; name: string; action: 'cut' | 'copy' } | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);

  // Upload progress
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    setSearchResults(null);
    setSearching(false);
    setPreviewFile(null);
    setRenamingItem(null);
    try {
      const data = await api.get<FileEntry[]>(`/files/ls?path=${encodeURIComponent(path)}`);
      setEntries(data);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectory(currentPath); }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const joinPath = (base: string, name: string) => base === '/' ? `/${name}` : `${base}/${name}`;

  const navigateUp = () => {
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    loadDirectory(parent);
  };

  const handleClick = (entry: FileEntry) => {
    if (entry.type === 'directory' || entry.type === 'link') {
      loadDirectory(joinPath(currentPath, entry.name));
    }
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.type === 'file') {
      if (isPreviewable(entry.name)) {
        handlePreview(entry.name);
      } else {
        handleDownload(entry.name);
      }
    }
  };

  const handlePreview = async (name: string) => {
    setPreviewLoading(true);
    try {
      const data = await api.get<{ content: string; truncated: boolean }>(`/files/preview?path=${encodeURIComponent(joinPath(currentPath, name))}`);
      setPreviewFile({ name, ...data });
    } catch (err: any) {
      setError(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (name: string) => {
    try {
      const res = await api.raw(`/files/read?path=${encodeURIComponent(joinPath(currentPath, name))}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const uploadFile = async (file: globalThis.File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setError(`File "${file.name}" is too large (${formatSize(file.size)}). Max ${formatSize(MAX_UPLOAD_SIZE)}.`);
      return;
    }
    setUploading(true);
    setUploadProgress(`Uploading ${file.name} (${formatSize(file.size)})...`);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
      await api.post('/files/write', { path: joinPath(currentPath, file.name), content: base64 });
    } catch (err: any) {
      setError(`Upload failed (${file.name}): ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
      loadDirectory(currentPath);
    };
    input.click();
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file);
    }
    loadDirectory(currentPath);
  }, [currentPath]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/files/mkdir', { path: joinPath(currentPath, newFolderName.trim()) });
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
      await api.post('/files/delete', { path: joinPath(currentPath, name) });
      loadDirectory(currentPath);
    } catch (err: any) { setError(err.message); }
  };

  const handleRename = async (oldName: string) => {
    if (!renameValue.trim()) {
      setRenamingItem(null);
      return;
    }
    if (renameValue === oldName) { setRenamingItem(null); return; }
    try {
      await api.post('/files/rename', { oldPath: joinPath(currentPath, oldName), newPath: joinPath(currentPath, renameValue.trim()) });
      setRenamingItem(null);
      loadDirectory(currentPath);
    } catch (err: any) { setError(err.message); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const data = await api.get<string[]>(`/files/search?path=${encodeURIComponent(currentPath)}&query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch (err: any) { setError(err.message); }
    finally { setSearching(false); }
  };

  const handleCut = (name: string) => { setClipboard({ path: joinPath(currentPath, name), name, action: 'cut' }); setContextMenu(null); };
  const handleCopy = (name: string) => { setClipboard({ path: joinPath(currentPath, name), name, action: 'copy' }); setContextMenu(null); };

  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.action === 'cut') {
        await api.post('/files/rename', { oldPath: clipboard.path, newPath: joinPath(currentPath, clipboard.name) });
      } else {
        // Copy: write file content to new location
        const res = await api.raw(`/files/read?path=${encodeURIComponent(clipboard.path)}`);
        if (!res.ok) throw new Error('Failed to read source file');
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
        await api.post('/files/write', { path: joinPath(currentPath, clipboard.name), content: base64 });
      }
      setClipboard(null);
      loadDirectory(currentPath);
    } catch (err: any) { setError(`Paste failed: ${err.message}`); }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    // Keep context menu within viewport
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ x, y, entry });
  };

  // Breadcrumb
  const pathParts = currentPath.split('/').filter(Boolean);

  // Quick nav locations
  const locations = [
    { path: '/workspace', label: 'Workspace', icon: Home },
    { path: '/storage', label: 'Storage', icon: HardDrive },
    { path: '/shared', label: 'Shared', icon: FolderOpen },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-44 bg-white border-r border-slate-200 flex flex-col py-3 shrink-0">
        <div className="px-3 mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase">Locations</h2>
        </div>
        {locations.map(({ path, label, icon: Icon }) => (
          <button key={path} onClick={() => loadDirectory(path)} className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer ${currentPath === path || (currentPath.startsWith(path + '/')) ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
        {clipboard && (
          <div className="mt-auto px-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-400 mb-1">Clipboard ({clipboard.action})</div>
            <div className="text-xs text-slate-600 truncate">{clipboard.name}</div>
            <button onClick={handlePaste} className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 cursor-pointer"><Clipboard className="w-3 h-3" /> Paste here</button>
            <button onClick={() => setClipboard(null)} className="mt-1 w-full text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Clear</button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden"
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-white">
          <button onClick={navigateUp} disabled={currentPath === '/'} className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-4 h-4" /></button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-0.5 text-sm flex-1 min-w-0 overflow-hidden">
            <button onClick={() => loadDirectory('/')} className="text-slate-400 hover:text-blue-600 cursor-pointer shrink-0">/</button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-0.5 shrink-0">
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <button onClick={() => loadDirectory('/' + pathParts.slice(0, i + 1).join('/'))} className={`hover:text-blue-600 cursor-pointer ${i === pathParts.length - 1 ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{part}</button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2.5 py-1.5 w-56">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search files..." className="bg-transparent text-sm outline-none flex-1 min-w-0" />
            {searchQuery ? (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="cursor-pointer"><X className="w-3 h-3 text-slate-400" /></button>
            ) : null}
          </div>
          <button onClick={handleSearch} disabled={!searchQuery.trim() || searching} className="p-1.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer" title="Search">
            <Search className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded cursor-pointer ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded cursor-pointer ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>

          <button onClick={() => loadDirectory(currentPath)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={handleUploadClick} disabled={uploading} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"><Upload className="w-3.5 h-3.5" /> Upload</button>
          <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 cursor-pointer"><FolderPlus className="w-3.5 h-3.5" /> New Folder</button>
        </div>

        {/* Status bar */}
        {(uploading || error || showNewFolder || dragOver) && (
          <div className="px-4 py-2 border-b border-slate-200 bg-white space-y-2">
            {dragOver && <div className="p-3 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg text-center text-sm text-blue-600">Drop files here to upload</div>}
            {uploading && <div className="text-sm text-blue-600">{uploadProgress}</div>}
            {error && <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4 shrink-0" /> <span className="flex-1">{error}</span> <button onClick={() => setError('')} className="ml-auto cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button></div>}
            {showNewFolder && (
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' ? handleCreateFolder() : e.key === 'Escape' && (setShowNewFolder(false), setNewFolderName(''))} placeholder="Folder name" className="flex-1 px-2 py-1 text-sm border rounded outline-none focus:border-blue-400" autoFocus />
                <button onClick={handleCreateFolder} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">Create</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="px-3 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300 cursor-pointer">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* Search results */}
        {searchResults !== null ? (
          <div className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-600">
                {searching ? 'Searching...' : `Search results for "${searchQuery}" (${searchResults.length})`}
              </h3>
              <button onClick={() => setSearchResults(null)} className="text-xs text-blue-600 hover:underline cursor-pointer">Back to files</button>
            </div>
            {searchResults.length === 0 && !searching ? (
              <div className="text-center text-slate-400 text-sm py-8">No files found</div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((path, i) => {
                  const parts = path.split('/');
                  const name = parts.pop()!;
                  const dir = parts.join('/') || '/';
                  return (
                    <button key={i} onClick={() => loadDirectory(dir)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 rounded-lg cursor-pointer">
                      <File className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-800 font-medium">{name}</span>
                      <span className="text-slate-400 text-xs truncate">{dir}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* File list */
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Empty folder</p>
                <p className="text-xs mt-1">Drag & drop files or click Upload</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="p-4 grid grid-cols-6 gap-3">
                {entries.map((entry) => {
                  const Icon = entry.type === 'directory' ? FolderOpen : entry.type === 'link' ? Link : getFileIcon(entry.name);
                  const iconColor = entry.type === 'directory' ? 'text-blue-500' : entry.type === 'link' ? 'text-purple-500' : 'text-slate-400';
                  return (
                    <div
                      key={entry.name}
                      className={`flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer group ${clipboard?.path === joinPath(currentPath, entry.name) && clipboard?.action === 'cut' ? 'opacity-50' : ''}`}
                      onClick={() => handleClick(entry)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                    >
                      <Icon className={`w-10 h-10 ${iconColor} mb-2`} />
                      {renamingItem === entry.name ? (
                        <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' ? handleRename(entry.name) : e.key === 'Escape' && setRenamingItem(null)} onBlur={() => handleRename(entry.name)} className="w-full text-xs text-center border rounded px-1 py-0.5 outline-none" autoFocus onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className="text-xs text-slate-700 text-center truncate w-full" title={entry.name}>{entry.name}</span>
                      )}
                      <span className="text-[10px] text-slate-400 mt-0.5">{entry.type === 'directory' ? 'Folder' : formatSize(entry.size)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500 sticky top-0">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium w-24">Size</th>
                    <th className="px-4 py-2.5 font-medium w-44">Modified</th>
                    <th className="px-4 py-2.5 font-medium w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const Icon = entry.type === 'directory' ? FolderOpen : entry.type === 'link' ? Link : getFileIcon(entry.name);
                    const iconColor = entry.type === 'directory' ? 'text-blue-500' : entry.type === 'link' ? 'text-purple-500' : 'text-slate-400';
                    return (
                      <tr
                        key={entry.name}
                        className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${clipboard?.path === joinPath(currentPath, entry.name) && clipboard?.action === 'cut' ? 'opacity-50' : ''}`}
                        onClick={() => handleClick(entry)}
                        onDoubleClick={() => handleDoubleClick(entry)}
                        onContextMenu={(e) => handleContextMenu(e, entry)}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${iconColor} shrink-0`} />
                            {renamingItem === entry.name ? (
                              <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' ? handleRename(entry.name) : e.key === 'Escape' && setRenamingItem(null)} onBlur={() => handleRename(entry.name)} className="flex-1 px-1.5 py-0.5 text-sm border rounded outline-none" autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                              <span className={entry.type === 'directory' ? 'text-blue-600 font-medium' : 'text-slate-700'}>{entry.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{entry.type === 'directory' ? '-' : formatSize(entry.size)}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{formatDate(entry.modified)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {entry.type === 'file' && isPreviewable(entry.name) && (
                              <button onClick={() => handlePreview(entry.name)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                            )}
                            {entry.type === 'file' && (
                              <button onClick={() => handleDownload(entry.name)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer" title="Download"><Download className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => { setRenamingItem(entry.name); setRenameValue(entry.name); }} className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer" title="Rename"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(entry.name)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 flex items-center justify-between">
          <span>{searchResults !== null ? `${searchResults.length} results` : `${entries.length} items`}</span>
          <span>{currentPath}</span>
        </div>
      </div>

      {/* Preview panel */}
      {(previewFile || previewLoading) && (
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-slate-800 truncate">{previewFile?.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {previewFile && (
                <button onClick={() => handleDownload(previewFile.name)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer" title="Download"><Download className="w-3.5 h-3.5" /></button>
              )}
              <button onClick={() => setPreviewFile(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {previewLoading ? (
              <div className="text-center py-8"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
            ) : previewFile ? (
              <>
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">{previewFile.content}</pre>
                {previewFile.truncated && (
                  <div className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    File truncated (showing first 100KB). <button onClick={() => previewFile && handleDownload(previewFile.name)} className="underline cursor-pointer">Download full file</button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.entry.type === 'file' && isPreviewable(contextMenu.entry.name) && (
            <button onClick={() => { handlePreview(contextMenu.entry.name); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><Eye className="w-4 h-4" /> Preview</button>
          )}
          {contextMenu.entry.type === 'file' && (
            <button onClick={() => { handleDownload(contextMenu.entry.name); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><Download className="w-4 h-4" /> Download</button>
          )}
          <button onClick={() => { setRenamingItem(contextMenu.entry.name); setRenameValue(contextMenu.entry.name); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><Edit3 className="w-4 h-4" /> Rename</button>
          <button onClick={() => handleCut(contextMenu.entry.name)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><Scissors className="w-4 h-4" /> Cut</button>
          <button onClick={() => handleCopy(contextMenu.entry.name)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><Copy className="w-4 h-4" /> Copy</button>
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { handleDelete(contextMenu.entry.name); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      )}
    </div>
  );
}
