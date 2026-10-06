"use client";

import { useState, useEffect, useRef } from 'react';
import { DropLogo } from './DropLogo';

interface DropBrandProps {
  as?: 'h1' | 'span' | 'div';
  className?: string;
  showLogo?: boolean;
  logoSize?: number;
  interactive?: boolean;
  onClick?: () => void;
}

const MOVING_WORDS = ['alpha', 'beta', 'delta', 'omega', 'sync', 'live', 'XYZ'];

export function DropBrand({
  as: Component = 'span',
  className = '',
  showLogo = false,
  logoSize = 20,
  interactive = true,
  onClick,
}: DropBrandProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentWord, setCurrentWord] = useState('XYZ');
  const wordCycleTimer = useRef<any>(null);

  const startAnimation = () => {
    if (!interactive) return;
    setIsHovered(true);
    setCurrentWord('alpha'); // Immediately show the full word "alpha" on hover!

    if (wordCycleTimer.current) clearInterval(wordCycleTimer.current);

    let idx = 0;
    wordCycleTimer.current = setInterval(() => {
      idx = (idx + 1) % MOVING_WORDS.length;
      setCurrentWord(MOVING_WORDS[idx]);
    }, 1100);
  };

  const stopAnimation = () => {
    setIsHovered(false);
    if (wordCycleTimer.current) {
      clearInterval(wordCycleTimer.current);
      wordCycleTimer.current = null;
    }
    // Return gracefully to base XYZ
    setCurrentWord('XYZ');
  };

  useEffect(() => {
    return () => {
      if (wordCycleTimer.current) clearInterval(wordCycleTimer.current);
    };
  }, []);

  return (
    <Component
      onMouseEnter={startAnimation}
      onMouseLeave={stopAnimation}
      onTouchStart={startAnimation}
      onTouchEnd={() => setTimeout(stopAnimation, 1800)}
      onClick={onClick}
      className={`inline-flex items-center select-none cursor-pointer group shrink-0 overflow-visible ${className}`}
      title="DropXYZ"
    >
      {showLogo && (
        <DropLogo 
          size={logoSize} 
          className="mr-2 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" 
        />
      )}
      <span className="font-serif italic tracking-tight transition-colors duration-200 shrink-0">
        Drop
      </span>
      {/* Suffix container with overflow-visible and generous padding so nothing is ever cut */}
      <span className="relative inline-flex items-baseline font-serif italic tracking-tight overflow-visible pl-0.5 pr-3 py-1 min-w-[2.5ch]">
        {currentWord.split('').map((char, index) => (
          <span
            key={`${currentWord}-${index}`}
            className={`
              inline-block overflow-visible transition-colors duration-200
              ${isHovered 
                ? 'text-[var(--accent)] font-medium' 
                : 'text-inherit'
              }
            `}
            style={{
              animation: isHovered 
                ? `letterFloat 1.2s ease-in-out infinite alternate, wordEntrance 0.22s cubic-bezier(0.16, 1, 0.3, 1)` 
                : 'none',
              animationDelay: `${index * 60}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </span>
    </Component>
  );
}
