import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiCall } from '../utils/api';

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('capitan_chats');
    return saved ? JSON.parse(saved) : [{ id: Date.now().toString(), title: 'New Chat', messages: [] }];
  });
  const [activeChatId, setActiveChatId] = useState(chats[0]?.id || null);
  const [loading, setLoading] = useState(false);
  // Free message counter for guests
  const [freeUsed, setFreeUsed] = useState(0);
  const MAX_FREE = 4;

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const freeMessagesRemaining = MAX_FREE - freeUsed;

  const persist = (updated) => {
    setChats(updated);
    localStorage.setItem('capitan_chats', JSON.stringify(updated));
  };

  const newChat = useCallback(() => {
    const newId = Date.now().toString();
    const updated = [{ id: newId, title: 'New Chat', messages: [] }, ...chats];
    persist(updated);
    setActiveChatId(newId);
  }, [chats]);

  const switchChat = useCallback((id) => setActiveChatId(id), []);

  const deleteChat = useCallback((id) => {
    const filtered = chats.filter(c => c.id !== id);
    if (filtered.length === 0) {
      const fallback = { id: Date.now().toString(), title: 'New Chat', messages: [] };
      persist([fallback]);
      setActiveChatId(fallback.id);
      return;
    }
    persist(filtered);
    if (activeChatId === id) setActiveChatId(filtered[0].id);
  }, [chats, activeChatId]);

  const sendMessage = useCallback(async (text, walletPassword) => {
    const chatIdx = chats.findIndex(c => c.id === activeChatId);
    if (chatIdx === -1) return;
    setLoading(true);

    // Increment free message counter for guests
    const isGuest = !localStorage.getItem('capitan_token');
    if (isGuest && freeUsed >= MAX_FREE) {
      setLoading(false);
      throw new Error('Free message limit reached. Please sign up.');
    }

    const userMsg = { role: 'user', content: text, id: Date.now().toString() };
    const updatedMessages = [...(chats[chatIdx].messages || []), userMsg];
    const typingMsg = { role: 'assistant', content: '', isTyping: true, id: 'typing' };

    const chatsWithTyping = chats.map((c, idx) =>
      idx === chatIdx ? { ...c, messages: [...updatedMessages, typingMsg] } : c
    );
    persist(chatsWithTyping);

    try {
      const res = await apiCall('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: updatedMessages,
          chat_id: activeChatId,
          wallet_password: walletPassword || undefined,
        }),
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.content || 'No response',
        id: res.message_id || Date.now().toString(),
      };

      const finalChats = chats.map((c, idx) =>
        idx === chatIdx ? { ...c, messages: [...updatedMessages, assistantMsg] } : c
      );
      persist(finalChats);

      if (updatedMessages.length === 1) {
        const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
        const titled = finalChats.map((c, idx) =>
          idx === chatIdx ? { ...c, title } : c
        );
        persist(titled);
      }

      // Increment free count only if guest
      if (isGuest) setFreeUsed(prev => prev + 1);
      return res;
    } catch (err) {
      const errorMsg = { role: 'assistant', content: 'Error: ' + err.message, id: 'error' };
      const errChats = chats.map((c, idx) =>
        idx === chatIdx ? { ...c, messages: [...updatedMessages, errorMsg] } : c
      );
      persist(errChats);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [chats, activeChatId, freeUsed]);

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