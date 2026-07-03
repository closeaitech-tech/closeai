import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import {
  Send, ArrowDownLeft, Repeat, Clock, Settings, Copy, ChevronRight,
  Flame, ArrowLeft, Check, QrCode, ChevronDown, Wallet, ShieldAlert,
  ExternalLink, TrendingUp, TrendingDown, Loader2, Eye, EyeOff, Lock
} from 'lucide-react';
import { ethers } from 'ethers';
import QRCode from 'qrcode';

// ---------- Chain configuration ----------
const CHAINS = {
  polygon: {
    name: 'Polygon',
    symbol: 'POL',
    rpc: import.meta.env.VITE_ALCHEMY_POLYGON || 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    explorerApi: 'https://api.polygonscan.com/api',
    explorerApiKey: import.meta.env.VITE_POLYGONSCAN_API_KEY || '',
    chainId: 137,
    tokens: {
      POL: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },  // fixed native token
      USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
      CLOSE: { address: import.meta.env.VITE_CLOSE_TOKEN_ADDRESS_POLYGON || '0x...', decimals: 18 }
    }
  },
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ETHEREUM || 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    explorerApi: 'https://api.etherscan.io/api',
    explorerApiKey: import.meta.env.VITE_ETHERSCAN_API_KEY || '',
    chainId: 1,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
      CLOSE: { address: import.meta.env.VITE_CLOSE_TOKEN_ADDRESS_ETHEREUM || '0x...', decimals: 18 }
    }
  },
  bsc: {
    name: 'BSC',
    symbol: 'BNB',
    rpc: import.meta.env.VITE_ALCHEMY_BSC || 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    explorerApi: 'https://api.bscscan.com/api',
    explorerApiKey: import.meta.env.VITE_BSCSCAN_API_KEY || '',
    chainId: 56,
    tokens: {
      BNB: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
      WETH: { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
      CLOSE: { address: import.meta.env.VITE_CLOSE_TOKEN_ADDRESS_BSC || '0x...', decimals: 18 }
    }
  },
  arbitrum: {
    name: 'Arbitrum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    explorerApi: 'https://api.arbiscan.io/api',
    explorerApiKey: import.meta.env.VITE_ARBISCAN_API_KEY || '',
    chainId: 42161,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
      CLOSE: { address: import.meta.env.VITE_CLOSE_TOKEN_ADDRESS_ARBITRUM || '0x...', decimals: 18 }
    }
  },
  base: {
    name: 'Base',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_BASE || 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    explorerApi: 'https://api.basescan.org/api',
    explorerApiKey: import.meta.env.VITE_BASESCAN_API_KEY || '',
    chainId: 8453,
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      CLOSE: { address: import.meta.env.VITE_CLOSE_TOKEN_ADDRESS_BASE || '0x...', decimals: 18 }
    }
  }
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)'
];

// ---------- Helper Components ----------

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-2">
      <Icon size={20} strokeWidth={2} style={{ color: active ? 'var(--accent)' : '#52525b' }} />
      <span className="text-[10px] font-medium" style={{ color: active ? 'var(--accent)' : '#52525b' }}>{label}</span>
    </button>
  );
}

function ScreenHeader({ title, onBack, right }) {
  return (
    <div className="flex items-center justify-between px-5 pt-2 pb-4">
      {onBack ? (
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-200"><ArrowLeft size={20} /></button>
      ) : <div className="w-5" />}
      <span className="text-zinc-200 text-sm font-semibold tracking-wide">{title}</span>
      {right || <div className="w-5" />}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={`text-zinc-200 text-xs ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-[var(--accent)] group-active:scale-95 transition">
        <Icon size={18} className="text-zinc-300" />
      </div>
      <span className="text-zinc-400 text-[11px] font-medium">{label}</span>
    </button>
  );
}

// ---------- Screens ----------

function UnlockScreen({
  encryptedKey, onCreate, onImport, onUnlock, mnemonic, onClearMnemonic, toast
}) {
  const [mode, setMode] = useState(encryptedKey ? 'unlock' : 'create');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!pwd || pwd.length < 8) {   // raised minimum to 8
      toast('Password must be at least 8 characters');
      return;
    }
    if (mode === 'create') {
      if (pwd !== confirmPwd) { toast('Passwords do not match'); return; }
      setLoading(true);
      try {
        await onCreate(pwd);
      } catch (e) {
        toast('Failed to create wallet');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'import') {
      if (!keyInput.trim()) { toast('Enter a private key or mnemonic'); return; }
      setLoading(true);
      try {
        await onImport(pwd, keyInput);
      } catch (e) {
        toast('Import failed');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await onUnlock(pwd);
      } catch (e) {
        toast('Incorrect password');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <Wallet size={40} className="text-zinc-500 mb-4" />
      <h2 className="text-zinc-200 text-lg font-semibold mb-2">
        {mode === 'create' ? 'Create Wallet' : mode === 'import' ? 'Import Wallet' : 'Unlock Wallet'}
      </h2>

      {mnemonic && (
        <div className="bg-zinc-800 p-3 rounded-xl text-xs text-zinc-300 mb-4 w-full break-words">
          <p className="text-amber-400 font-semibold mb-1">Your Seed Phrase (write it down!)</p>
          {mnemonic}
          <button onClick={onClearMnemonic} className="mt-2 text-orange-400 underline text-xs">I've saved it</button>
        </div>
      )}

      <div className="w-full space-y-3">
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full p-3 pr-10 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none"
          />
          <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-3 text-zinc-500">
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {mode === 'create' && (
          <input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Confirm password"
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none"
          />
        )}
        {mode === 'import' && (
          <textarea
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Private key or 12-word mnemonic"
            rows={3}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none resize-none"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : (mode === 'unlock' ? 'Unlock' : 'Continue')}
        </button>

        {!encryptedKey && (
          <div className="flex justify-between text-xs text-zinc-400 mt-2">
            {mode !== 'create' && <button onClick={() => setMode('create')}>Create new</button>}
            {mode !== 'import' && <button onClick={() => setMode('import')}>Import</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeScreen({ setTab, openModal, toast }) {
  const {
    wallet, balances, loadingBal, chain, selectedChain, setSelectedChain,
    stakedBalance, burnedAmount, totalUsd
  } = useWallet();

  const [stakeExpanded, setStakeExpanded] = useState(false);

  const tokens = Object.entries(balances).map(([sym, info]) => ({
    symbol: sym,
    balance: ethers.utils.formatUnits(info.balance, info.decimals || 18),
    usdValue: 0,    // placeholder until a price feed is integrated
    change: 0,
  }));

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
            <Wallet size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="text-zinc-100 text-xs font-semibold leading-none">OS Wallet</div>
            <div className="text-zinc-500 text-[10px] leading-none mt-1">
              {chain.name} · {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            </div>
          </div>
        </div>
        <select
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 border border-zinc-700 outline-none"
        >
          {Object.keys(CHAINS).map(c => (
            <option key={c} value={c}>{CHAINS[c].name}</option>
          ))}
        </select>
      </div>

      <div className="px-5 pt-6 pb-2">
        <div className="font-mono text-4xl text-zinc-50 font-medium tracking-tight">
          ${totalUsd.toFixed(2)}
        </div>
        <div className="flex items-center gap-1 mt-2 text-zinc-500 text-xs">
          <TrendingUp size={12} /> <span>--% today</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 px-5 py-6">
        <ActionButton icon={Send} label="Send" onClick={() => setTab("send")} />
        <ActionButton icon={ArrowDownLeft} label="Receive" onClick={() => setTab("receive")} />
        <ActionButton icon={Repeat} label="Swap" onClick={() => openModal('swap')} />
        <ActionButton icon={Wallet} label="Buy" onClick={() => openModal('buy')} />
      </div>

      {/* Staking / Burn card */}
      <div
        onClick={() => setStakeExpanded(!stakeExpanded)}
        className="mx-5 mb-5 rounded-xl border border-[var(--glass-border)] bg-gradient-to-r from-zinc-800/50 to-zinc-900 px-4 py-3 flex items-center gap-3 cursor-pointer"
      >
        <Flame size={18} style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <div className="text-zinc-300 text-xs">Staked CLOSE</div>
          <div className="text-zinc-200 font-mono text-sm">{stakedBalance} CLOSE</div>
        </div>
        <ChevronDown size={14} className={`transition-transform ${stakeExpanded ? 'rotate-180' : ''}`} />
      </div>
      {stakeExpanded && (
        <div className="mx-5 mb-5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl px-4 py-3 space-y-2">
          <div className="flex justify-between text-xs"><span className="text-zinc-400">Staked</span><span className="text-zinc-200 font-mono">{stakedBalance} CLOSE</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-400">In use</span><span className="text-zinc-200 font-mono">0 CLOSE</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-400">Burned</span><span className="text-zinc-200 font-mono">{burnedAmount} CLOSE</span></div>
          <button
            onClick={(e) => { e.stopPropagation(); openModal('buy'); }}
            className="w-full py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-semibold hover:opacity-90"
          >
            Buy CLOSE
          </button>
        </div>
      )}

      {/* Token list */}
      <div className="px-5">
        <div className="text-zinc-500 text-xs font-medium mb-3">Assets</div>
        {loadingBal ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
        ) : tokens.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">No tokens found</p>
        ) : (
          <div className="space-y-1">
            {tokens.map((t) => (
              <div key={t.symbol} className="flex items-center justify-between py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300">
                    {t.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-zinc-100 text-sm font-medium">{t.symbol}</div>
                    <div className="text-zinc-500 text-xs">{t.balance} {t.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-100 text-sm font-mono">${t.usdValue.toFixed(2)}</div>
                  <div className="text-xs text-zinc-600">--%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendScreen({ setTab, toast }) {
  const { handleSend, chain } = useWallet();
  const [step, setStep] = useState('form');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState(chain.symbol);
  const [sending, setSending] = useState(false);   // new: prevents double‑send

  const proceed = async () => {
    if (step === 'form') {
      if (!recipient || !amount) return;
      // Validate address
      if (!ethers.utils.isAddress(recipient)) {
        toast('Invalid recipient address');
        return;
      }
      setStep('review');
    } else {
      setSending(true);
      try {
        await handleSend(recipient, amount, selectedToken);
        setStep('success');
      } catch (e) {
        // error handled in context
      } finally {
        setSending(false);
      }
    }
  };

  if (step === 'success') {
    return (
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mb-5">
          <Check size={28} className="text-emerald-400" />
        </div>
        <div className="text-zinc-100 text-lg font-semibold mb-1">Transaction sent</div>
        <button
          onClick={() => { setStep('form'); setTab('home'); }}
          className="w-full bg-zinc-100 text-zinc-950 font-semibold text-sm py-3 rounded-xl"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader
        title={step === 'form' ? 'Send' : 'Review'}
        onBack={() => step === 'form' ? setTab('home') : setStep('form')}
      />
      <div className="px-5 pt-2">
        {step === 'form' ? (
          <>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient address"
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm mb-3"
            />
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm mb-3"
            >
              {Object.keys(chain.tokens).map(tok => (
                <option key={tok} value={tok}>{tok}</option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm"
            />
          </>
        ) : (
          <div className="text-center mb-4">
            <div className="text-2xl font-mono text-zinc-50">{amount} {selectedToken}</div>
            <div className="text-zinc-500 text-sm">to {recipient.slice(0, 8)}…</div>
          </div>
        )}
        <button
          onClick={proceed}
          disabled={!recipient || !amount || sending}
          className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-semibold mt-4 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : (step === 'form' ? 'Review' : 'Confirm & Send')}
        </button>
      </div>
    </div>
  );
}

function ReceiveScreen({ setTab }) {
  const { wallet, chain } = useWallet();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    if (wallet && qrRef.current) {
      QRCode.toCanvas(qrRef.current, wallet.address, { width: 140 });
    }
  }, [wallet]);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <ScreenHeader title="Receive" onBack={() => setTab("home")} />
      <div className="px-5 pt-4 flex flex-col items-center">
        <canvas ref={qrRef} className="mb-4" />
        <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between mb-3">
          <span className="text-zinc-200 font-mono text-xs truncate mr-2">{wallet.address}</span>
          <button onClick={handleCopy} className="text-zinc-400 shrink-0">
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-amber-200/80 text-xs bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
          Only send {chain.name} assets to this address.
        </p>
      </div>
    </div>
  );
}

function ActivityScreen() {
  const { txs, loadingTxs, chain, wallet } = useWallet();
  return (
    <div>
      <ScreenHeader title="Activity" />
      <div className="px-5 pt-2">
        {loadingTxs ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
        ) : txs.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No transactions found</p>
        ) : (
          <div className="space-y-1">
            {txs.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.from.toLowerCase() === wallet.address.toLowerCase() ? 'bg-orange-950/60' : 'bg-emerald-950/60'
                    }`}
                  >
                    {tx.from.toLowerCase() === wallet.address.toLowerCase() ? (
                      <Send size={14} className="text-orange-400" />
                    ) : (
                      <ArrowDownLeft size={14} className="text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-zinc-100 text-sm font-medium capitalize">
                      {tx.from.toLowerCase() === wallet.address.toLowerCase() ? 'Sent' : 'Received'}
                    </div>
                    <div className="text-zinc-500 text-xs">{tx.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-mono ${
                      tx.from.toLowerCase() === wallet.address.toLowerCase() ? 'text-zinc-200' : 'text-emerald-400'
                    }`}
                  >
                    {tx.from.toLowerCase() === wallet.address.toLowerCase() ? '-' : '+'}
                    {parseFloat(tx.value).toFixed(4)} {tx.token}
                  </div>
                  <a
                    href={`${chain.explorer}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-600 text-xs flex items-center justify-end gap-1"
                  >
                    <ExternalLink size={10} /> Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StakingScreen() {
  const { stakedBalance, stakeClose, unstakeClose } = useWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStake = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      await stakeClose(amount);
    } catch (e) {
      // toast handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    setLoading(true);
    try {
      await unstakeClose();
    } catch (e) {
      // toast handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Stake CLOSE" />
      <div className="px-5 pt-4">
        <div className="bg-zinc-800 rounded-xl p-4 mb-4">
          <div className="text-zinc-400 text-xs">Staked Balance</div>
          <div className="text-2xl font-mono text-zinc-100">{stakedBalance} CLOSE</div>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount to stake"
          className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 outline-none text-sm mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={handleStake}
            disabled={!amount || loading}
            className="flex-1 py-3 bg-[var(--accent)] text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Stake
          </button>
          <button
            onClick={handleUnstake}
            disabled={loading}
            className="flex-1 py-3 border border-zinc-700 text-zinc-200 rounded-xl font-semibold"
          >
            Unstake All
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main WalletPage Export ----------
export default function WalletPage({ openModal, toast }) {
  const {
    wallet, encryptedKey, createWallet, importWallet, unlockWallet,
    mnemonic, clearMnemonic
  } = useWallet();
  const [tab, setTab] = useState('home');
  // Removed unused sendStep state

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-zinc-900/70 backdrop-blur-xl border border-zinc-700/30 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="h-8 bg-transparent" />
        <div className="h-[680px] overflow-y-auto pb-24 relative">
          {!wallet ? (
            <UnlockScreen
              encryptedKey={encryptedKey}
              onCreate={createWallet}
              onImport={importWallet}
              onUnlock={unlockWallet}
              mnemonic={mnemonic}
              onClearMnemonic={clearMnemonic}
              toast={toast}
            />
          ) : (
            <>
              {tab === 'home' && <HomeScreen setTab={setTab} openModal={openModal} toast={toast} />}
              {tab === 'send' && <SendScreen setTab={setTab} toast={toast} />}
              {tab === 'receive' && <ReceiveScreen setTab={setTab} />}
              {tab === 'activity' && <ActivityScreen />}
              {import.meta.env.VITE_STAKING_CONTRACT_ADDRESS && tab === 'staking' && <StakingScreen />}
            </>
          )}
        </div>

        {/* Bottom Tab Bar */}
        {wallet && (
          <div className="absolute bottom-0 left-0 right-0 max-w-sm mx-auto bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-700/30 px-6 py-3 flex justify-between">
            <TabButton icon={Wallet} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
            <TabButton icon={Send} label="Send" active={tab === 'send'} onClick={() => setTab('send')} />
            <TabButton icon={ArrowDownLeft} label="Receive" active={tab === 'receive'} onClick={() => setTab('receive')} />
            <TabButton icon={Clock} label="Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
            {import.meta.env.VITE_STAKING_CONTRACT_ADDRESS && (
              <TabButton icon={Repeat} label="Stake" active={tab === 'staking'} onClick={() => setTab('staking')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}