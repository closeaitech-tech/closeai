import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiCall } from '../utils/api';

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

function loadChats() {
  try {
    const raw = localStorage.getItem('capitan_chats');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
function saveChats(chats) {
  try { localStorage.setItem('capitan_chats', JSON.stringify(chats)); } catch {}
}

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState(() => {
    const saved = loadChats();
    return saved?.length ? saved : [{ id: Date.now().toString(), title: 'New Chat', messages: [] }];
  });
  const [activeChatId, setActiveChatId] = useState(chats[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [freeUsed, setFreeUsed] = useState(0);
  const MAX_FREE = 5;

  const persist = useCallback((updater) => {
    setChats(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      saveChats(updated);
      return updated;
    });
  }, []);

  const newChat = useCallback(() => {
    const newId = Date.now().toString();
    const newChatObj = { id: newId, title: 'New Chat', messages: [] };
    persist(prev => [newChatObj, ...prev]);
    setActiveChatId(newId);
  }, [persist]);

  const switchChat = useCallback((id) => setActiveChatId(id), []);

  const deleteChat = useCallback((id) => {
    persist(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length === 0) {
        const fallback = { id: Date.now().toString(), title: 'New Chat', messages: [] };
        return [fallback];
      }
      return filtered;
    });
    setActiveChatId(prev => {
      if (prev === id) {
        const remaining = chats.filter(c => c.id !== id);
        return remaining.length > 0 ? remaining[0].id : Date.now().toString();
      }
      return prev;
    });
  }, [chats, persist]);

  const sendMessage = useCallback(async (text, walletPassword) => {
    const token = localStorage.getItem('capitan_token');
    if (!token) {
      if (freeUsed >= MAX_FREE) {
        throw new Error('Free message limit reached');
      }
    }

    const currentChatId = activeChatId;
    setLoading(true);

    const userMsg = { role: 'user', content: text, id: Date.now().toString(), timestamp: new Date().toISOString() };

    persist(prev =>
      prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: [...chat.messages, userMsg, { role: 'assistant', content: '', isTyping: true, id: 'typing' }] }
          : chat
      )
    );

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiCall('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...(chats.find(c => c.id === currentChatId)?.messages || []), userMsg],
          chat_id: currentChatId,
          wallet_password: walletPassword || undefined,
        }),
        headers,
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.content || 'No response',
        id: res.message_id || Date.now().toString(),
        timestamp: new Date().toISOString(),
      };

      // Auto‑title: use first 40 chars of first user message
      const chat = chats.find(c => c.id === currentChatId);
      const isFirstMessage = chat?.messages?.filter(m => m.role === 'user').length === 0;
      const newTitle = isFirstMessage ? text.slice(0, 40) + (text.length > 40 ? '...' : '') : undefined;

      persist(prev =>
        prev.map(c =>
          c.id === currentChatId
            ? { ...c, messages: c.messages.filter(m => m.id !== 'typing').concat(assistantMsg), title: newTitle || c.title }
            : c
        )
      );

      if (!token) setFreeUsed(prev => prev + 1);
      return res;
    } catch (err) {
      persist(prev =>
        prev.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: chat.messages.map(m =>
                m.id === 'typing' ? { role: 'assistant', content: 'Error: ' + err.message, id: 'error', timestamp: new Date().toISOString() } : m
              )}
            : chat
        )
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeChatId, chats, persist, freeUsed]);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0] || { messages: [] };
  const messages = activeChat?.messages || [];
  const freeMessagesRemaining = Math.max(0, MAX_FREE - freeUsed);

  return (
    <ChatContext.Provider value={{
      chats, activeChatId, messages, loading,
      newChat, switchChat, deleteChat, sendMessage,
      freeMessagesRemaining, freeUsed,
    }}>
      {children}
    </ChatContext.Provider>
  );
};