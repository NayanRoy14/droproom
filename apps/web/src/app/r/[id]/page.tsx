"use client";

import { useEffect, useState, useRef } from 'react';
import { useRoom } from '@/lib/useRoom';
import { FileUpload } from '@/components/FileUpload';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DropLogo } from '@/components/DropLogo';
import { DropBrand } from '@/components/DropBrand';
import { 
  Users, Check, X, LogOut, Send, AlertCircle, 
  FileText, Copy, CheckCheck, Image as ImageIcon, 
  FileCode, Archive, Music, Film, ShieldAlert,
  QrCode, Upload, Smile, Reply, Trash2, MessageSquare, Plus,
  ChevronDown
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/config';
import { QRCodeModal } from '@/components/QRCodeModal';
import { ChatReference, ReactionSummary } from '@droproom/shared';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const WHATSAPP_EMOJI_CATEGORIES = [
  {
    id: 'popular',
    name: 'Frequently Used',
    icon: '🔥',
    emojis: ['👍', '❤️', '😂', '🔥', '👏', '🎉', '🚀', '👀', '💯', '✨', '🙌', '💡', '🤝', '⚡️', '🎯', '💬', '🥹', '🫡', '😍', '🤩', '😎', '🙏', '💪', '🥳']
  },
  {
    id: 'smileys',
    name: 'Smileys & Emotions',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹', 
      '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', 
      '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', 
      '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', 
      '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', 
      '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', 
      '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫', 
      '🫠', '🤥', '😶', '😐', '😑', '😬', '🫨', '😯', '😦', '😧', 
      '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: '👍',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', 
      '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', 
      '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🫱', '🫲', '🫳', '🫴', 
      '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', 
      '👆', '🖕', '👇', '☝️', '🫵', '👋', '🤚', '🖐️', '✋', '🖖'
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', 
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', 
      '💟', '☮️', '✝️', '☪️', '🕉️', '⚡️', '🔥', '💥', '✨', '🌟', 
      '💫', '⭐️', '🎯', '💯', '💢', '✅', '❌', '⚠️', '⛔️', '🚫'
    ]
  },
  {
    id: 'objects',
    name: 'Objects & Food',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎂', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽️', 
      '🏀', '🏈', '⚾️', '🎾', '🎱', '🏓', '🏸', '📱', '💻', '📷', 
      '📁', '🔒', '🔑', '⏱️', '☕️', '🍕', '🍔', '🍟', '🍿', '🍩', 
      '🍦', '🍻', '🥂', '🍾', '🎧', '🎸', '🎨', '🚀', '✈️', '🏝️'
    ]
  }
];

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case 'mp4':
    case 'mov':
    case 'webm':
      return <Film className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <Music className="w-3.5 h-3.5 text-pink-500 shrink-0" />;
    case 'zip':
    case 'tar':
    case 'gz':
    case '7z':
    case 'rar':
      return <Archive className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'json':
    case 'py':
    case 'html':
    case 'css':
      return <FileCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-[var(--faint)] shrink-0" />;
  }
}

function formatTime(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function RoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const normalizedId = (params.id || '').toLowerCase().trim();
  
  const [adminToken, setAdminToken] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem(`dropxyz_admin_${normalizedId}`) ||
           localStorage.getItem(`droproom_admin_${normalizedId}`) ||
           localStorage.getItem(`dropxyz_admin_${params.id}`) ||
           localStorage.getItem(`droproom_admin_${params.id}`) ||
           undefined;
  });

  const [displayName, setDisplayName] = useState('');
  const [hasRequested, setHasRequested] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<ChatReference | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('popular');
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const chatInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const [windowDragOver, setWindowDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const dragCounter = useRef(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevJoinReqCount = useRef(0);
  
  useEffect(() => {
    const storedToken = localStorage.getItem(`dropxyz_admin_${normalizedId}`) || 
                        localStorage.getItem(`droproom_admin_${normalizedId}`) ||
                        localStorage.getItem(`dropxyz_admin_${params.id}`) || 
                        localStorage.getItem(`droproom_admin_${params.id}`);
    if (storedToken && storedToken !== adminToken) setAdminToken(storedToken);
  }, [normalizedId, params.id, adminToken]);

  const {
    status, rejectReason, room, participants, messages, files, joinRequests,
    isAdmin, sessionId, sendEvent, sendChatMessage, deleteMessage, toggleReaction, approveJoin, rejectJoin, endRoom
  } = useRoom(normalizedId, adminToken);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showEmojiPicker && !activeReactionPickerId && !activeMenuMessageId) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (activeMenuMessageId && !target?.closest?.('.group')) {
        setActiveMenuMessageId(null);
      }
      if (activeReactionPickerId && !target?.closest?.('.reaction-picker-container') && !target?.closest?.('.reaction-trigger')) {
        setActiveReactionPickerId(null);
      }
      if (showEmojiPicker) {
        const nodeTarget = e.target as Node;
        if (
          emojiPickerRef.current && !emojiPickerRef.current.contains(nodeTarget) &&
          emojiButtonRef.current && !emojiButtonRef.current.contains(nodeTarget)
        ) {
          setShowEmojiPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [activeReactionPickerId, showEmojiPicker, activeMenuMessageId]);

  const handleInsertEmoji = (emoji: string) => {
    if (chatInputRef.current) {
      const input = chatInputRef.current;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const current = input.value;
      const nextValue = current.slice(0, start) + emoji + current.slice(end);
      setMessageInput(nextValue);
      setShowEmojiPicker(false);
      setTimeout(() => {
        input.focus();
        const nextPos = start + emoji.length;
        input.setSelectionRange(nextPos, nextPos);
      }, 0);
    } else {
      setMessageInput(prev => prev + emoji);
      setShowEmojiPicker(false);
    }
  };

  const handleReplyMessage = (msg: any) => {
    setReplyingTo({
      type: 'message',
      id: msg.id,
      name: msg.senderName,
      preview: msg.message.slice(0, 80)
    });
    chatInputRef.current?.focus();
  };

  const handleTagFile = (file: any) => {
    setReplyingTo({
      type: 'file',
      id: file.id,
      name: file.originalName,
      preview: formatBytes(file.size)
    });
    chatInputRef.current?.focus();
  };

  const handleCopyMessageText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => {
        setCopiedMessageId(null);
        setActiveMenuMessageId(null);
      }, 700);
    } catch (e) {
      console.error('Failed to copy text', e);
      setActiveMenuMessageId(null);
    }
  };

  const handleDeleteMessageWithAnim = (id: string) => {
    setActiveMenuMessageId(null);
    setDeletingMessageId(id);
    setTimeout(() => {
      deleteMessage(id);
      setDeletingMessageId(null);
    }, 280);
  };

  const handleScrollToItem = (id: string) => {
    const el = document.getElementById(`item-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedItemId(id);
      setTimeout(() => {
        setHighlightedItemId(null);
      }, 1600);
    }
  };

  useEffect(() => {
    if (isAdmin && joinRequests.length > prevJoinReqCount.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (e) {}
    }
    prevJoinReqCount.current = joinRequests.length;
  }, [joinRequests.length, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowParticipants(false);
        setShowEndModal(false);
        setShowQRModal(false);
        setWindowDragOver(false);
        dragCounter.current = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global window drag and drop listener (scoped to connected room)
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter.current++;
      if (status === 'connected') {
        setWindowDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setWindowDragOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = status === 'connected' ? 'copy' : 'none';
      }
    };

    const handleDragEnd = () => {
      dragCounter.current = 0;
      setWindowDragOver(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setWindowDragOver(false);

      if (status !== 'connected' || !e.dataTransfer) return;
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
        setDroppedFiles(extractedFiles);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDrop);
    };
  }, [status]);

  const handleRequestJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    sendEvent({ type: 'JOIN_REQUEST', payload: { displayName: displayName.trim() } });
    setHasRequested(true);
  };

  const handleDownload = async (fileId: string, originalName: string) => {
    setDownloadingId(fileId);
    try {
      const res = await fetch(`${API_URL}/api/rooms/${normalizedId}/download-url/${encodeURIComponent(fileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionId || (adminToken ? 'admin' : undefined), 
          adminToken 
        })
      });
      if (!res.ok) throw new Error('Download failed');
      const { downloadUrl } = await res.json();
      
      const safeDownloadName = originalName.split(/[/\\]/).pop() || originalName;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = safeDownloadName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      alert(e.message || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const copyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Status screens ---

  if (status === 'connecting') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--fg)]">
        <div className="flex flex-col items-center gap-2.5 animate-settle">
          <div className="w-4 h-4 border-2 border-[var(--fg)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--faint)]">Connecting…</span>
        </div>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--fg)]">
        <div className="flex flex-col items-center gap-2 text-center animate-settle">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-live" />
          <p className="text-xs text-[var(--muted)]">Reconnecting…</p>
        </div>
      </div>
    );
  }
  
  if (status === 'ended') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center animate-settle bg-[var(--bg)] text-[var(--fg)]">
        <div className="w-full max-w-[380px] p-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/30 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center mx-auto text-[var(--faint)]">
            <DropLogo size={20} className="opacity-50" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-serif italic text-3xl font-normal tracking-tight">Room closed</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              All files and messages in this room have been permanently destroyed.
            </p>
          </div>
          <button 
            onClick={() => router.push('/')} 
            className="w-full h-11 bg-[var(--fg)] text-[var(--bg)] rounded-xl text-xs sm:text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            Return to DropXYZ
          </button>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center animate-settle bg-[var(--bg)] text-[var(--fg)]">
        <div className="w-full max-w-[380px] p-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/30 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--danger-bg)] border border-[var(--danger-line)] flex items-center justify-center mx-auto text-[var(--danger)]">
            <X className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-serif italic text-3xl font-normal tracking-tight">Access ended</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              {rejectReason || 'Access was declined by the room host.'}
            </p>
          </div>
          <button 
            onClick={() => router.push('/')} 
            className="w-full h-11 bg-[var(--surface)] text-[var(--fg)] border border-[var(--line)] rounded-xl text-xs sm:text-sm font-medium hover:bg-[var(--hover)] transition-all cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    if (hasRequested) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center animate-settle bg-[var(--bg)] text-[var(--fg)]">
          <div className="w-full max-w-[380px] p-8 sm:p-10 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/30 text-center space-y-4 shadow-sm">
            <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-40"></span>
              <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center relative z-10 text-[var(--accent)]">
                <Users className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-[var(--faint)] uppercase tracking-widest font-mono">
                Admission Request Sent
              </span>
              <h2 className="font-serif italic text-3xl font-normal tracking-tight">Waiting for Host</h2>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                The host has been notified. You will automatically enter when admitted.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 py-10 animate-settle bg-[var(--bg)] text-[var(--fg)]">
        <div className="w-full max-w-[380px] p-8 sm:p-9 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/20 text-center space-y-6 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DropBrand showLogo logoSize={20} className="text-sm text-[var(--muted)]" />
            </div>
            <h2 className="font-serif italic font-normal text-3xl sm:text-4xl tracking-tight">Join Room</h2>
            <p className="text-xs sm:text-sm text-[var(--muted)]">Enter your name to request admission</p>
          </div>
          
          <form onSubmit={handleRequestJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Your name or alias"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full h-12 px-4 bg-[var(--surface)]/70 hover:bg-[var(--surface)] focus:bg-[var(--bg)] rounded-xl text-sm placeholder:text-[var(--faint)] outline-none border border-[var(--line)] focus:border-[var(--fg)] transition-all text-center"
              autoFocus
              maxLength={32}
              required
            />
            <button 
              type="submit" 
              disabled={!displayName.trim()} 
              className="w-full h-12 bg-[var(--fg)] text-[var(--bg)] rounded-xl font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-30 cursor-pointer shadow-xs"
            >
              Request to join ↗
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Room View ---

  const onlineCount = participants.filter(p => p.status === 'online').length;

  return (
    <div className="h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <div className="flex-1 flex flex-col max-w-[760px] mx-auto w-full relative h-full">
        
        {/* Top Header */}
        <header className="h-15 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
            <DropBrand 
              showLogo 
              logoSize={20} 
              className="text-base" 
              hideTextOnMobile
              onClick={() => router.push('/')} 
            />
            <span className="hidden sm:inline text-xs text-[var(--line)] select-none">/</span>
            <button
              onClick={() => setShowQRModal(true)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--hover)] border border-transparent hover:border-[var(--line)] transition-all cursor-pointer group shrink-0"
              title="Show QR code & room invite"
            >
              <span className="text-xs font-mono text-[var(--fg)] font-medium tracking-wide">
                {normalizedId}
              </span>
              <QrCode className="w-3.5 h-3.5 text-[var(--faint)] group-hover:text-[var(--fg)] transition-colors" />
            </button>
            {isAdmin && (
              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-[var(--surface)] text-[var(--faint)] rounded-md border border-[var(--line)] shrink-0">
                Host
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle />

            {/* Quick copy invite button */}
            <button
              onClick={copyLink}
              className="h-8.5 px-2 sm:px-3 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] rounded-xl border border-transparent hover:border-[var(--line)] transition-all cursor-pointer"
              title="Copy room link"
            >
              {copied ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-[var(--success)] animate-pop-in" />
                  <span className="text-xs text-[var(--success)] font-medium hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-xs hidden sm:inline">Invite</span>
                </>
              )}
            </button>

            {/* People drawer trigger */}
            <button 
              onClick={() => setShowParticipants(!showParticipants)}
              className="h-8.5 px-2 sm:px-3 flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] rounded-xl border border-transparent hover:border-[var(--line)] transition-all relative cursor-pointer"
              title="Participants"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-mono tabular-nums">{onlineCount}</span>
              {(joinRequests.length > 0 && isAdmin) && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                </span>
              )}
            </button>

            <div className="h-4 w-[1px] bg-[var(--line)] mx-0.5 hidden xs:block" />

            {/* Exit Room button */}
            {isAdmin ? (
              <button 
                onClick={() => setShowEndModal(true)}
                className="h-8.5 px-2 sm:px-3 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-xl border border-transparent hover:border-[var(--danger-line)] transition-all cursor-pointer"
                title="End room for all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">End</span>
              </button>
            ) : (
              <button 
                onClick={() => {
                  router.push('/');
                }}
                className="h-8.5 px-2 sm:px-3 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] rounded-xl border border-transparent hover:border-[var(--danger-line)] transition-all cursor-pointer"
                title="Leave room"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Exit</span>
              </button>
            )}
          </div>
        </header>

        {/* Realtime Host Join Request Modal Popup */}
        {isAdmin && joinRequests.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-settle">
            <div className="w-full max-w-[380px] rounded-2xl bg-[var(--bg)] border border-[var(--line)] p-6 sm:p-7 shadow-2xl animate-pop-in text-center space-y-5">
              <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center mx-auto text-[var(--fg)] relative">
                <Users className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]"></span>
                </span>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--faint)] font-mono">
                  Join request {joinRequests.length > 1 && `(1 of ${joinRequests.length})`}
                </span>
                <h3 className="font-serif italic text-3xl font-normal text-[var(--fg)] tracking-tight">
                  {joinRequests[0].displayName}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  Wants to join this room. Allow them to access shared files and chat?
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => rejectJoin(joinRequests[0].id)}
                  className="flex-1 h-10 rounded-xl border border-[var(--line)] text-xs sm:text-sm font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] active:scale-98 transition-all cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={() => approveJoin(joinRequests[0].id)}
                  className="flex-1 h-10 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs sm:text-sm font-medium hover:opacity-90 active:scale-98 transition-all shadow-xs cursor-pointer"
                >
                  Admit ↗
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Activity Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
          
          {/* File Upload Dropzone */}
          <FileUpload 
            roomId={normalizedId} 
            sessionId={sessionId!} 
            onUploadComplete={() => {}} 
            externalFiles={droppedFiles}
            onClearExternalFiles={() => setDroppedFiles(null)}
            existingTotalBytes={files.reduce((acc, f) => acc + f.size, 0)}
          />

          {/* Files section */}
          {files.length > 0 && (
            <div className="space-y-2.5 animate-settle">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--faint)] font-mono">
                  Shared Files ({files.length})
                </span>
                <span className="text-[11px] text-[var(--faint)] font-mono">
                  {formatBytes(files.reduce((acc, f) => acc + f.size, 0))} / 2.5 GB
                </span>
              </div>
              
              <div className="space-y-2">
                {files.map(file => (
                  <div 
                    id={`item-${file.id}`}
                    key={file.id} 
                    className="group flex flex-col p-3 sm:p-3.5 rounded-2xl border border-[var(--line)]/80 bg-[var(--surface)]/30 hover:bg-[var(--surface)] hover:border-[var(--line)] transition-all gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center shrink-0 shadow-2xs">
                          {getFileIcon(file.originalName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-medium text-[var(--fg)] truncate block" title={file.originalName}>
                            {file.originalName}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--faint)] font-mono mt-0.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>·</span>
                            <span className="truncate">{file.uploaderName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Tag/Quote in chat */}
                        <button
                          type="button"
                          onClick={() => handleTagFile(file)}
                          className="h-8.5 px-2.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--hover)] border border-[var(--line)] text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Reference / Tag in chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px]">Tag</span>
                        </button>

                        {/* Quick Reaction Button */}
                        <div className="relative reaction-picker-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReactionPickerId(activeReactionPickerId === file.id ? null : file.id);
                            }}
                            className="h-8.5 w-8.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--hover)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)] transition-all shadow-2xs flex items-center justify-center cursor-pointer"
                            title="React with emoji"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          {activeReactionPickerId === file.id && (
                            <div className="absolute right-0 bottom-10 z-30 flex items-center gap-1 bg-[var(--bg)] border border-[var(--line)] shadow-xl rounded-full p-1 animate-pop-in">
                              {QUICK_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    toggleReaction(file.id, 'file', emoji);
                                    setActiveReactionPickerId(null);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--hover)] hover:scale-120 transition-transform cursor-pointer text-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Download button */}
                        <button 
                          onClick={() => handleDownload(file.id, file.originalName)}
                          disabled={downloadingId === file.id}
                          className="h-8.5 px-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] border border-[var(--line)] text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Download file"
                        >
                          {downloadingId === file.id ? (
                            <span className="text-xs animate-pulse">Downloading…</span>
                          ) : (
                            <span>Download ↓</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* File Reaction Badges */}
                    {file.reactions && file.reactions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pl-12">
                        {file.reactions.map(r => {
                          const hasReacted = Boolean((sessionId && r.userIds.includes(sessionId)) || (isAdmin && r.userIds.includes('host')));
                          return (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => toggleReaction(file.id, 'file', r.emoji)}
                              className={`
                                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border transition-all cursor-pointer
                                ${hasReacted 
                                  ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--fg)] font-semibold shadow-2xs scale-[1.02]' 
                                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--faint)] hover:text-[var(--fg)]'
                                }
                              `}
                              title={`${r.count} reaction${r.count > 1 ? 's' : ''}${hasReacted ? ' (click to remove)' : ' (click to add)'}`}
                            >
                              <span>{r.emoji}</span>
                              <span className="text-[10px] tabular-nums">{r.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages section */}
          {messages.length > 0 && (
            <div className="space-y-3 pt-2 animate-settle">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--faint)] font-mono">
                  Room Chat
                </span>
              </div>
              <div className="space-y-3.5">
                {messages.map(msg => {
                  const isMe = msg.senderId === sessionId || (isAdmin && (msg.senderId === 'host' || msg.senderId === 'admin'));
                  const canDelete = isMe && (currentTime - msg.timestamp <= 120_000);
                  const isHighlighted = highlightedItemId === msg.id;
                  const isDeleting = deletingMessageId === msg.id;
                  const hasReactions = Boolean(msg.reactions && msg.reactions.length > 0);

                  return (
                    <div 
                      id={`item-${msg.id}`}
                      key={msg.id} 
                      className={`group relative flex flex-col transition-all ${
                        isMe ? 'items-end' : 'items-start'
                      } ${hasReactions ? 'mb-5' : 'mb-2.5'} ${isHighlighted ? 'animate-flash-highlight rounded-2xl' : ''} ${
                        isDeleting ? 'animate-message-exit' : 'animate-message-enter'
                      }`}
                    >
                      {/* Message Bubble Wrapper */}
                      <div className="relative max-w-[85%] sm:max-w-[70%] select-text">
                        <div 
                          onClick={(e) => {
                            if (window.matchMedia('(hover: none)').matches) {
                              e.stopPropagation();
                              setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id);
                            }
                          }}
                          className={`
                            relative px-3 py-1.5 sm:px-3.5 sm:py-2 text-[13.5px] leading-relaxed shadow-xs transition-colors
                            ${isMe 
                              ? 'bg-[var(--fg)] text-[var(--bg)] rounded-2xl rounded-tr-xs border border-[var(--fg)] dark:border-[#383a34]' 
                              : 'bg-[var(--surface)] text-[var(--fg)] rounded-2xl rounded-tl-xs border border-[var(--line)] shadow-2xs'
                            }
                          `}
                        >
                          {/* Sender Name for incoming group messages */}
                          {!isMe && (
                            <div className="text-[11px] font-semibold text-[var(--accent)] mb-1 leading-none select-none">
                              {msg.senderName}
                            </div>
                          )}

                          {/* Quoted Reply Header */}
                          {msg.replyTo && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScrollToItem(msg.replyTo!.id);
                              }}
                              className={`mb-1.5 p-2 rounded-lg text-[11px] leading-snug cursor-pointer border-l-[3.5px] hover:opacity-85 transition-opacity select-none text-left ${
                                isMe 
                                  ? 'bg-[var(--bg)]/15 border-[var(--bg)] text-[var(--bg)]' 
                                  : 'bg-[var(--bg)] border-[var(--accent)] text-[var(--fg)]'
                              }`}
                              title="Click to jump to quoted item"
                            >
                              <div className={`flex items-center gap-1 font-semibold text-[11px] ${isMe ? 'text-[var(--bg)]' : 'text-[var(--accent)]'}`}>
                                {msg.replyTo.type === 'file' ? (
                                  <>
                                    <FileText className="w-3 h-3 shrink-0" />
                                    <span>{msg.replyTo.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <Reply className="w-3 h-3 shrink-0" />
                                    <span>{msg.replyTo.name}</span>
                                  </>
                                )}
                              </div>
                              <p className={`text-[10px] truncate mt-0.5 font-normal ${isMe ? 'text-[var(--bg)]/80' : 'text-[var(--muted)]'}`}>
                                {msg.replyTo.preview}
                              </p>
                            </div>
                          )}

                          {/* Message Content & Timestamp (Snug, Flex-Flowing, Zero Dead Space) */}
                          <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                            <span className="break-words whitespace-pre-wrap flex-1 min-w-0">
                              {msg.message}
                            </span>
                            
                            {/* Bottom-right metadata (Time + Double Blue Checkmark) */}
                            <span className={`inline-flex items-center gap-1 text-[10px] select-none pointer-events-none tabular-nums font-mono leading-none shrink-0 self-end ml-auto pb-0.5 ${
                              isMe ? 'text-[var(--bg)]/70' : 'text-[var(--muted)]'
                            }`}>
                              {formatTime(msg.timestamp)}
                              {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#38bdf8] dark:text-[#0284c7] shrink-0" />}
                            </span>
                          </div>

                          {/* Hover Chevron Arrow (desktop hover or active menu) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMessageId(activeMenuMessageId === msg.id ? null : msg.id);
                            }}
                            className={`
                              absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full 
                              transition-all cursor-pointer z-10
                              ${isMe 
                                ? 'bg-[var(--bg)]/20 hover:bg-[var(--bg)]/35 text-[var(--bg)]' 
                                : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-[var(--fg)]'
                              }
                              ${activeMenuMessageId === msg.id ? 'opacity-100 scale-105' : 'opacity-0 group-hover:opacity-100 max-sm:hidden'}
                            `}
                            title="Message options"
                            aria-label="Message options"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Message Context Menu Dropdown */}
                          {activeMenuMessageId === msg.id && (
                            <div 
                              className={`
                                absolute top-7 z-50 w-52 min-w-[210px] p-1.5 bg-[var(--surface)] border border-[var(--line)] 
                                rounded-xl shadow-2xl animate-pop-in space-y-0.5 text-xs text-[var(--fg)] select-none
                                ${isMe ? 'right-0' : 'left-0'}
                              `}
                              onClick={e => e.stopPropagation()}
                            >
                              {/* Reply option */}
                              <button
                                type="button"
                                onClick={() => {
                                  handleReplyMessage(msg);
                                  setActiveMenuMessageId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--hover)] text-left cursor-pointer transition-colors"
                              >
                                <Reply className="w-4 h-4 text-[var(--accent)] shrink-0" />
                                <span className="whitespace-nowrap font-medium">Reply</span>
                              </button>

                              {/* React option */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveReactionPickerId(activeReactionPickerId === msg.id ? null : msg.id);
                                  setActiveMenuMessageId(null);
                                }}
                                className="reaction-trigger w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--hover)] text-left cursor-pointer transition-colors"
                              >
                                <Smile className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="whitespace-nowrap font-medium">React with emoji</span>
                              </button>

                              {/* Copy option */}
                              <button
                                type="button"
                                onClick={() => handleCopyMessageText(msg.id, msg.message)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--hover)] text-left cursor-pointer transition-colors"
                              >
                                {copiedMessageId === msg.id ? (
                                  <>
                                    <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
                                    <span className="whitespace-nowrap font-medium text-[var(--success)]">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-[var(--muted)] shrink-0" />
                                    <span className="whitespace-nowrap font-medium">Copy text</span>
                                  </>
                                )}
                              </button>

                              {/* Delete option if author and within 2 mins */}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessageWithAnim(msg.id)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger-bg)] text-left cursor-pointer transition-colors border-t border-[var(--line)]/60 pt-2 mt-1"
                                >
                                  <Trash2 className="w-4 h-4 text-[var(--danger)] shrink-0" />
                                  <span className="whitespace-nowrap font-medium">Delete for everyone</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Floating Reaction Quick Bar */}
                        {activeReactionPickerId === msg.id && (
                          <div 
                            className={`
                              reaction-picker-container absolute -top-11 z-50 flex items-center gap-1 bg-[var(--bg)] border border-[var(--line)] shadow-2xl rounded-full p-1.5 animate-pop-in
                              ${isMe ? 'right-0' : 'left-0'}
                            `}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onTouchStart={e => e.stopPropagation()}
                          >
                            {QUICK_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleReaction(msg.id, 'message', emoji);
                                  setActiveReactionPickerId(null);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--hover)] hover:scale-125 transition-transform cursor-pointer text-sm"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* WhatsApp Reaction Badges floating on bubble edge */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className={`
                            absolute -bottom-3 z-30 flex flex-wrap items-center gap-1 animate-badge-pop
                            ${isMe ? 'right-2' : 'left-2'}
                          `}>
                            {msg.reactions.map(r => {
                              const hasReacted = Boolean((sessionId && r.userIds.includes(sessionId)) || (isAdmin && r.userIds.includes('host')));
                              return (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReaction(msg.id, 'message', r.emoji);
                                  }}
                                  className={`
                                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-mono border transition-transform duration-150 active:scale-90 hover:scale-110 cursor-pointer shadow-xs select-none
                                    ${hasReacted 
                                      ? 'bg-[var(--surface)] border-[var(--accent)] text-[var(--fg)] font-semibold scale-105' 
                                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--faint)] hover:text-[var(--fg)]'
                                    }
                                  `}
                                  title={`${r.count} reaction${r.count > 1 ? 's' : ''}${hasReacted ? ' (click to remove)' : ' (click to add)'}`}
                                >
                                  <span>{r.emoji}</span>
                                  {r.count > 1 && <span className="text-[10px] tabular-nums font-semibold">{r.count}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Minimal empty state */}
          {files.length === 0 && messages.length === 0 && (
            <div className="py-14 sm:py-18 flex flex-col items-center justify-center text-center animate-settle border border-dashed border-[var(--line)]/70 rounded-2xl p-8 bg-[var(--surface)]/10">
              <div className="w-10 h-10 rounded-2xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center mb-3 text-[var(--faint)]">
                <DropLogo size={18} className="opacity-40" />
              </div>
              <p className="font-serif italic text-base text-[var(--fg)]">Room is currently empty</p>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-xs leading-relaxed">
                Drop a file above or write a message below to start collaborating.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Composer */}
        <div className="p-4 sm:p-5 border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur-md shrink-0 z-10">
          {/* Active Reply Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-l-4 border-[var(--accent)] border-y border-r border-[var(--line)] rounded-r-xl mb-2.5 text-xs animate-pop-in shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                {replyingTo.type === 'file' ? (
                  <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                ) : (
                  <Reply className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                )}
                <div className="truncate text-xs">
                  <span className="font-semibold text-[var(--accent)]">
                    {replyingTo.type === 'file' ? 'Referencing file: ' : 'Replying to '}
                    {replyingTo.name}
                  </span>
                  <span className="text-[var(--muted)] ml-1.5 font-normal">
                    · {replyingTo.preview}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--faint)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors cursor-pointer shrink-0 ml-2"
                title="Cancel reply"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const text = messageInput.trim();
              if (!text) return;
              sendChatMessage(text, replyingTo || undefined);
              setMessageInput('');
              setReplyingTo(null);
              setShowEmojiPicker(false);
            }}
            className="flex items-center gap-2"
          >
            {/* Quick Emoji Picker Button */}
            <div className="relative emoji-picker-container">
              <button
                ref={emojiButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(prev => !prev);
                }}
                className={`h-11 w-11 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] border border-[var(--line)] transition-all cursor-pointer ${showEmojiPicker ? 'text-[var(--fg)] bg-[var(--surface)] border-[var(--fg)] shadow-xs' : ''}`}
                title="Add emoji quickly"
                aria-label="Add emoji quickly"
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  className="absolute bottom-full mb-2 left-0 z-50 bg-[var(--bg)] border border-[var(--line)] rounded-2xl shadow-2xl w-80 max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden"
                >
                  {/* Top Header & Close */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]/60 text-xs font-medium text-[var(--fg)]">
                    <div className="flex items-center gap-1.5">
                      <Smile className="w-4 h-4 text-[var(--accent)]" />
                      <span>Emojis</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="w-5 h-5 flex items-center justify-center rounded-md hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors cursor-pointer text-[var(--faint)]"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* WhatsApp Category Tabs */}
                  <div className="flex items-center justify-around px-2 py-1.5 border-b border-[var(--line)]/50 bg-[var(--surface)]/40 text-base">
                    {WHATSAPP_EMOJI_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveEmojiCategory(cat.id)}
                        className={`h-7 w-8 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                          activeEmojiCategory === cat.id 
                            ? 'bg-[var(--bg)] border border-[var(--line)] shadow-2xs scale-110' 
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        title={cat.name}
                      >
                        {cat.icon}
                      </button>
                    ))}
                  </div>

                  {/* Emojis Grid */}
                  <div className="p-3 max-h-56 overflow-y-auto">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--faint)] mb-2 px-1">
                      {WHATSAPP_EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.name}
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {WHATSAPP_EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory)?.emojis.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-[var(--hover)] hover:scale-120 active:scale-95 transition-transform cursor-pointer"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <input 
              ref={chatInputRef}
              name="message"
              type="text"
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              placeholder={replyingTo ? `Write a reply to ${replyingTo.name}…` : "Write a message to room…"}
              className="flex-1 h-11 px-4 bg-[var(--surface)]/70 hover:bg-[var(--surface)] focus:bg-[var(--bg)] rounded-xl text-xs sm:text-sm placeholder:text-[var(--faint)] outline-none border border-[var(--line)] focus:border-[var(--fg)] transition-all"
            />
            <button 
              type="submit" 
              disabled={!messageInput.trim()}
              className="h-11 px-4 sm:px-5 flex items-center justify-center gap-1.5 bg-[var(--fg)] text-[var(--bg)] rounded-xl text-xs sm:text-sm font-medium disabled:opacity-20 hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-xs"
              title="Send message"
            >
              <span>Send</span>
              <span className="text-xs opacity-70">↵</span>
            </button>
          </form>
        </div>

        {/* Participants Drawer */}
        {showParticipants && (
          <>
            <div 
              className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-xs z-30 transition-opacity animate-settle"
              onClick={() => setShowParticipants(false)} 
            />
            <div className="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-[var(--bg)] border-l border-[var(--line)] z-40 flex flex-col shadow-2xl animate-slide-in-right">
              <div className="h-15 sm:h-16 px-5 flex items-center justify-between border-b border-[var(--line)] shrink-0">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[var(--faint)]" />
                  <h3 className="font-serif italic text-base">People ({onlineCount})</h3>
                </div>
                <button 
                  onClick={() => setShowParticipants(false)} 
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--faint)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Join Requests */}
                {isAdmin && joinRequests.length > 0 && (
                  <div className="space-y-2 animate-settle">
                    <span className="text-[10px] font-semibold text-[var(--faint)] uppercase tracking-widest font-mono px-1">
                      Pending Requests ({joinRequests.length})
                    </span>
                    <div className="space-y-1.5">
                      {joinRequests.map(req => (
                        <div 
                          key={req.id} 
                          className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)]"
                        >
                          <span className="text-xs font-medium truncate flex-1 pl-1">{req.displayName}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              onClick={() => approveJoin(req.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-95 transition-all text-xs cursor-pointer shadow-2xs"
                              title="Admit to room"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => rejectJoin(req.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--faint)] hover:text-[var(--danger)] hover:bg-[var(--hover)] active:scale-95 transition-all cursor-pointer"
                              title="Decline request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* People List */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-[var(--faint)] uppercase tracking-widest font-mono px-1">
                    In Room ({onlineCount})
                  </span>
                  <div className="space-y-1">
                    {participants.map(p => {
                      const isMe = isAdmin ? p.id === 'host' : p.id === sessionId;
                      const isHostParticipant = p.id === 'host';
                      return (
                        <div 
                          key={p.id} 
                          className={`flex items-center gap-2.5 p-2 rounded-xl transition-all group ${isMe && isHostParticipant ? 'bg-[var(--surface)]/60' : 'hover:bg-[var(--hover)]'}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'online' ? 'bg-emerald-500 animate-pulse-live' : 'bg-[var(--line)]'}`} />
                          <span className="text-xs sm:text-[13px] truncate flex-1">
                            {isMe ? 'You' : p.displayName}
                            {isHostParticipant && <span className="text-[10px] text-[var(--faint)] font-mono ml-1">· Host</span>}
                            {isMe && !isHostParticipant && <span className="text-[10px] text-[var(--faint)] font-mono ml-1">· You</span>}
                            {p.status !== 'online' && <span className="text-[10px] text-[var(--faint)] font-mono ml-1">· Away</span>}
                          </span>
                          {isAdmin && !isHostParticipant && (
                            <button 
                              onClick={() => sendEvent({ type: 'REMOVE_PARTICIPANT', payload: { participantId: p.id } })}
                              className="text-[10px] text-[var(--faint)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all px-1.5 py-0.5 rounded hover:bg-[var(--danger-bg)] cursor-pointer"
                              title="Remove from room"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="p-4 border-t border-[var(--line)] bg-[var(--surface)]/30 shrink-0">
                <button
                  onClick={copyLink}
                  className="w-full h-9 flex items-center justify-center gap-2 text-xs font-medium rounded-xl bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--fg)] active:scale-98 transition-all cursor-pointer shadow-2xs"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-[var(--success)]" />
                      <span>Link copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[var(--faint)]" />
                      <span>Copy room link ↗</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* End Room Confirmation Modal */}
        {showEndModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-settle">
            <div className="w-full max-w-[380px] rounded-2xl bg-[var(--bg)] border border-[var(--line)] p-6 sm:p-7 shadow-2xl animate-pop-in text-center space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-[var(--danger-bg)] border border-[var(--danger-line)] flex items-center justify-center mx-auto text-[var(--danger)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-serif italic text-2xl font-normal">End room?</h3>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  All participants will be disconnected immediately and all files will be permanently deleted.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 h-10 rounded-xl border border-[var(--line)] text-xs sm:text-sm font-medium hover:bg-[var(--hover)] active:scale-98 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowEndModal(false);
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem(`dropxyz_admin_${normalizedId}`);
                      localStorage.removeItem(`droproom_admin_${normalizedId}`);
                      localStorage.removeItem(`dropxyz_admin_${params.id}`);
                      localStorage.removeItem(`droproom_admin_${params.id}`);
                    }
                    await endRoom();
                  }}
                  className="flex-1 h-10 rounded-xl bg-[var(--danger)] hover:opacity-90 text-white text-xs sm:text-sm font-medium active:scale-98 transition-all cursor-pointer shadow-xs"
                >
                  End room
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Full-screen Window Drag & Drop Overlay */}
        {windowDragOver && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[var(--bg)]/90 backdrop-blur-md border-4 border-dashed border-[var(--fg)] animate-settle pointer-events-none">
            <div className="w-16 h-16 rounded-3xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center mb-4 shadow-xl">
              <Upload className="w-8 h-8 text-[var(--fg)] animate-bounce" />
            </div>
            <h2 className="font-serif italic text-3xl font-normal tracking-tight text-[var(--fg)] mb-2">
              Drop files or folders to share
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Files will be immediately queued for upload to this room.
            </p>
          </div>
        )}

        {/* QR Code Modal Popup */}
        <QRCodeModal
          roomId={normalizedId}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
        />

      </div>
    </div>
  );
}

