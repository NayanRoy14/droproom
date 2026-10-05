"use client";

interface DropLogoProps {
  className?: string;
  size?: number;
}

export function DropLogo({ className = "w-5 h-5", size = 20 }: DropLogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Facet X (Left Plane - High Tone) */}
      <path 
        d="M15.3 3.6 C15.3 3.6 8.2 12.2 8.2 18 C8.2 20.6 9.5 22.8 11.5 24.2 L15.3 16.5 Z" 
        fill="currentColor" 
        fillOpacity="0.95"
      />
      {/* Facet Y (Right Plane - Medium Tone) */}
      <path 
        d="M16.7 3.6 C16.7 3.6 23.8 12.2 23.8 18 C23.8 20.6 22.5 22.8 20.5 24.2 L16.7 16.5 Z" 
        fill="currentColor" 
        fillOpacity="0.65"
      />
      {/* Facet Z (Floor Plane - Ambient Tone) */}
      <path 
        d="M12.4 25.1 C13.4 25.8 14.6 26.2 16 26.2 C17.4 26.2 18.6 25.8 19.6 25.1 L16 17.7 Z" 
        fill="currentColor" 
        fillOpacity="0.35"
      />
    </svg>
  );
}
