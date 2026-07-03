import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import {
  MessageSquare, Wallet, Briefcase, Building2, Trophy,
  Code2, LayoutDashboard, ChevronDown, Sun, Moon, Monitor,
  Trash2, Plus
} from 'lucide-react';

export default function Sidebar({ open, onClose, openModal }) {
  const { user } = useAuth();
  const { stakeTier } = useWallet();
  const { theme, setTheme } = useTheme();
  const { chats, activeChatId, switchChat, deleteChat, newChat } = useChat();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const location = useLocation();

  // Fixed founder easter egg – no timer stacking, server‑side auth still required
  const handleFounderClick = () => {
    window.__founderClicks = (window.__founderClicks || 0) + 1;
    clearTimeout(window.__founderClickTimer);
    if (window.__founderClicks >= 13) {
      openModal('founder');
      window.__founderClicks = 0;
      return;
    }
    window.__founderClickTimer = setTimeout(() => {
      window.__founderClicks = 0;
    }, 3000);
  };

  const navItems = [
    { to: '/', icon: MessageSquare, label: 'Chat', show: true },
    { to: '/wallet', icon: Wallet, label: 'OS Wallets', show: true },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', show: !!user },
    { to: '/portfolio', icon: Briefcase, label: 'Portfolio', show: !!user },
    { to: '/workspaces', icon: Building2, label: 'Workspaces', show: !!user },
    { to: '/developer', icon: Code2, label: 'Developer', show: !!user && ['pro', 'enterprise', 'founder'].includes(stakeTier) },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: !!user && stakeTier === 'founder' },
  ];

  // Active route detection – works for nested routes
  const isActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();
    deleteChat(chatId);
    if (chatId === activeChatId) newChat();   // fallback when deleting active chat
  };

  const appearanceIcons = { light: Sun, dark: Moon, system: Monitor };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col transform transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Logo / Header */}
      <div
        className="p-5 border-b border-[var(--border-color)] flex items-center gap-3 cursor-pointer select-none"
        onClick={handleFounderClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFounderClick(); }}
      >
        <svg width="32" height="32" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent)]" />
          <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" className="text-[var(--text-secondary)]" />
          <text x="20" y="26" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="18" fill="currentColor" fontWeight="800" className="text-[var(--accent)]">C</text>
        </svg>
        <span className="text-xl font-extrabold tracking-wide bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dark)] bg-clip-text text-transparent">
          CAPITAN AI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* New Chat button */}
        <button
          onClick={() => { newChat(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition mb-2"
        >
          <Plus size={18} /> New Chat
        </button>

        {/* Recent chats */}
        {chats.length > 0 && (
          <div className="mb-2">
            <div className="px-4 py-1 text-xs font-medium text-[var(--text-tertiary)]">Recent</div>
            {chats.slice(0, 5).map((chat) => (
              <div
                key={chat.id}
                onClick={() => { switchChat(chat.id); onClose(); }}
                className={`group flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer text-sm ${
                  chat.id === activeChatId
                    ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { switchChat(chat.id); onClose(); } }}
              >
                <span className="truncate">{chat.title}</span>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                  aria-label="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Static nav items */}
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(item.to)
                    ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

        {!user && (
          <button
            onClick={() => { openModal('signup'); onClose(); }}
            className="w-full mt-2 px-4 py-2.5 border-2 border-[var(--accent)] text-[var(--accent)] rounded-xl text-xs font-semibold hover:bg-[var(--accent-glow)] transition"
          >
            Sign up for 2,000 CLOSE
          </button>
        )}
      </nav>

      {/* Appearance */}
      <div className="border-t border-[var(--border-color)] pt-2 mx-3">
        <button
          onClick={() => setAppearanceOpen(!appearanceOpen)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl"
        >
          Appearance
          <ChevronDown size={12} className={`transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
        </button>
        {appearanceOpen && (
          <div className="ml-4 space-y-1">
            {['light', 'dark', 'system'].map((t) => {
              const Icon = appearanceIcons[t];
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${
                    theme === t ? 'text-[var(--accent)] bg-[var(--accent-glow)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <Icon size={12} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Profile */}
      <div
        className="p-3 border-t border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-tertiary)] transition"
        onClick={() => openModal('profile')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openModal('profile'); }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--accent-glow)] border border-[var(--accent)] flex items-center justify-center text-sm font-bold text-[var(--accent)]">
            {user?.name?.charAt(0)?.toUpperCase() || 'G'}
          </div>
          <div>
            <div className="text-sm font-semibold">
              {user?.name || user?.email?.split('@')[0] || 'Guest'}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {user ? 'Connected' : 'Sign in'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}