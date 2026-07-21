cat << 'ENDOFFILE' > ~/closeai/src/components/WalletPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../utils/api';
import {
  Send, ArrowDownLeft, Repeat, Clock, Settings, Copy, ChevronRight,
  Flame, ArrowLeft, Check, QrCode, ChevronDown, Wallet, ShieldAlert,
  ExternalLink, TrendingUp, TrendingDown, Loader2, Eye, EyeOff, Lock, Newspaper, Zap
} from 'lucide-react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';

/* ================================================================
   Price Ticker
   ================================================================ */
function PriceTicker() {
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await apiCall('/api/market/crypto');
        if (Array.isArray(res)) setPrices(res.slice(0, 10));
      } catch {}
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!prices.length) return null;

  return (
    <div className="overflow-hidden whitespace-nowrap bg-[var(--glass-bg)] border-y border-[var(--glass-border)] py-2 mb-6">
      <div className="inline-flex gap-8 animate-marquee">
        {prices.map((coin) => (
          <div key={coin.id} className="flex items-center gap-1 text-xs">
            <span className="font-medium text-[var(--text-primary)]">{coin.symbol.toUpperCase()}</span>
            <span className="text-[var(--text-secondary)]">${coin.current_price?.toFixed(2)}</span>
            <span className={coin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {coin.price_change_percentage_24h?.toFixed(1)}%
            </span>
          </div>
        ))}
        {prices.map((coin) => (
          <div key={coin.id + '-dup'} className="flex items-center gap-1 text-xs">
            <span className="font-medium text-[var(--text-primary)]">{coin.symbol.toUpperCase()}</span>
            <span className="text-[var(--text-secondary)]">${coin.current_price?.toFixed(2)}</span>
            <span className={coin.price_change_percentage_24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {coin.price_change_percentage_24h?.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   Unlock Screen
   ================================================================ */
function UnlockScreen({ encryptedKey, onCreate, onImport, onUnlock, mnemonic, onClearMnemonic, toast, unlockError, clearUnlockError }) {
  const [mode, setMode] = useState(encryptedKey ? 'unlock' : 'create');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    clearUnlockError?.();
    setMode(newMode);
  };

  const handleSubmit = async () => {
    if (!pwd || pwd.length < 5) { toast('Password must be at least 5 characters'); return; }
    if (mode === 'create') {
      if (pwd !== confirmPwd) { toast('Passwords do not match'); return; }
      setLoading(true);
      try { await onCreate(pwd); } catch (e) { toast('Failed to create wallet'); }
      setLoading(false);
    } else if (mode === 'import') {
      if (!keyInput.trim()) { toast('Enter a private key or mnemonic'); return; }
      setLoading(true);
      try { await onImport(pwd, keyInput); } catch (e) { toast('Import failed'); }
      setLoading(false);
    } else {
      setLoading(true);
      try { await onUnlock(pwd); } catch (e) {}
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl backdrop-blur-xl">
      <div className="flex flex-col items-center text-center">
        <Wallet size={40} className="text-[var(--accent)] mb-4" />
        <h2 className="text-xl font-heading font-bold mb-1">
          {mode === 'create' ? 'Create Wallet' : mode === 'import' ? 'Import Wallet' : 'Unlock Wallet'}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {mode === 'unlock' ? 'Enter your wallet password to continue.' : 'Choose a strong password to secure your wallet.'}
        </p>
      </div>
      {mnemonic && (
        <div className="bg-[var(--bg-secondary)] p-3 rounded-xl text-xs text-[var(--text-primary)] mb-4 break-words border border-[var(--border-color)]">
          <p className="text-amber-400 font-semibold mb-1">Your Seed Phrase (write it down!)</p>
          {mnemonic}
          <button onClick={onClearMnemonic} className="mt-2 text-[var(--accent)] underline text-xs">I've saved it</button>
        </div>
      )}
      {unlockError && <p className="text-red-400 text-sm mb-3 bg-red-950/30 px-3 py-2 rounded-lg">{unlockError}</p>}
      <div className="space-y-3">
        <div className="relative">
          <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Wallet password" className="w-full p-3 pr-10 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
          <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-3 text-[var(--text-tertiary)]">{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {mode === 'create' && <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Confirm password" className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />}
        {mode === 'import' && <textarea value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Private key or 12-word mnemonic" rows={3} className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none resize-none focus:border-[var(--accent)]" />}
        <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50">
          {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : (mode === 'unlock' ? 'Unlock' : 'Continue')}
        </button>
        {!encryptedKey && (
          <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-2">
            {mode !== 'create' && <button onClick={() => switchMode('create')} className="hover:text-[var(--accent)]">Create new</button>}
            {mode !== 'import' && <button onClick={() => switchMode('import')} className="hover:text-[var(--accent)]">Import</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Home Screen (Dashboard)
   ================================================================ */
function HomeScreen({ setTab, openModal, toast }) {
  const { wallet, balances, loadingBal, chain, selectedChain, setSelectedChain, stakedBalance, burnedAmount, totalUsd } = useWallet();
  const [stakeExpanded, setStakeExpanded] = useState(false);

  const tokens = Object.entries(balances || {}).map(([sym, info]) => ({
    symbol: sym,
    balance: ethers.utils.formatUnits(info.balance, info.decimals || 18),
    usdValue: info.usdValue || 0,
    change: 0,
  }));

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
      .then(() => toast('Address copied'))
      .catch(() => toast('Could not copy address'));
  };

  return (
    <div>
      <PriceTicker />
      <div className="bg-gradient-to-r from-[var(--accent)] to-violet-600 rounded-2xl p-5 mb-6 text-white">
        <div className="text-sm opacity-80">Total Balance</div>
        <div className="text-3xl font-heading font-bold mt-1">${totalUsd.toFixed(2)}</div>
        <div className="flex items-center gap-4 mt-4">
          <button onClick={() => setTab('send')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs font-medium hover:bg-white/30 transition"><Send size={14} /> Send</button>
          <button onClick={() => setTab('receive')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs font-medium hover:bg-white/30 transition"><ArrowDownLeft size={14} /> Receive</button>
          <button onClick={() => openModal('swap')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs font-medium hover:bg-white/30 transition"><Repeat size={14} /> Swap</button>
          <button onClick={() => openModal('buy')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs font-medium hover:bg-white/30 transition"><Wallet size={14} /> Buy</button>
        </div>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Assets</h2>
          <span className="text-xs text-[var(--text-tertiary)]">{wallet?.address?.slice(0,6)}…{wallet?.address?.slice(-4)} <button onClick={handleCopyAddress} className="ml-1 text-[var(--accent)]"><Copy size={10} /></button></span>
        </div>
        {loadingBal ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-[var(--accent)]" /></div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No tokens found</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tokens.map((t) => (
              <div key={t.symbol} className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">{t.symbol.slice(0,1)}</div>
                <span className="font-medium text-[var(--text-primary)]">{t.balance.slice(0,8)}</span>
                <span className="text-[var(--text-secondary)]">{t.symbol}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div onClick={() => setStakeExpanded(!stakeExpanded)} className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-4 mb-4 cursor-pointer hover:border-[var(--accent)] transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Flame size={18} className="text-[var(--accent)]" /><span className="font-medium text-sm">Staked CLOSE</span></div>
          <span className="font-mono text-sm">{stakedBalance} CLOSE</span>
        </div>
        {stakeExpanded && (
          <div className="mt-3 pt-3 border-t border-[var(--glass-border)] space-y-2">
            <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">Staked</span><span className="font-mono">{stakedBalance} CLOSE</span></div>
            <div className="flex justify-between text-xs"><span className="text-[var(--text-secondary)]">Burned</span><span className="font-mono">{burnedAmount} CLOSE</span></div>
            <button onClick={(e) => { e.stopPropagation(); openModal('buy'); }} className="w-full py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-semibold">Buy CLOSE</button>
          </div>
        )}
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('activity')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${tab==='activity' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)]'}`}><Clock size={14} /> Activity</button>
        <button onClick={() => setTab('news')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${tab==='news' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)]'}`}><Newspaper size={14} /> News</button>
      </div>
    </div>
  );
}

/* ================================================================
   Send Screen
   ================================================================ */
function SendScreen({ setTab }) {
  const { handleSend: walletSend, chain } = useWallet();
  const [step, setStep] = useState('form');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState(chain?.symbol || 'POL');
  const [sending, setSending] = useState(false);

  const proceed = async () => {
    if (step === 'form') {
      if (!recipient || !amount) return;
      if (!ethers.utils.isAddress(recipient)) { alert('Invalid address'); return; }
      setStep('review');
    } else {
      setSending(true);
      try { await walletSend(recipient, amount, selectedToken); setStep('success'); }
      catch (e) {} finally { setSending(false); }
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto mt-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-emerald-400" /></div>
        <h3 className="text-xl font-heading font-bold mb-2">Transaction sent</h3>
        <button onClick={() => { setStep('form'); setTab('home'); }} className="mt-4 px-6 py-2 bg-[var(--accent)] text-white rounded-full font-semibold text-sm">Done</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <ScreenHeader title={step === 'form' ? 'Send' : 'Review'} onBack={() => step === 'form' ? setTab('home') : setStep('form')} />
      <div className="space-y-4">
        {step === 'form' ? (
          <>
            <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Recipient address" className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none text-sm" />
            <select value={selectedToken} onChange={e => setSelectedToken(e.target.value)} className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none text-sm">
              {Object.keys(chain?.tokens || {}).map(tok => <option key={tok} value={tok}>{tok}</option>)}
            </select>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] outline-none text-sm" />
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-2xl font-heading font-bold text-[var(--text-primary)]">{amount} {selectedToken}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-1">to {recipient.slice(0,8)}…</div>
          </div>
        )}
        <button onClick={proceed} disabled={!recipient || !amount || sending} className="w-full py-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {sending ? <Loader2 size={16} className="animate-spin" /> : (step === 'form' ? 'Review' : 'Confirm & Send')}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   Receive Screen
   ================================================================ */
function ReceiveScreen({ setTab }) {
  const { wallet, chain } = useWallet();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => { if (wallet && qrRef.current) { QRCode.toCanvas(qrRef.current, wallet.address, { width: 180 }); } }, [wallet]);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => alert('Could not copy address'));
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <ScreenHeader title="Receive" onBack={() => setTab('home')} />
      <canvas ref={qrRef} className="mx-auto mb-4" />
      <div className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 flex items-center justify-between mb-3">
        <span className="text-[var(--text-primary)] font-mono text-xs truncate mr-2">{wallet?.address}</span>
        <button onClick={handleCopy} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">{copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}</button>
      </div>
      <p className="text-xs text-[var(--text-secondary)] bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">Only send {chain?.name || 'Polygon'} assets to this address.</p>
    </div>
  );
}

/* ================================================================
   Activity Screen
   ================================================================ */
function ActivityScreen() {
  const { txs, loadingTxs, chain, wallet } = useWallet();
  return (
    <div>
      <ScreenHeader title="Activity" onBack={() => {}} />
      {loadingTxs ? (<div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--accent)]" /></div>) : !txs || txs.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No transactions found</p>
      ) : (
        <div className="space-y-2">
          {txs.map((tx, i) => (
            <div key={i} className="flex items-center justify-between bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(tx.from||'').toLowerCase() === (wallet?.address||'').toLowerCase() ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                  {(tx.from||'').toLowerCase() === (wallet?.address||'').toLowerCase() ? <Send size={14} className="text-red-400" /> : <ArrowDownLeft size={14} className="text-emerald-400" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{(tx.from||'').toLowerCase() === (wallet?.address||'').toLowerCase() ? 'Sent' : 'Received'}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{tx.time}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-[var(--text-primary)]">{(tx.from||'').toLowerCase() === (wallet?.address||'').toLowerCase() ? '-' : '+'}{parseFloat(tx.value).toFixed(4)} {tx.token}</div>
                <a href={`${chain?.explorer||'#'}/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] flex items-center justify-end gap-1"><ExternalLink size={10} /> Details</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   News Screen
   ================================================================ */
function NewsScreen() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('/api/market/news')
      .then(res => setNews(Array.isArray(res) ? res : (res.news || [])))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <ScreenHeader title="News" onBack={() => {}} />
      {loading ? (<div className="flex justify-center py-8"><Loader2 className="animate-spin text-[var(--accent)]" /></div>) : news.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No news available</p>
      ) : (
        <div className="space-y-3">
          {news.slice(0, 20).map((item, i) => (
            <a key={i} href={item.url || '#'} target="_blank" rel="noreferrer" className="block bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3 hover:border-[var(--accent)] transition">
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">{item.headline || item.title}</h3>
              {item.summary && <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{item.summary}</p>}
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1">{item.source}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Screen Header
   ================================================================ */
function ScreenHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {onBack && <button onClick={onBack} className="p-2 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)]"><ArrowLeft size={18} /></button>}
      <h1 className="text-2xl font-heading font-bold">{title}</h1>
    </div>
  );
}

/* ================================================================
   Main WalletPage
   ================================================================ */
export default function WalletPage({ openModal, toast }) {
  const { wallet, encryptedKey, createWallet, importWallet, unlockWallet, mnemonic, clearMnemonic, unlockError, clearUnlockError } = useWallet();
  const [tab, setTab] = useState('home');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">OS Wallet</h1>
        <button onClick={() => navigate('/')} className="p-2 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {!wallet ? (
        <UnlockScreen encryptedKey={encryptedKey} onCreate={createWallet} onImport={importWallet} onUnlock={unlockWallet} mnemonic={mnemonic} onClearMnemonic={clearMnemonic} toast={toast} unlockError={unlockError} clearUnlockError={clearUnlockError} />
      ) : (
        <>
          {tab === 'home' && <HomeScreen setTab={setTab} openModal={openModal} toast={toast} />}
          {tab === 'send' && <SendScreen setTab={setTab} />}
          {tab === 'receive' && <ReceiveScreen setTab={setTab} />}
          {tab === 'activity' && <ActivityScreen />}
          {tab === 'news' && <NewsScreen />}
        </>
      )}
    </div>
  );
}
ENDOFFILE