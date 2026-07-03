import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { apiCall } from '../utils/api';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const CHAINS = {
  polygon: { /* same as earlier, with RPCs from env */ },
  ethereum: { /* ... */ },
  bsc: { /* ... */ },
  arbitrum: { /* ... */ },
  base: { /* ... */ }
};

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function transfer(address,uint256) returns (bool)"];

async function encryptPrivateKey(privateKey, password) { /* same as before */ }
async function decryptPrivateKey(encrypted, password) { /* same as before */ }

export const WalletProvider = ({ children }) => {
  const [encryptedKey, setEncryptedKey] = useState(() => JSON.parse(localStorage.getItem('capitan_encrypted_key') || 'null'));
  const [wallet, setWallet] = useState(null);
  const [password, setPassword] = useState('');
  const [selectedChain, setSelectedChain] = useState('polygon');
  const [balances, setBalances] = useState({});
  const [txs, setTxs] = useState([]);
  const [stakedBalance, setStakedBalance] = useState('0');
  const [burnedAmount, setBurnedAmount] = useState('0');
  const [loadingBal, setLoadingBal] = useState(false);
  const chain = CHAINS[selectedChain];

  const createWallet = useCallback(async (pwd) => { /* same as earlier */ }, []);
  const importWallet = useCallback(async (pwd, keyOrMnemonic) => { /* same */ }, []);
  const unlockWallet = useCallback(async (pwd) => { /* same */ }, [encryptedKey]);
  const lockWallet = () => { setWallet(null); setPassword(''); };

  const fetchBalances = useCallback(async () => { /* same as before */ }, [wallet, chain]);
  const fetchTransactions = useCallback(async () => { /* same */ }, [wallet, chain]);
  const handleSend = useCallback(async (to, amount, tokenSymbol) => { /* same */ }, [wallet, chain]);

  // Staking actions
  const stakeClose = async (amount) => { /* contract call */ };
  const unstakeClose = async () => { /* contract call */ };

  // Fetch burned amount for current user
  const fetchBurnedAmount = async () => {
    if (!wallet) return;
    // call contract or API; setBurnedAmount(...)
  };

  useEffect(() => {
    if (wallet) {
      fetchBalances();
      fetchTransactions();
      fetchBurnedAmount();
    }
  }, [wallet, selectedChain]);

  return (
    <WalletContext.Provider value={{
      encryptedKey, wallet, password, setPassword,
      selectedChain, setSelectedChain, chain,
      balances, txs, stakedBalance, burnedAmount,
      loadingBal, createWallet, importWallet, unlockWallet, lockWallet,
      handleSend, stakeClose, unstakeClose, fetchBalances
    }}>
      {children}
    </WalletContext.Provider>
  );
};