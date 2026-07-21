import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useWallet } from '../../context/WalletContext';

async function encryptPrivateKey(privateKey, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(privateKey));
  return { salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

async function decryptPrivateKey(encrypted, password) {
  const salt = new Uint8Array(encrypted.salt);
  const iv = new Uint8Array(encrypted.iv);
  const ciphertext = new Uint8Array(encrypted.ciphertext);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export default function ChangePasswordModal({ onClose, toast }) {
  const { encryptedKey, password, setPassword } = useWallet();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) { toast('All fields required'); return; }
    if (newPassword.length < 5) { toast('Password must be at least 5 characters'); return; }
    if (newPassword !== confirmNewPassword) { toast('New passwords do not match'); return; }
    if (!encryptedKey) { toast('No wallet found'); return; }

    setLoading(true);
    try {
      const privateKey = await decryptPrivateKey(encryptedKey, currentPassword);
      const newEncrypted = await encryptPrivateKey(privateKey, newPassword);
      localStorage.setItem('capitan_encrypted_key', JSON.stringify(newEncrypted));
      setPassword(newPassword);
      toast('Password changed successfully');
      onClose();
    } catch (e) { toast('Current password is incorrect'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Change Wallet Password" onClose={onClose}>
      <div className="space-y-3">
        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 5)" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
        <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Confirm new password" className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none" />
        <button onClick={handleChange} disabled={loading} className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-2xl font-semibold disabled:opacity-50">
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </ModalWrapper>
  );
}
