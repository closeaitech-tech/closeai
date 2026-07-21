import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function SignupModal({ onClose, toast }) {
  const auth = useAuth();
  if (!auth) {
    return (
      <ModalWrapper title="Error" onClose={onClose}>
        <p className="text-red-400 text-sm">Service unavailable. Please reload.</p>
        <button onClick={onClose} className="w-full py-3 bg-[var(--accent)] text-white rounded-2xl mt-4">Close</button>
      </ModalWrapper>
    );
  }
  const { signup } = auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) { toast('Fill all fields'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address'); return; }
    setLoading(true); setError('');
    try { await signup(email, password, name); setStep('success'); }
    catch (e) { setError('Signup failed: ' + (e.message || 'Please try again')); }
    finally { setLoading(false); }
  };

  const openLogin = () => { onClose(); window.dispatchEvent(new CustomEvent('open-login-modal')); };

  return (
    <ModalWrapper title="Create Account" onClose={onClose}>
      {step === 'form' ? (
        <div className="space-y-3">
          <div className="bg-[var(--accent-glow)] border border-[var(--accent)] rounded-lg p-3 text-xs text-[var(--text-primary)]">
            Create your OS AI account. After signing up, create an OS Wallet to receive <strong>500 FREE CLOSE tokens</strong>.
          </div>
          {error ? <p className="text-red-400 text-sm bg-red-950/30 px-3 py-2 rounded-lg">{error}</p> : null}
          <input id="signup-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
          <input id="signup-password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6)" autoComplete="new-password" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
          <input id="signup-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" autoComplete="name" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
          <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-2xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}{loading ? 'Creating…' : 'Create Account'}
          </button>
          <p className="text-center mt-3 text-xs text-[var(--text-secondary)]">Already have an account? <button onClick={openLogin} className="text-[var(--accent)] underline cursor-pointer">Sign in</button></p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mx-auto"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg></div>
          <h3 className="text-xl font-heading font-bold">Account Created!</h3>
          <p className="text-sm text-[var(--text-secondary)]">Your OS AI account is ready. Create your OS Wallet from the sidebar to receive <strong>500 FREE CLOSE tokens</strong> and unlock unlimited AI access.</p>
          <button onClick={onClose} className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-2xl font-semibold">Get Started</button>
        </div>
      )}
    </ModalWrapper>
  );
}
