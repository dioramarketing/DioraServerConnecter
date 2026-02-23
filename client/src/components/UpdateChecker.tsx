import { useState, useEffect, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Download, RefreshCw, RotateCcw, X, ArrowUpCircle } from 'lucide-react';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function UpdateChecker({ manualCheck }: { manualCheck?: boolean }) {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      setState('checking');
      setError('');
      const update = await check();

      if (update) {
        setVersion(update.version);
        setNotes(update.body || '');
        setState('available');
        setDismissed(false);
      } else {
        setState('idle');
        if (manualCheck) {
          setError('최신 버전입니다.');
          setTimeout(() => setError(''), 3000);
        }
      }
    } catch (err: any) {
      setState('error');
      setError(err?.message || '업데이트 확인 실패');
    }
  }, [manualCheck]);

  const downloadAndInstall = useCallback(async () => {
    try {
      setState('downloading');
      setProgress(0);

      const update = await check();
      if (!update) {
        setState('error');
        setError('업데이트를 찾을 수 없습니다.');
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            break;
        }
      });

      setState('ready');
    } catch (err: any) {
      setState('error');
      setError(err?.message || '다운로드 실패');
    }
  }, []);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  // Auto-check 3 seconds after mount
  useEffect(() => {
    if (manualCheck) {
      checkForUpdate();
      return;
    }
    const timer = setTimeout(checkForUpdate, 3000);
    return () => clearTimeout(timer);
  }, [checkForUpdate, manualCheck]);

  // Don't show anything if idle or dismissed
  if (state === 'idle' || (state === 'available' && dismissed)) return null;
  if (state === 'checking' && !manualCheck) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4" />
          <span className="text-sm font-medium">업데이트</span>
        </div>
        {(state === 'available' || state === 'error') && (
          <button
            onClick={() => {
              if (state === 'available') setDismissed(true);
              else setState('idle');
            }}
            className="p-0.5 hover:bg-blue-500 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Checking */}
        {state === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            업데이트 확인 중...
          </div>
        )}

        {/* Available */}
        {state === 'available' && (
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-1">v{version} 사용 가능</p>
            {notes && (
              <p className="text-xs text-slate-500 mb-3 max-h-20 overflow-auto whitespace-pre-wrap">{notes}</p>
            )}
            <button
              onClick={downloadAndInstall}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              다운로드 & 설치
            </button>
          </div>
        )}

        {/* Downloading */}
        {state === 'downloading' && (
          <div>
            <p className="text-sm text-slate-600 mb-2">다운로드 중... {progress}%</p>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Ready to restart */}
        {state === 'ready' && (
          <div>
            <p className="text-sm text-green-600 font-medium mb-3">설치 완료! 재시작하면 적용됩니다.</p>
            <button
              onClick={handleRelaunch}
              className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              지금 재시작
            </button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div>
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button
              onClick={checkForUpdate}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              재시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
