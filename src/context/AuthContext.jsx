import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiCall } from '../utils/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('capitan_user') || 'null'));
  const [token, setToken] = useState(localStorage.getItem('capitan_token') || null);

  const login = async (email, password) => {
    const res = await apiCall('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('capitan_token', res.token);
    localStorage.setItem('capitan_user', JSON.stringify(res.user));
  };

  const signup = async (email, password, name) => {
    const res = await apiCall('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('capitan_token', res.token);
    localStorage.setItem('capitan_user', JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('capitan_token');
    localStorage.removeItem('capitan_user');
  };

  const founderLogin = async (code) => {
    const res = await apiCall('/api/founder', { method: 'POST', body: JSON.stringify({ code }) });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('capitan_token', res.token);
    localStorage.setItem('capitan_user', JSON.stringify(res.user));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, founderLogin }}>
      {children}
    </AuthContext.Provider>
  );
};