"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, Check, AlertCircle, FolderUp, Files, File as FileIcon } from 'lucide-react';
import { API_URL } from '@/lib/config';
import { formatBytes } from '@/lib/utils';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  xhr?: XMLHttpRequest;
}

interface FileUploadProps {
  roomId: string;
  sessionId: string;
  onUploadComplete: () => void;
  externalFiles?: File[] | null;
  onClearExternalFiles?: () => void;
}

export function FileUpload({ 
  roomId, 
  sessionId, 
  onUploadComplete,
  externalFiles,
  onClearExternalFiles 
}: FileUploadProps) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [justCompletedCount, setJustCompletedCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<UploadQueueItem[]>([]);
  queueRef.current = queue;

  const addFilesToQueue = useCallback((files: File[]) => {
    if (!files.length) return;

    const newItems: UploadQueueItem[] = files.map((file) => {
      const isOversized = file.size > MAX_FILE_SIZE;
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: isOversized ? 'error' : 'queued',
        error: isOversized ? 'Exceeds 1 GB max size' : undefined,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  // Process incoming files from external drag-and-drop
  useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      addFilesToQueue(externalFiles);
      onClearExternalFiles?.();
    }
  }, [externalFiles, onClearExternalFiles, addFilesToQueue]);

  const startUpload = useCallback(async (itemId: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: 'uploading' } : item))
    );

    const targetItem = queueRef.current.find((item) => item.id === itemId);
    if (!targetItem) return;

    const file = targetItem.file;

    try {
      const adminToken =
        localStorage.getItem(`dropxyz_admin_${roomId}`) ||
        localStorage.getItem(`droproom_admin_${roomId}`);

      // 1. Authorize & generate presigned URL
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          sessionId,
          adminToken,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to authorize upload');
      }

      const { uploadUrl, fileId, objectKey } = await res.json();

      // 2. Direct PUT upload to Cloudflare R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        setQueue((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, xhr } : item))
        );

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setQueue((prev) =>
              prev.map((item) => (item.id === itemId ? { ...item, progress: percent } : item))
            );
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

      // 3. Register file completion in DO SQLite
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
          sessionId,
        }),
      });

      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: 'completed', progress: 100, xhr: undefined } : item
        )
      );

      onUploadComplete();
    } catch (e: any) {
      if (e.message === 'Upload cancelled') {
        setQueue((prev) => prev.filter((item) => item.id !== itemId));
      } else {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'error', error: e.message || 'Upload failed', xhr: undefined }
              : item
          )
        );
      }
    }
  }, [roomId, sessionId, onUploadComplete]);

  // Worker loop for concurrent uploads
  useEffect(() => {
    const activeUploads = queue.filter((item) => item.status === 'uploading');
    const queuedItems = queue.filter((item) => item.status === 'queued');

    // Run up to 2 uploads concurrently
    if (activeUploads.length < 2 && queuedItems.length > 0) {
      const nextItem = queuedItems[0];
      startUpload(nextItem.id);
    }

    // Check if entire non-empty batch just completed
    const nonErrorItems = queue.filter((item) => item.status !== 'error' && item.status !== 'cancelled');
    if (
      nonErrorItems.length > 0 &&
      nonErrorItems.every((item) => item.status === 'completed') &&
      activeUploads.length === 0
    ) {
      const count = nonErrorItems.length;
      setJustCompletedCount(count);
      const timer = setTimeout(() => {
        setQueue((prev) => prev.filter((item) => item.status !== 'completed'));
        setJustCompletedCount(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [queue, startUpload]);

  const cancelUpload = (itemId: string) => {
    const item = queueRef.current.find((x) => x.id === itemId);
    if (item?.xhr) {
      item.xhr.abort();
    }
    setQueue((prev) => prev.filter((x) => x.id !== itemId));
  };

  const cancelAll = () => {
    queueRef.current.forEach((item) => {
      if (item.xhr) item.xhr.abort();
    });
    setQueue([]);
  };

  // HTML5 Directory & File Recursive Reader
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const items = Array.from(e.dataTransfer.items || []);
    const extractedFiles: File[] = [];

    async function traverseEntry(entry: any, path = ''): Promise<void> {
      if (!entry) return;
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file(
            (file: File) => {
              const relativeName = path ? `${path}/${file.name}` : file.name;
              const tagged = new File([file], relativeName, {
                type: file.type,
                lastModified: file.lastModified,
              });
              extractedFiles.push(tagged);
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            const all: any[] = [];
            function readBatch() {
              dirReader.readEntries(
                (batch: any[]) => {
                  if (batch.length === 0) {
                    resolve(all);
                  } else {
                    all.push(...batch);
                    readBatch();
                  }
                },
                () => resolve(all)
              );
            }
            readBatch();
          });
        };

        const children = await readEntries();
        const nextPath = path ? `${path}/${entry.name}` : entry.name;
        for (const child of children) {
          await traverseEntry(child, nextPath);
        }
      }
    }

    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    if (entries.length > 0) {
      for (const entry of entries) {
        await traverseEntry(entry);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      extractedFiles.push(...Array.from(e.dataTransfer.files));
    }

    if (extractedFiles.length > 0) {
      addFilesToQueue(extractedFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const activeOrQueued = queue.filter(
    (item) => item.status === 'uploading' || item.status === 'queued'
  );
  const totalQueueSize = queue.reduce((acc, i) => acc + i.size, 0);
  const completedCount = queue.filter((i) => i.status === 'completed').length;

  return (
    <div className="space-y-3">
      {/* Hidden File & Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Uploading Queue UI */}
      {queue.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 p-4 space-y-3 animate-pop-in shadow-xs">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--line)]/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-live" />
              <span className="font-medium text-[var(--fg)]">
                {activeOrQueued.length > 0
                  ? `Uploading (${completedCount}/${queue.length})`
                  : `Batch Complete (${queue.length} files)`}
              </span>
              <span className="text-[var(--faint)] font-mono">
                · {formatBytes(totalQueueSize)}
              </span>
            </div>
            <button
              onClick={cancelAll}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
            >
              {activeOrQueued.length > 0 ? 'Cancel all' : 'Dismiss'}
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-xs bg-[var(--bg)]/70 p-2.5 rounded-xl border border-[var(--line)]/50"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileIcon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate text-[var(--fg)]" title={item.name}>
                        {item.name}
                      </span>
                      <span className="text-[10px] text-[var(--faint)] font-mono shrink-0">
                        {formatBytes(item.size)}
                      </span>
                    </div>

                    {/* Progress Bar or Status */}
                    {item.status === 'uploading' && (
                      <div className="w-full h-1 bg-[var(--line)] rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-[var(--fg)] transition-all duration-150 ease-out rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.status === 'error' && (
                      <span className="text-[10px] text-[var(--danger)] block mt-0.5">
                        {item.error || 'Failed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'uploading' && (
                    <span className="text-[10px] text-[var(--muted)] font-mono tabular-nums">
                      {item.progress}%
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <Check className="w-4 h-4 text-[var(--success)]" />
                  )}
                  {item.status === 'queued' && (
                    <span className="text-[10px] text-[var(--faint)] font-mono">Queued</span>
                  )}
                  <button
                    onClick={() => cancelUpload(item.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--faint)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Just Completed Badge */}
      {justCompletedCount !== null && queue.length === 0 && (
        <div className="rounded-2xl border border-[var(--success-line)] bg-[var(--success-bg)] p-3.5 flex items-center justify-center gap-2 text-xs font-medium text-[var(--success)] animate-pop-in shadow-xs">
          <Check className="w-4 h-4" />
          <span>
            {justCompletedCount === 1 ? 'File uploaded to room' : `${justCompletedCount} files uploaded to room`}
          </span>
        </div>
      )}

      {/* Minimal Dropzone */}
      <div
        className={`
          flex flex-col items-center justify-center gap-2.5 w-full py-7 sm:py-8 px-6
          rounded-2xl border border-dashed transition-all duration-200 select-none
          ${
            dragOver
              ? 'border-[var(--fg)] bg-[var(--hover)]/80 scale-[1.008]'
              : 'border-[var(--line)] hover:border-[var(--faint)] hover:bg-[var(--surface)]/50'
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="w-10 h-10 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] transition-all shadow-2xs">
          <Upload className={`w-4 h-4 transition-transform duration-200 ${dragOver ? '-translate-y-0.5 text-[var(--fg)]' : ''}`} />
        </div>

        <div className="text-center space-y-1">
          <div className="text-xs sm:text-sm font-medium text-[var(--fg)]">
            Drop files or folder here, or{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="underline underline-offset-3 decoration-[var(--line)] hover:decoration-[var(--fg)] transition-colors cursor-pointer"
            >
              browse files
            </button>
            {' / '}
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="underline underline-offset-3 decoration-[var(--line)] hover:decoration-[var(--fg)] transition-colors cursor-pointer"
            >
              folder
            </button>
          </div>
          <p className="text-[11px] text-[var(--faint)]">
            Multiple files & folders up to 1 GB each · Ephemeral
          </p>
        </div>
      </div>
    </div>
  );
}
