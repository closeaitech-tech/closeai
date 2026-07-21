import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { apiCall } from '../utils/api';
import { useAuth } from './AuthContext';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const CLOSE_PRICE = 0.00009776;

// ─── Encryption ─────────────────────────────────
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

// ─── ERC20 ABI ─────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
];

// ─── Chains ─────────────────────────────────────
const CHAINS = {
  polygon: {
    name: 'Polygon',
    symbol: 'POL',
    rpc: import.meta.env.VITE_ALCHEMY_POLYGON || 'https://polygon-rpc.com',
    chainId: 137,
    explorer: 'https://polygonscan.com',
    tokens: {
      POL: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ETHEREUM || 'https://eth.llamarpc.com',
    chainId: 1,
    explorer: 'https://etherscan.io',
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  bsc: {
    name: 'BSC',
    symbol: 'BNB',
    rpc: import.meta.env.VITE_ALCHEMY_BSC || 'https://bsc-dataseed.binance.org',
    chainId: 56,
    explorer: 'https://bscscan.com',
    tokens: {
      BNB: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  arbitrum: {
    name: 'Arbitrum',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    explorer: 'https://arbiscan.io',
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  },
  base: {
    name: 'Base',
    symbol: 'ETH',
    rpc: import.meta.env.VITE_ALCHEMY_BASE || 'https://mainnet.base.org',
    chainId: 8453,
    explorer: 'https://basescan.org',
    tokens: {
      ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, isNative: true },
      USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      CLOSE: { address: '0x3c6833cFDdED80fE76474a3Cb2Cc050Daec91fe8', decimals: 18 }
    }
  }
};

export const WalletProvider = ({ children }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [encryptedKey, setEncryptedKey] = useState(() => {
    try { return JSON.parse(localStorage.getItem('capitan_encrypted_key')); } catch { return null; }
  });
  const [password, setPassword] = useState('');
  const [selectedChain, setSelectedChain] = useState('polygon');
  const [balances, setBalances] = useState({});
  const [txs, setTxs] = useState([]);
  const [stakedBalance, setStakedBalance] = useState('0');
  const [burnedAmount, setBurnedAmount] = useState('0');
  const [loadingBal, setLoadingBal] = useState(false);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [mnemonic, setMnemonic] = useState(null);
  const [stakeTier, setStakeTier] = useState('none');
  const [totalUsd, setTotalUsd] = useState(0);
  const [unlockError, setUnlockError] = useState('');

  const clearUnlockError = () => setUnlockError('');
  const chain = CHAINS[selectedChain] || CHAINS.polygon;

  const createWallet = useCallback(async (pwd) => {
    const newWallet = ethers.Wallet.createRandom();
    const enc = await encryptPrivateKey(newWallet.privateKey, pwd);
    localStorage.setItem('capitan_encrypted_key', JSON.stringify(enc));
    setEncryptedKey(enc);
    setWallet(newWallet);
    setPassword(pwd);
    setMnemonic(newWallet.mnemonic.phrase);
    return { wallet: newWallet, mnemonic: newWallet.mnemonic.phrase };
  }, []);

  const importWallet = useCallback(async (pwd, keyOrMnemonic) => {
    let imported;
    if (keyOrMnemonic.trim().split(' ').length > 1) {
      imported = ethers.Wallet.fromMnemonic(keyOrMnemonic);
    } else {
      imported = new ethers.Wallet(keyOrMnemonic);
    }
    const enc = await encryptPrivateKey(imported.privateKey, pwd);
    localStorage.setItem('capitan_encrypted_key', JSON.stringify(enc));
    setEncryptedKey(enc);
    setWallet(imported);
    setPassword(pwd);
    setMnemonic(null);
    return imported;
  }, []);

  const unlockWallet = useCallback(async (pwd) => {
    clearUnlockError();
    if (!encryptedKey) {
      setUnlockError('No wallet found. Create or import one first.');
      throw new Error('No wallet found');
    }
    try {
      const privateKey = await decryptPrivateKey(encryptedKey, pwd);
      const w = new ethers.Wallet(privateKey);
      setWallet(w);
      setPassword(pwd);
      return w;
    } catch (e) {
      setUnlockError('Incorrect password. Please try again.');
      throw new Error('Incorrect password');
    }
  }, [encryptedKey]);

  const lockWallet = useCallback(() => {
    setWallet(null);
    setPassword('');
    setMnemonic(null);
    setUnlockError('');
  }, []);

  const clearMnemonic = () => setMnemonic(null);

  const fetchBalances = useCallback(async () => {
    if (!user || !wallet) return;
    setLoadingBal(true);
    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const address = wallet.address;
      const newBalances = {};
      const nativeSymbol = chain.symbol;
      const nativeBalance = await provider.getBalance(address);
      newBalances[nativeSymbol] = {
        balance: nativeBalance,
        symbol: nativeSymbol,
        decimals: 18,
        usdValue: 0,
      };
      const tokenPromises = Object.entries(chain.tokens).map(async ([symbol, info]) => {
        if (info.isNative) return;
        try {
          const contract = new ethers.Contract(info.address, ERC20_ABI, provider);
          const [bal, dec] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals().catch(() => info.decimals),
          ]);
          newBalances[symbol] = { balance: bal, symbol, decimals: dec || 18, usdValue: 0 };
        } catch (e) { console.warn(`Failed to fetch ${symbol}`, e); }
      });
      await Promise.all(tokenPromises);
      setBalances(newBalances);
      setTotalUsd(0);
    } catch (e) { console.error('Balance fetch error:', e); }
    finally { setLoadingBal(false); }
  }, [user, wallet, chain]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoadingTxs(true);
    try {
      const data = await apiCall('/api/wallet/transactions');
      setTxs(data.transactions || []);
    } catch (e) { console.error(e); }
    finally { setLoadingTxs(false); }
  }, [user]);

  const handleSend = useCallback(async (recipient, amount, tokenSymbol) => {
    if (!password) throw new Error('Unlock wallet first');
    if (!ethers.utils.isAddress(recipient)) throw new Error('Invalid address');
    if (!amount || parseFloat(amount) <= 0) throw new Error('Invalid amount');
    const res = await apiCall('/api/wallet/send', {
      method: 'POST',
      body: JSON.stringify({ to: recipient, amount, token: tokenSymbol, chain: selectedChain, password }),
    });
    await fetchBalances();
    await fetchTransactions();
    return res;
  }, [password, selectedChain, fetchBalances, fetchTransactions]);

  const stakeClose = async (amount) => {
    if (!password) throw new Error('Unlock wallet first');
    const res = await apiCall('/api/wallet/stake', { method: 'POST', body: JSON.stringify({ amount, password }) });
    await fetchBalances();
    return res;
  };

  const unstakeClose = async () => {
    if (!password) throw new Error('Unlock wallet first');
    const res = await apiCall('/api/wallet/unstake', { method: 'POST', body: JSON.stringify({ password }) });
    await fetchBalances();
    return res;
  };

  const purchaseClose = async (usdAmount, txHash) => {
    const res = await apiCall('/api/wallet/purchase', { method: 'POST', body: JSON.stringify({ usd_amount: usdAmount, tx_hash: txHash }) });
    await fetchBalances();
    return res;
  };

  useEffect(() => {
    if (user && wallet) { fetchBalances(); fetchTransactions(); }
  }, [user, wallet, fetchBalances, fetchTransactions]);

  const value = {
    wallet, encryptedKey, password, setPassword,
    selectedChain, setSelectedChain, chain,
    balances, txs, stakedBalance, burnedAmount,
    loadingBal, loadingTxs,
    mnemonic, clearMnemonic,
    createWallet, importWallet, unlockWallet, lockWallet,
    fetchBalances, fetchTransactions,
    handleSend, stakeClose, unstakeClose, purchaseClose,
    stakeTier, totalUsd, CLOSE_PRICE,
    unlockError, clearUnlockError,
    sessionPassword: password,
    setSessionPassword: setPassword,
    refreshBalance: fetchBalances,
    closeBalance: balances.CLOSE?.balance,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};