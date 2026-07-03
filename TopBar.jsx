import React from 'react';
import { Menu, Bell } from 'lucide-react';

export default function TopBar({ onMenuClick }) {
  return (
    <div className="h-12 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]/80 backdrop-blur-xl">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
        <Menu size={18} />
      </button>
      <div className="flex-1" />
      <button className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
        <Bell size={18} />
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">0</span>
      </button>
    </div>
  );
}