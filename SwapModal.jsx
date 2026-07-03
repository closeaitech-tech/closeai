import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useWallet } from '../../context/WalletContext';
import { ethers } from 'ethers';

export default function SwapModal({ onClose, toast }) {
  const { wallet, chain, selectedChain } = useWallet();
  const [fromToken, setFromToken] = useState(chain?.symbol || 'POL');
  const [toToken, setToToken] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchQuote = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      const fromAddress = chain.tokens[fromToken]?.address;
      const toAddress = chain.tokens[toToken]?.address;
      const apiUrl = `https://api.1inch.dev/swap/v5.2/${chain.chainId}/swap?fromTokenAddress=${fromAddress}&toTokenAddress=${toAddress}&amount=${ethers.utils.parseUnits(amount, chain.tokens[fromToken].decimals).toString()}&fromAddress=${wallet.address}&slippage=1`;
      const res = await fetch(apiUrl, { headers: { 'Authorization': 'Bearer YOUR_1INCH_API_KEY' } });
      const data = await res.json();
      setQuote(data);
    } catch (e) { toast('Quote failed'); }
    setLoading(false);
  };

  const executeSwap = async () => {
    if (!quote) return;
    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const signer = wallet.connect(provider);
      const tx = await signer.sendTransaction({
        to: quote.tx.to,
        data: quote.tx.data,
        value: quote.tx.value,
        gasLimit: quote.tx.gas,
      });
      await tx.wait();
      toast('Swap successful!');
      onClose();
    } catch (e) { toast('Swap failed'); }
  };

  return (
    <ModalWrapper title="Swap Tokens" onClose={onClose}>
      <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="...">
        {Object.keys(chain.tokens).map(tok => <option key={tok}>{tok}</option>)}
      </select>
      <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
        {Object.keys(chain.tokens).filter(t => t !== fromToken).map(tok => <option key={tok}>{tok}</option>)}
      </select>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
      <button onClick={fetchQuote} disabled={loading} className="w-full py-3 bg-[var(--accent)] text-white rounded-3xl ...">Get Quote</button>
      {quote && (
        <div className="bg-[var(--bg-secondary)] p-3 rounded-xl text-sm">
          <div>1 {fromToken} ≈ {ethers.utils.formatUnits(quote.toTokenAmount, chain.tokens[toToken].decimals)} {toToken}</div>
          <button onClick={executeSwap} className="mt-2 w-full py-2 bg-[var(--accent)] text-white rounded-xl">Swap</button>
        </div>
      )}
    </ModalWrapper>
  );
}