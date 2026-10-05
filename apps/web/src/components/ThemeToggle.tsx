"use client";

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('droproom_theme', nextTheme);
  };

  useEffect(() => {
    const saved = localStorage.getItem('droproom_theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className="w-8.5 h-8.5 rounded-xl border border-transparent hover:border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-all cursor-pointer"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[var(--muted)]" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--muted)]" />
      )}
    </button>
  );
}
