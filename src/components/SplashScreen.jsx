import React from 'react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[10000] bg-gradient-to-br from-[#0a0a1a] via-[#0f0f2a] to-[#0a0a1a] flex items-center justify-center">
      <div className="relative">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 rounded-full animate-ping opacity-30">
          <svg width="100" height="100" viewBox="0 0 40 40">
            <defs>
              <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <circle cx="20" cy="20" r="18" fill="none" stroke="url(#splashGrad)" strokeWidth="2" />
          </svg>
        </div>
        
        {/* Main logo */}
        <svg width="100" height="100" viewBox="0 0 40 40" className="animate-pulse">
          <defs>
            <linearGradient id="splashGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="none" stroke="url(#splashGrad2)" strokeWidth="2" />
          <text x="20" y="26" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="16" fill="url(#splashGrad2)" fontWeight="700">OS</text>
        </svg>
      </div>
    </div>
  );
}