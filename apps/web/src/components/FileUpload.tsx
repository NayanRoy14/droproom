import { useState, useCallback, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { API_URL } from '@/lib/config';

export function FileUpload({ roomId, sessionId, onUploadComplete }: { roomId: string, sessionId: string, onUploadComplete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const cancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setFileName('');
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      setError('File is too large (max 100 MB)');
      return;
    }

    setUploading(true);
    setProgress(0);
    setFileName(file.name);
    setError('');
    setJustCompleted(false);

    try {
      const adminToken = localStorage.getItem(`dropxyz_admin_${roomId}`) || localStorage.getItem(`droproom_admin_${roomId}`);
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          sessionId,
          adminToken
        })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to authorize upload');
      }
      const { uploadUrl, fileId, objectKey } = await res.json();
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
        xhr.send(file);
      });
      
      await fetch(`${API_URL}/api/rooms/${roomId}/file-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          objectKey,
          originalName: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          participantId: sessionId || (adminToken ? 'admin' : 'anonymous'),
          adminToken,
          sessionId
        })
      });
      
      setJustCompleted(true);
      setTimeout(() => {
        setJustCompleted(false);
      }, 1500);

      onUploadComplete();
    } catch (e: any) {
      if (e.message !== 'Upload cancelled') {
        setError(e.message || 'Upload failed');
      }
    } finally {
      xhrRef.current = null;
      setUploading(false);
      setProgress(0);
      setFileName('');
    }
  }, [roomId, sessionId, onUploadComplete]);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setDragOver(false);
    let selectedFile: File | null = null;
    
    if ('dataTransfer' in e && e.dataTransfer?.files?.[0]) {
      selectedFile = e.dataTransfer.files[0];
    } else if (e.target && 'files' in e.target) {
      const inputEl = e.target as HTMLInputElement;
      if (inputEl.files && inputEl.files[0]) {
        selectedFile = inputEl.files[0];
      }
      inputEl.value = '';
    }

    if (!selectedFile) return;
    handleFile(selectedFile);
  }, [handleFile]);

  if (uploading) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/80 p-4 sm:p-5 animate-pop-in shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-live shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate text-[var(--fg)]">{fileName}</span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-[var(--muted)] font-mono tabular-nums">{progress}%</span>
            <button
              onClick={cancelUpload}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors cursor-pointer"
              title="Cancel upload"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="w-full h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
          <div 
            className="h-full bg-[var(--fg)] rounded-full transition-all duration-200 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (justCompleted) {
    return (
      <div className="rounded-2xl border border-[var(--success-line)] bg-[var(--success-bg)] p-4 flex items-center justify-center gap-2 text-xs font-medium text-[var(--success)] animate-pop-in shadow-xs">
        <Check className="w-4 h-4" />
        <span>File uploaded to room</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <label
        className={`
          flex flex-col items-center justify-center gap-2.5 w-full py-8 sm:py-9 px-6
          rounded-2xl border border-dashed cursor-pointer
          transition-all duration-200 select-none group
          ${dragOver 
            ? 'border-[var(--fg)] bg-[var(--hover)]/80 scale-[1.008]' 
            : 'border-[var(--line)] hover:border-[var(--faint)] hover:bg-[var(--surface)]/50 active:scale-[0.995]'
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop as any}
      >
        <div className="w-10 h-10 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--fg)] group-hover:border-[var(--faint)] group-hover:scale-105 transition-all shadow-2xs">
          <Upload className={`w-4 h-4 transition-transform duration-200 ${dragOver ? '-translate-y-0.5 text-[var(--fg)]' : ''}`} />
        </div>
        <div className="text-center space-y-0.5">
          <div className="text-xs sm:text-sm font-medium text-[var(--fg)]">
            Drop file here or <span className="underline underline-offset-3 decoration-[var(--line)] group-hover:decoration-[var(--fg)] transition-colors">browse</span>
          </div>
          <p className="text-[11px] text-[var(--faint)]">
            Any file type up to 100 MB · Ephemeral
          </p>
        </div>
        <input type="file" className="hidden" onChange={onDrop} />
      </label>

      {error && (
        <div className="flex items-center justify-between text-xs text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-line)] rounded-xl px-3.5 py-2.5 animate-slide-down">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button onClick={() => setError('')} className="ml-2 hover:opacity-75 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
