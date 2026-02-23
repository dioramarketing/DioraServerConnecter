import { useEffect, useState, useRef, type FormEvent } from 'react';
import { api } from '../api/client';
import { Upload, Trash2, Package, X, Monitor, Apple, Globe } from 'lucide-react';
import { format } from 'date-fns';

interface PlatformInfo {
  url: string;
  signature: string;
}

interface Release {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, PlatformInfo>;
}

const PLATFORM_LABELS: Record<string, { label: string; icon: typeof Monitor }> = {
  'windows-x86_64': { label: 'Windows', icon: Monitor },
  'darwin-x86_64': { label: 'macOS (Intel)', icon: Apple },
  'darwin-aarch64': { label: 'macOS (ARM)', icon: Apple },
  'linux-x86_64': { label: 'Linux', icon: Globe },
};

export function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.get<Release[]>('/admin/releases').then(setReleases).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handlePublish = async (e: FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      setError('파일을 선택해주세요.');
      return;
    }
    setError('');
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('version', version);
    formData.append('notes', notes);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/admin/releases');
        const token = localStorage.getItem('accessToken');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      setShowModal(false);
      setVersion('');
      setNotes('');
      setFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (v: string) => {
    if (!confirm(`v${v} 릴리스를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/admin/releases/${v}`);
      load();
    } catch { /* */ }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Releases</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 cursor-pointer"
        >
          <Upload className="w-4 h-4" /> 릴리스 발행
        </button>
      </div>

      {/* Release list */}
      <div className="space-y-4">
        {releases.map((r) => (
          <div key={r.version} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Package className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-slate-800 text-lg">v{r.version}</h3>
                </div>
                <p className="text-sm text-slate-400 mb-2">
                  {r.pub_date ? format(new Date(r.pub_date), 'yyyy-MM-dd HH:mm') : ''}
                </p>
                {r.notes && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap mb-3">{r.notes}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {Object.keys(r.platforms).map((platform) => {
                    const info = PLATFORM_LABELS[platform];
                    const Icon = info?.icon || Globe;
                    return (
                      <span key={platform} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-xs text-slate-600">
                        <Icon className="w-3.5 h-3.5" />
                        {info?.label || platform}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => handleDelete(r.version)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {releases.length === 0 && (
          <p className="text-center py-12 text-slate-400">릴리스가 없습니다.</p>
        )}
      </div>

      {/* Publish modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">릴리스 발행</h2>
              <button
                onClick={() => { setShowModal(false); setError(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">버전</label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.1.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">릴리스 노트</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="이 릴리스의 변경 사항..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">업데이트 파일</label>
                <p className="text-xs text-slate-400 mb-2">
                  플랫폼별 업데이트 번들과 .sig 서명 파일을 함께 선택하세요.
                  <br />
                  (예: app.nsis.zip + app.nsis.zip.sig)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => setFiles(e.target.files)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                  accept=".zip,.gz,.sig"
                />
              </div>

              {uploading && (
                <div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>업로드 중...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {uploading ? '업로드 중...' : '발행'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); }}
                  className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg text-sm cursor-pointer"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
