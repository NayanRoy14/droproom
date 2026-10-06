"use client";

import { useEffect, useState } from 'react';
import { Radio, X, RefreshCw, ArrowUpRight, Wifi, Clock, Sparkles } from 'lucide-react';
import { API_URL } from '@/lib/config';

interface LocalRoom {
  roomId: string;
  createdAt: number;
  isLocal: boolean;
}

interface LocalRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: () => void;
}

function timeAgo(timestamp: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}

export function LocalRoomsModal({ isOpen, onClose, onJoinRoom, onCreateRoom }: LocalRoomsModalProps) {
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scanRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rooms/local`);
      if (!res.ok) throw new Error('Could not fetch local rooms');
      const data = await res.json();
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch (e: any) {
      setError(e.message || 'Failed to scan network');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scanRooms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-settle">
      <div 
        className="w-full max-w-[420px] rounded-2xl bg-[var(--bg)] border border-[var(--line)] shadow-2xl p-5 sm:p-6 animate-pop-in space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--accent)]">
              <Radio className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
              {loading && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]"></span>
                </span>
              )}
            </div>
            <div>
              <h3 className="font-serif italic text-lg leading-tight text-[var(--fg)]">Nearby Rooms</h3>
              <p className="text-[11px] text-[var(--muted)]">Active spaces on your network</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={scanRooms}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--line)] transition-all cursor-pointer disabled:opacity-40"
              title="Rescan network"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--line)] transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && rooms.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute w-12 h-12 rounded-full border border-[var(--accent)]/40 animate-radar-wave pointer-events-none" />
              <div className="absolute w-8 h-8 rounded-full border border-[var(--accent)]/60 animate-radar-wave pointer-events-none" style={{ animationDelay: '0.6s' }} />
              <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-xs">
                <Wifi className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] font-mono">Scanning local network for rooms…</p>
          </div>
        ) : error ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-[var(--danger)]">{error}</p>
            <button
              type="button"
              onClick={scanRooms}
              className="text-xs text-[var(--fg)] underline hover:opacity-80 cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 border border-dashed border-[var(--line)] rounded-xl p-4 bg-[var(--surface)]/20">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--faint)]">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-serif italic text-[var(--fg)]">No active rooms nearby</p>
              <p className="text-xs text-[var(--muted)] max-w-xs mt-0.5 leading-relaxed">
                Rooms created on this network will show up here so anyone can ask to join.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateRoom();
              }}
              className="h-9 px-4 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-98 transition-all shadow-xs cursor-pointer"
            >
              Create a room now ↗
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {rooms.map(room => (
              <div
                key={room.roomId}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]/60 hover:bg-[var(--surface)] border border-[var(--line)] transition-all group"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-live shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-sm tracking-wider text-[var(--fg)]">
                        {room.roomId}
                      </span>
                      {room.isLocal && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                          Local
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--faint)] mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(room.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onJoinRoom(room.roomId);
                  }}
                  className="h-8.5 px-3.5 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
                >
                  <span>Ask to join</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <p className="text-[11px] text-[var(--faint)] text-center pt-1 border-t border-[var(--line)]/50">
          Rooms update automatically. Anyone on this network can join.
        </p>
      </div>
    </div>
  );
}
