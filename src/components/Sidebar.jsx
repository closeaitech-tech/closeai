import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import {
  MessageSquare, Wallet, Briefcase, Building2, Trophy,
  Code2, LayoutDashboard, ChevronDown, Sun, Moon, Monitor, Trash2, Search, BookOpen, Plus
} from 'lucide-react';

export default function Sidebar({ open, onClose, openModal }) {
  const { user } = useAuth();
  const { stakeTier } = useWallet();
  const { theme, setTheme } = useTheme();
  const { chats, activeChatId, switchChat, deleteChat, newChat } = useChat();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const location = useLocation();

  // Founder Easter egg — 13 taps on CLOSEAI Technologies text at the bottom
  const handleFounderClick = () => {
    window.__founderClicks = (window.__founderClicks || 0) + 1;
    clearTimeout(window.__founderClickTimer);
    if (window.__founderClicks >= 13) {
      openModal('founder');
      window.__founderClicks = 0;
      return;
    }
    window.__founderClickTimer = setTimeout(() => { window.__founderClicks = 0; }, 3000);
  };

  const navItems = [
    { to: '/', icon: MessageSquare, label: 'Chat', show: true },
    { to: '/wallet', icon: Wallet, label: 'OS Wallet', show: true },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', show: !!user },
    { to: '/portfolio', icon: Briefcase, label: 'Portfolio', show: !!user },
    { to: '/workspaces', icon: Building2, label: 'Workspaces', show: !!user },
    { to: '/research', icon: Search, label: 'Research Hub', show: !!user },
    { to: '/learn', icon: BookOpen, label: 'Learn', show: true },
    { to: '/developer', icon: Code2, label: 'Developer', show: !!user && ['pro','enterprise','founder'].includes(stakeTier) },
  ];

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  const appearanceIcons = { light: Sun, dark: Moon, system: Monitor };

  return (
    <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[var(--sidebar-bg)] flex flex-col transform transition-transform duration-300 ease-in-out ${
      open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    }`}>
      
      {/* Logo — no click action, visual only */}
      <div className="p-4 border-b border-[var(--border-color)] flex items-center gap-3 select-none">
        <div className="relative">
          <svg width="32" height="32" viewBox="0 0 40 40">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <circle cx="20" cy="20" r="18" fill="none" stroke="url(#logoGrad)" strokeWidth="2" />
            <text x="20" y="26" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontSize="16" fill="url(#logoGrad)" fontWeight="700">OS</text>
          </svg>
        </div>
        <span className="text-lg font-bold font-heading bg-gradient-to-r from-[var(--accent)] to-violet-400 bg-clip-text text-transparent">
          OS AI
        </span>
      </div>

      {/* New Chat button — functional */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <button
          onClick={() => { newChat(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white hover:opacity-90 transition"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Recent Chats — actual conversation titles */}
      {chats.length > 0 && (
        <div className="p-3 border-b border-[var(--border-color)]">
          <div className="text-xs font-medium text-[var(--text-tertiary)] mb-2 px-1">Recent</div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {chats.filter(c => c.title !== 'New Chat' && c.messages?.length > 0).slice(0, 15).map(chat => (
              <div
                key={chat.id}
                onClick={() => { switchChat(chat.id); onClose(); }}
                className={`group flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer text-xs ${
                  chat.id === activeChatId ? 'bg-[var(--accent-glow)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                role="button" tabIndex={0}
              >
                <span className="truncate">{chat.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); if (chat.id === activeChatId) newChat(); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                ><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.filter(i => i.show).map(item => (
          <Link key={item.to} to={item.to} onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            isActive(item.to) ? 'bg-[var(--accent-glow)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]'
          }`}>
            <item.icon size={18} /> {item.label}
          </Link>
        ))}
        {!user && (
          <button onClick={() => { openModal('signup'); onClose(); }} className="w-full mt-2 px-3 py-2 border-2 border-[var(--accent)] text-[var(--accent)] rounded-xl text-xs font-semibold hover:bg-[var(--accent-glow)] transition">
            Sign up for 500 CLOSE
          </button>
        )}
      </nav>

      {/* Appearance + Profile */}
      <div className="flex-shrink-0 border-t border-[var(--border-color)]">
        <div className="pt-1 mx-3">
          <button onClick={() => setAppearanceOpen(!appearanceOpen)} className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl">
            Appearance <ChevronDown size={12} className={`transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
          </button>
          {appearanceOpen && (
            <div className="ml-3 space-y-0.5 mb-1">
              {['light','dark','system'].map(t => {
                const Icon = appearanceIcons[t];
                return (
                  <button key={t} onClick={() => setTheme(t)} className={`w-full text-left px-3 py-1 rounded-lg text-xs flex items-center gap-2 ${theme===t ? 'text-[var(--accent)] bg-[var(--accent-glow)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>
                    <Icon size={12} /> {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition border-t border-[var(--border-color)]" onClick={() => openModal('profile')} role="button" tabIndex={0}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-violet-500 flex items-center justify-center text-sm font-bold text-white">{user?.name?.charAt(0)?.toUpperCase() || 'G'}</div>
            <div className="text-xs font-medium">{user?.name || user?.email?.split('@')[0] || 'Guest'}</div>
          </div>
        </div>
      </div>

      {/* CLOSEAI Technologies — carries the 13‑tap founder Easter egg */}
      <div
        className="border-t border-[var(--border-color)] px-4 py-2.5 text-center cursor-pointer select-none"
        onClick={handleFounderClick}
      >
        <span className="text-[10px] text-[var(--text-tertiary)] tracking-wider hover:text-[var(--accent)] transition">
          CLOSEAI Technologies
        </span>
      </div>
    </aside>
  );
}