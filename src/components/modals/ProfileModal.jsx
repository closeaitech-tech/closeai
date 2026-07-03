import ModalWrapper from './ModalWrapper';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';

export default function ProfileModal({ onClose, toast, openModal }) {
  const { user, logout } = useAuth();
  const { walletAddress, lockWallet } = useWallet();
  return (
    <ModalWrapper title="Account" onClose={onClose}>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Email</span><span>{user?.email || 'Guest'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Wallet</span><span className="font-mono text-xs">{walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : 'Not connected'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Staking Tier</span><span className="capitalize">{stakeTier || 'none'}</span></div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button onClick={() => { onClose(); openModal('privacy'); }} className="text-left text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]">Privacy Policy</button>
        <button onClick={() => { onClose(); openModal('terms'); }} className="text-left text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]">Terms of Service</button>
        {user && <button onClick={lockWallet} className="py-2 border border-[var(--glass-border)] rounded-xl text-sm">Lock Wallet</button>}
        {user && <button onClick={() => { logout(); onClose(); }} className="py-2 bg-red-500 text-white rounded-xl text-sm">Sign Out</button>}
      </div>
    </ModalWrapper>
  );
}