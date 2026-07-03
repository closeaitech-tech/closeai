import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useWallet } from '../context/WalletContext';
import {
  Send, Paperclip, Sparkles, Copy, Check, RefreshCw, Edit3, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SUGGESTIONS = [
  { label: 'Business', text: "Give me today's top business headlines" },
  { label: 'Tech', text: 'Explain quantum computing simply' },
  { label: 'Everyday', text: 'Three easy dinner recipes' },
];

export default function ChatView({ openModal, toast }) {
  const { user, isGuest } = useAuth();
  const { messages, loading, sendMessage, freeMessagesRemaining } = useChat();
  const { closeBalance, CLOSE_PRICE, sessionPassword, refreshBalance } = useWallet();
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Corrected greeting logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Welcome';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  const greeting = getGreeting();

  const handleSend = useCallback(
    async (text) => {
      const msg = text || input.trim();
      if (!msg || loading) return;

      // Guest free message limit
      if (isGuest) {
        if (freeMessagesRemaining <= 0) {
          toast('Free message limit reached. Please sign up to continue.');
          openModal('signup');
          return;
        }
        if (freeMessagesRemaining === 1) {
          toast('You have 1 free message left. Sign up to unlock unlimited AI.');
        }
      }

      if (user && !sessionPassword) {
        openModal('password');
        return;
      }

      setInput('');
      if (editingMessage) {
        setEditingMessage(null);
      }
      try {
        const res = await sendMessage(msg, sessionPassword);
        if (res?.close_balance !== undefined) refreshBalance();
        if (res?.burn_tx) toast(`🔥 Burn TX: ${res.burn_tx.slice(0, 10)}...`);
      } catch (e) {
        if (e.message?.includes('Free message limit')) {
          toast('Free message limit reached. Please sign up.');
          openModal('signup');
        } else {
          toast('Message failed');
        }
      }
    },
    [
      input, loading, isGuest, user, sessionPassword, sendMessage,
      refreshBalance, openModal, toast, freeMessagesRemaining, editingMessage
    ]
  );

  // File upload with proper await – no race condition
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size / (1024 * 1024) > 60) {
      toast('Max file size is 60MB');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const token = localStorage.getItem('capitan_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      toast(`Uploaded: ${file.name}`);

      await sendMessage(
        `[Uploaded document: ${file.name}]\n\nPlease analyze this document.`,
        sessionPassword
      ).then((r) => {
        if (r?.close_balance !== undefined) refreshBalance();
        if (r?.burn_tx) toast(`🔥 Burn TX: ${r.burn_tx.slice(0, 10)}...`);
      });
    } catch {
      toast('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Suggestion pills – no timing hack
  const useSuggestion = (text) => {
    setInput(text);
    handleSend(text);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerate = () => {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    if (last) {
      if (last.content.startsWith('[Uploaded document:')) {
        toast('Regenerate will resend the upload request – are you sure?');
      }
      handleSend(last.content);
    }
  };

  // Edit message functionality
  const startEditing = (msg) => {
    setEditingMessage(msg);
    setInput(msg.content);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setInput('');
  };

  const submitEdit = async () => {
    if (!editingMessage) return;
    const newText = input.trim();
    if (!newText) return;
    // Simple approach: cancel editing and send as new message
    setEditingMessage(null);
    setInput('');
    handleSend(newText);
  };

  const showCenteredInput = messages.length === 0 && !loading && !editingMessage;

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4 relative">
      {/* Messages area */}
      <div
        className={`flex-1 overflow-y-auto py-4 space-y-4 scroll-smooth transition-all duration-300 ${
          showCenteredInput ? 'pb-32' : 'pb-24'
        }`}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
              {greeting}
            </h1>
            <div className="flex gap-3 justify-center mt-6 flex-wrap">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => useSuggestion(s.text)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] transition-all backdrop-blur-xl"
                >
                  <Sparkles size={14} className="text-[var(--accent)]" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={`group animate-fade-slide-up ${msg.role === 'user' ? 'flex justify-end' : ''}`}
            >
              {msg.isTyping ? (
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-4 py-3 inline-flex gap-1 backdrop-blur-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              ) : (
                <div
                  className={`relative px-4 py-3 max-w-[78%] backdrop-blur-xl ${
                    msg.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-[18px_18px_4px_18px]'
                      : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[4px_18px_18px_18px] text-[var(--text-primary)]'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <span>{msg.content}</span>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {!msg.isTyping && (
                    <div className="absolute -bottom-5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      {msg.role === 'assistant' && (
                        <>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                          >
                            {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                          {i === messages.length - 1 && (
                            <button
                              onClick={regenerate}
                              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}
                        </>
                      )}
                      {msg.role === 'user' && i === messages.length - 1 && (
                        <button
                          onClick={() => startEditing(msg)}
                          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-1">
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Editing bar */}
      {editingMessage && (
        <div className="absolute bottom-16 left-4 right-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl rounded-xl px-4 py-2 flex items-center gap-2 z-10">
          <span className="text-xs text-[var(--text-secondary)] flex-1">Editing message</span>
          <button onClick={cancelEditing} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]">Cancel</button>
          <button onClick={submitEdit} className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded-full">Save & Send</button>
        </div>
      )}

      {/* Input area */}
      <div
        className={`absolute left-4 right-4 transition-all duration-500 ease-in-out ${
          showCenteredInput ? 'top-1/2 -translate-y-1/2' : 'bottom-4'
        }`}
      >
        <div className="flex items-end gap-2 bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-3xl px-4 py-1 backdrop-blur-xl focus-within:border-[var(--accent)] transition">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] disabled:opacity-50 transition"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.docx,.doc,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
            className="hidden"
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                editingMessage ? submitEdit() : handleSend();
              }
            }}
            rows={1}
            placeholder={editingMessage ? "Edit your message..." : "Message..."}
            className="flex-1 bg-transparent border-none outline-none resize-none py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm max-h-[100px]"
          />
          <button
            onClick={() => editingMessage ? submitEdit() : handleSend()}
            disabled={loading || (!input.trim() && !editingMessage)}
            className="p-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}