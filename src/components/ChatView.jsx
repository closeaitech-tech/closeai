import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useWallet } from '../context/WalletContext';
import {
  Send, Paperclip, Sparkles, Copy, Check, RefreshCw, Edit3, Loader2, Zap
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
  const { messages, loading, sendMessage } = useChat();
  const { closeBalance, sessionPassword, refreshBalance, handleSend: walletSend } = useWallet();
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [txConfirm, setTxConfirm] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto‑scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Greeting logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Welcome to OS AI';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  const greeting = getGreeting();

  // Send message (with CLOSE burning)
  const handleSendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    if (isGuest) {
      openModal('signup');
      return;
    }
    if (!sessionPassword) {
      openModal('password');
      return;
    }
    setInput('');
    if (editingMessage) setEditingMessage(null);
    try {
      const res = await sendMessage(msg, sessionPassword);
      if (res?.close_balance !== undefined) refreshBalance();
      if (res?.burn_tx) toast(`🔥 Burn TX: ${res.burn_tx.slice(0, 10)}...`);
    } catch (e) {
      toast('Message failed');
    }
  }, [input, loading, isGuest, sessionPassword, sendMessage, refreshBalance, openModal, toast, editingMessage]);

  // Detect transaction intent from chat
  const detectTransactionIntent = (text) => {
    const sendRegex = /send\s+(\d+(\.\d+)?)\s*(close|pol|usdt|usdc)\s+to\s+(0x[a-fA-F0-9]{40})/i;
    const match = text.match(sendRegex);
    if (match) {
      return {
        amount: match[1],
        token: match[3].toUpperCase(),
        to: match[4],
      };
    }
    return null;
  };

  // Handle send — check for transaction intent first
if (isGuest) {
  if (freeMessagesRemaining <= 0) {
    toast('You have 0 free messages left. Sign up and create an OS Wallet to get 500 CLOSE and continue.');
    openModal('signup');
    return;
  }
  if (freeMessagesRemaining <= 2) {
    toast(`You have ${freeMessagesRemaining} free message${freeMessagesRemaining === 1 ? '' : 's'} left. Sign up for 500 free CLOSE!`);
  }
}

  // Execute confirmed transaction
  const executeTransaction = async () => {
    if (!txConfirm) return;
    try {
      await walletSend(txConfirm.to, txConfirm.amount, txConfirm.token);
      toast(`Sent ${txConfirm.amount} ${txConfirm.token} to ${txConfirm.to.slice(0, 6)}...`);
      setTxConfirm(null);
      setInput('');
    } catch (e) {
      toast('Transaction failed: ' + e.message);
    }
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size / (1024 * 1024) > 60) { toast('Max file size is 60MB'); return; }
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const token = localStorage.getItem('capitan_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error('Upload failed');
      toast(`Uploaded: ${file.name}`);
      await handleSendMessage(`[Uploaded document: ${file.name}]\n\nPlease analyze this document.`);
    } catch { toast('Upload failed'); }
    finally { setUploading(false); }
  };

  // Suggestion pills
  const useSuggestion = (text) => { setInput(text); handleSendMessage(text); };

  // Copy to clipboard
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Regenerate last AI response
  const regenerate = () => {
    const last = [...messages].reverse().find(m => m.role === 'user');
    if (last) handleSendMessage(last.content);
  };

  // Edit message
  const startEditing = (msg) => { setEditingMessage(msg); setInput(msg.content); };
  const cancelEditing = () => { setEditingMessage(null); setInput(''); };
  const submitEdit = () => {
    if (!editingMessage) return;
    const newText = input.trim();
    if (!newText) return;
    setEditingMessage(null);
    setInput('');
    handleSendMessage(newText);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4">
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 scroll-smooth">
        {messages.length === 0 && !txConfirm ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-4xl font-heading font-bold bg-gradient-to-r from-[var(--accent)] to-violet-400 bg-clip-text text-transparent">
              {greeting}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2 mb-6">
              The Operating System for Intelligence
            </p>
            <div className="flex gap-3 justify-center mt-4 flex-wrap">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => useSuggestion(s.text)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] transition-all backdrop-blur-xl"
                >
                  <Sparkles size={14} className="text-[var(--accent)]" /> {s.label}
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
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl px-4 py-3 inline-flex gap-1 backdrop-blur-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-dot-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-dot-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-dot-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              ) : (
                <div className={`relative px-4 py-3 max-w-[78%] backdrop-blur-xl shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[var(--accent)] to-violet-500 text-white rounded-[20px_20px_4px_20px]'
                    : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[4px_20px_20px_20px] text-[var(--text-primary)]'
                }`}>
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

        {/* Transaction confirmation card */}
        {txConfirm && (
          <div className="flex justify-center animate-fade-slide-up">
            <div className="bg-[var(--glass-bg)] border border-[var(--accent)] rounded-2xl p-4 backdrop-blur-xl max-w-sm w-full space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                <Zap size={16} /> Confirm Transaction
              </div>
              <div className="text-sm text-[var(--text-primary)]">
                Send{' '}
                <span className="font-bold">{txConfirm.amount} {txConfirm.token}</span>{' '}
                to{' '}
                <span className="font-mono text-xs">{txConfirm.to}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={executeTransaction}
                  className="flex-1 py-2 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-xl font-semibold text-sm"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setTxConfirm(null)}
                  className="flex-1 py-2 border border-[var(--glass-border)] rounded-xl text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Editing bar */}
      {editingMessage && (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl rounded-xl px-4 py-2 flex items-center gap-2 mb-2">
          <span className="text-xs text-[var(--text-secondary)] flex-1">Editing message</span>
          <button onClick={cancelEditing} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]">
            Cancel
          </button>
          <button onClick={submitEdit} className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded-full">
            Save & Send
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="py-4">
        <div className="flex items-end gap-2 bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-full px-4 py-1 backdrop-blur-xl focus-within:border-[var(--accent)] focus-within:shadow-[0_0_10px_var(--accent-glow)] transition">
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
            placeholder="Ask OS AI or type a transaction..."
            className="flex-1 bg-transparent border-none outline-none resize-none py-2.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm max-h-[100px]"
          />
          <button
            onClick={() => editingMessage ? submitEdit() : handleSend()}
            disabled={loading || (!input.trim() && !editingMessage)}
            className="p-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white hover:opacity-90 disabled:opacity-40 transition"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}