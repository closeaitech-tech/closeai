import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export default function TopBar({ onMenuClick }) {
  const { newChat } = useChat();

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-12 px-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 40 40">
          <defs>
            <linearGradient id="tb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="none" stroke="url(#tb-grad)" strokeWidth="2" />
          <text x="20" y="26" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="14" fill="url(#tb-grad)" fontWeight="700">OS</text>
        </svg>
        <span className="text-sm font-heading font-bold bg-gradient-to-r from-[var(--accent)] to-violet-400 bg-clip-text text-transparent">
          OS AI
        </span>
      </div>

      {/* Right side — New Chat + Hamburger */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => newChat()}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] transition"
          title="New Chat"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition"
        >
          <Menu size={18} />
        </button>
      </div>
    </div>
  );
}