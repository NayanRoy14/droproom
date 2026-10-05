"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link as LinkIcon, AlertCircle, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DropLogo } from '@/components/DropLogo';
import { API_URL } from '@/lib/config';

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [error, setError] = useState('');

  const createRoom = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not create room.');
      const { roomId, adminToken } = await res.json();
      
      localStorage.setItem(`dropxyz_admin_${roomId}`, adminToken);
      localStorage.setItem(`droproom_admin_${roomId}`, adminToken);
      router.push(`/r/${roomId}`);
    } catch (e: any) {
      setError(e.message || 'Could not create room.');
      setCreating(false);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    let finalId = joinId.trim();
    if (finalId.includes('/r/')) {
      finalId = finalId.split('/r/')[1].split('/')[0];
    }
    finalId = finalId.split('?')[0].replace(/\/+$/, '').toLowerCase();
    router.push(`/r/${finalId}`);
  };

  return (
    <main className="min-h-[100dvh] flex flex-col justify-between px-6 py-6 sm:py-10 bg-[var(--bg)] text-[var(--fg)]">
      
      {/* Top Header */}
      <header className="w-full max-w-[480px] sm:max-w-[520px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <DropLogo size={22} className="w-5.5 h-5.5 shrink-0" />
          <span className="font-serif italic text-base tracking-tight">DropXYZ</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Central Content */}
      <div className="w-full max-w-[440px] mx-auto py-12 sm:py-16 animate-settle">
        
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="font-serif italic font-normal text-4xl sm:text-5xl tracking-tight mb-3">
            DropXYZ
          </h1>
          <p className="text-[var(--muted)] text-sm sm:text-[15px] leading-relaxed max-w-xs mx-auto">
            Temporary spaces for ephemeral files and real-time chat.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between gap-2.5 text-xs text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-line)] rounded-xl p-3.5 animate-slide-down">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button onClick={() => setError('')} className="hover:opacity-75 shrink-0 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-4 sm:space-y-4.5">
          <button 
            onClick={createRoom} 
            disabled={creating}
            className="w-full h-12 bg-[var(--fg)] text-[var(--bg)] rounded-xl font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            {creating ? (
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-[var(--bg)] border-t-transparent rounded-full animate-spin" />
                <span>Creating room…</span>
              </div>
            ) : (
              <>
                <span>Create a room</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="flex items-center gap-4 py-1.5">
            <div className="dotted-rule" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--faint)] font-mono">
              or
            </span>
            <div className="dotted-rule" />
          </div>

          <form onSubmit={joinRoom} className="relative flex items-center">
            <LinkIcon className="absolute left-4 w-4 h-4 text-[var(--faint)] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Enter 4-character code or link" 
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              className="w-full h-12 pl-11 pr-24 bg-[var(--surface)]/70 hover:bg-[var(--surface)] focus:bg-[var(--bg)] rounded-xl text-sm placeholder:text-[var(--faint)] outline-none border border-[var(--line)] focus:border-[var(--fg)] transition-all"
            />
            <button 
              type="submit" 
              disabled={!joinId.trim()}
              className="absolute right-1.5 h-9 px-3.5 text-xs font-medium bg-[var(--bg)] border border-[var(--line)] text-[var(--fg)] rounded-lg hover:border-[var(--fg)] hover:bg-[var(--hover)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none shadow-2xs cursor-pointer"
            >
              Join ↗
            </button>
          </form>
        </div>

      </div>

      {/* Refined Minimal Footer */}
      <footer className="w-full max-w-[480px] sm:max-w-[520px] mx-auto text-center py-4">
        <p className="text-xs text-[var(--faint)]">
          Files and messages permanently erase when the room is closed.
        </p>
      </footer>

    </main>
  );
}
