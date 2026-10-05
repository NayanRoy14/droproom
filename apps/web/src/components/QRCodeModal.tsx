"use client";

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, CheckCheck, QrCode } from 'lucide-react';

interface QRCodeModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ roomId, isOpen, onClose }: QRCodeModalProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const cleanId = roomId.toLowerCase().trim();
  const roomUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/r/${cleanId}` 
    : `https://dropxyz.vercel.app/r/${cleanId}`;

  useEffect(() => {
    if (!isOpen) return;

    QRCode.toString(roomUrl, {
      type: 'svg',
      margin: 1.5,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111210',
        light: '#ffffff'
      }
    }, (err, svg) => {
      if (!err && svg) {
        setSvgContent(svg);
      }
    });
  }, [isOpen, roomUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(cleanId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-settle"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[360px] rounded-2xl bg-[var(--bg)] border border-[var(--line)] p-6 shadow-2xl animate-pop-in text-center space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--faint)] font-mono">
            <QrCode className="w-4 h-4 text-[var(--muted)]" />
            <span>Room Invite</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--faint)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl border border-[var(--line)] shadow-xs mx-auto max-w-[240px] aspect-square flex items-center justify-center">
          {svgContent ? (
            <div 
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full" 
              dangerouslySetInnerHTML={{ __html: svgContent }} 
            />
          ) : (
            <div className="w-8 h-8 border-2 border-[var(--fg)] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Room Code Badge */}
        <div className="space-y-1">
          <p className="text-[11px] text-[var(--faint)] font-mono uppercase tracking-widest">
            Room Code
          </p>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--hover)] border border-[var(--line)] transition-all cursor-pointer group"
            title="Click to copy room code"
          >
            <span className="font-mono text-lg font-bold tracking-widest text-[var(--fg)] uppercase">
              {cleanId}
            </span>
            {copiedCode ? (
              <CheckCheck className="w-4 h-4 text-[var(--success)] animate-pop-in" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[var(--faint)] group-hover:text-[var(--fg)] transition-colors" />
            )}
          </button>
        </div>

        {/* Action Button & Instructions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={copyUrl}
            className="w-full h-10 rounded-xl bg-[var(--fg)] text-[var(--bg)] text-xs sm:text-sm font-medium hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            {copiedLink ? (
              <>
                <CheckCheck className="w-4 h-4" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Scan with your phone’s camera to join instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
