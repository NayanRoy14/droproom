"use client";

import { useState, useEffect, useRef } from 'react';
import { DropLogo } from './DropLogo';

interface DropBrandProps {
  as?: 'h1' | 'span' | 'div';
  className?: string;
  showLogo?: boolean;
  logoSize?: number;
  interactive?: boolean;
  hideTextOnMobile?: boolean;
  onClick?: () => void;
}

const GLYPH_CYCLES: string[][] = [
  ['α', 'β', 'γ'], // Alpha, Beta, Gamma (Greek)
  ['λ', 'μ', 'ν'], // Lambda, Nu, Mu
  ['1', '2', '3'], // Numbers
  ['✦', '▲', '●'], // Geometric symbols
  ['∞', '≈', '∆'], // Math operators
  ['0', '1', '0'], // Binary
  ['δ', 'ε', 'θ'], // Delta, Epsilon, Theta
  ['x', 'y', 'z'], // Lowercase
  ['X', 'Y', 'Z'], // Base
];

const FAST_GLYPHS = ['α', 'β', 'γ', 'δ', 'ε', 'λ', 'μ', 'ν', 'π', 'Ω', '∞', '✦', '∆', '0', '1', '7', 'X', 'Y', 'Z'];

export function DropBrand({
  as: Component = 'span',
  className = '',
  showLogo = false,
  logoSize = 20,
  interactive = true,
  hideTextOnMobile = false,
  onClick,
}: DropBrandProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [letters, setLetters] = useState<[string, string, string]>(['X', 'Y', 'Z']);
  const [isAnimating, setIsAnimating] = useState(false);
  const intervalRef = useRef<any>(null);
  const settleRef = useRef<any>(null);
  const touchTimerRef = useRef<any>(null);
  const frameCount = useRef(0);

  const startAnimation = () => {
    if (!interactive) return;
    setIsHovered(true);
    setIsAnimating(true);
    frameCount.current = 0;

    if (settleRef.current) {
      clearInterval(settleRef.current);
      settleRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      frameCount.current++;
      const cycleIndex = Math.floor(frameCount.current / 4) % GLYPH_CYCLES.length;
      const targetCycle = GLYPH_CYCLES[cycleIndex];

      // Jitter / Scramble effect moving through alpha and mathematical symbols
      setLetters([
        frameCount.current % 3 === 0 ? FAST_GLYPHS[Math.floor(Math.random() * FAST_GLYPHS.length)] : targetCycle[0],
        frameCount.current % 2 === 0 ? FAST_GLYPHS[Math.floor(Math.random() * FAST_GLYPHS.length)] : targetCycle[1],
        targetCycle[2],
      ]);
    }, 75);
  };

  const stopAnimation = () => {
    setIsHovered(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (settleRef.current) {
      clearInterval(settleRef.current);
      settleRef.current = null;
    }

    // Gracefully resolve back to 'XYZ' with a smooth transition
    let settleSteps = 3;
    settleRef.current = setInterval(() => {
      settleSteps--;
      if (settleSteps === 2) {
        setLetters(['α', 'β', 'Z']);
      } else if (settleSteps === 1) {
        setLetters(['X', 'β', 'Z']);
      } else {
        setLetters(['X', 'Y', 'Z']);
        setIsAnimating(false);
        if (settleRef.current) {
          clearInterval(settleRef.current);
          settleRef.current = null;
        }
      }
    }, 60);
  };

  const handleTouch = () => {
    if (!interactive) return;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    startAnimation();
    touchTimerRef.current = setTimeout(() => {
      stopAnimation();
    }, 1600);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (settleRef.current) clearInterval(settleRef.current);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  if (!interactive) {
    return (
      <Component
        onClick={onClick}
        className={`inline-flex items-center select-none shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
        title="DropXYZ"
      >
        {showLogo && (
          <DropLogo 
            size={logoSize} 
            className="mr-2 shrink-0" 
          />
        )}
        <span className={`items-center overflow-visible ${hideTextOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'}`}>
          <span className="font-serif italic tracking-tight shrink-0">
            DropXYZ
          </span>
        </span>
      </Component>
    );
  }

  return (
    <Component
      onMouseEnter={startAnimation}
      onMouseLeave={stopAnimation}
      onTouchStart={handleTouch}
      onClick={onClick}
      className={`inline-flex items-center select-none cursor-pointer group shrink-0 overflow-visible touch-manipulation pr-1.5 ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      title="DropXYZ"
    >
      {showLogo && (
        <DropLogo 
          size={logoSize} 
          className="mr-2 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" 
        />
      )}
      <span className={`items-center overflow-visible ${hideTextOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'}`}>
        <span className="font-serif italic tracking-tight transition-colors duration-200 shrink-0">
          Drop
        </span>
        {/* Suffix container with overflow-visible and generous clearance padding so right side of Z is NEVER cut */}
        <span className="relative inline-flex items-baseline font-serif italic tracking-tight overflow-visible pl-0.5 pr-3 py-0.5">
          {letters.map((char, index) => (
            <span
              key={index}
              className={`
                inline-block overflow-visible transition-all duration-100 transform
                ${isHovered 
                  ? 'text-[var(--accent)] scale-105 -translate-y-[1px]' 
                  : 'text-inherit scale-100 translate-y-0'
                }
              `}
              style={{
                transitionDelay: `${index * 25}ms`,
              }}
            >
              {char}
            </span>
          ))}
          {isHovered && (
            <span className="absolute bottom-0 left-0 right-1.5 h-[1.5px] bg-[var(--accent)]/40 animate-pulse rounded-full" />
          )}
        </span>
      </span>
    </Component>
  );
}
