import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useAuth } from '../../context/AuthContext';
import { apiCall } from '../../utils/api';
import { Loader2 } from 'lucide-react';

export default function SignupModal({ onClose, toast }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Basic validations
    if (!email || !password) {
      toast('Fill all fields');
      return;
    }
    if (password.length < 6) {
      toast('Password must be at least 6 characters');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Sign up – sets auth token / session
      await signup(email, password, name);

      // Wallet activation – now uses the auth token established by signup, no password re‑transmission
      try {
        await apiCall('/api/wallet/activate', { method: 'POST' });
        toast('Account created! 2,000 CLOSE added to your wallet.');
      } catch (activationErr) {
        toast('Account created! Please activate your wallet from the OS Wallet page to receive 2,000 CLOSE.');
      }
      onClose();
    } catch (e) {
      toast('Signup failed: ' + (e.message || 'Please try again'));
    } finally {
      setLoading(false);
    }
  };

  // Open login modal via custom event – ensure the listener is cleaned up elsewhere
  const openLogin = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('open-login-modal'));
  };

  return (
    <ModalWrapper title="Create OS Wallet" onClose={onClose}>
      <div className="space-y-3">
        <input
          id="signup-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <input
          id="signup-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6)"
          autoComplete="new-password"
          className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <input
          id="signup-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          autoComplete="name"
          className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-3xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </div>
      <p className="text-center mt-3 text-xs text-[var(--text-secondary)]">
        Already have an account?{' '}
        <button onClick={openLogin} className="text-[var(--accent)] underline cursor-pointer">
          Sign in
        </button>
      </p>
    </ModalWrapper>
  );
}