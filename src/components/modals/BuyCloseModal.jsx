import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { apiCall } from '../../utils/api';
import { Copy, Check, Loader2 } from 'lucide-react';

export default function BuyCloseModal({ onClose, toast }) {
  const [usdAmount, setUsdAmount] = useState('1');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleBuy = async () => {
    const amount = parseFloat(usdAmount);
    if (isNaN(amount) || amount < 1) {
      toast('Minimum purchase is $1');
      return;
    }

    const trimmedHash = txHash.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(trimmedHash)) {
      toast('That doesn’t look like a valid transaction hash');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall('/api/wallet/purchase', {
        method: 'POST',
        body: JSON.stringify({ usd_amount: amount, tx_hash: trimmedHash }),
        signal: AbortSignal.timeout(60000),   // 60‑second timeout – avoids infinite spinner
      });
      if (res.verified) {
        toast('CLOSE purchased successfully!');
        onClose();
      } else {
        // 'verified: false' can mean several things; your API could return a reason in the future.
        toast('Payment not verified. Double‑check the TX hash and try again.');
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        toast('Verification timed out – the transaction may still be processing. Please check later.');
      } else {
        toast('Purchase failed: ' + (e.message || 'Unknown error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText('0x109464E84bDD6552d76bcBbaEf03bDe8069C0698');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Address copied');
  };

  return (
    <ModalWrapper title="Buy CLOSE" onClose={onClose}>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Send your payment to the Hot Wallet address below, then paste the transaction hash.
      </p>
      {/* Hot wallet address with copy button */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-3 mb-4 break-all text-xs font-mono text-[var(--text-primary)] flex items-center justify-between gap-2">
        <span>0x109464E84bDD6552d76bcBbaEf03bDe8069C0698</span>
        <button
          onClick={handleCopyAddress}
          className="text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0"
          title="Copy address"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>

      <div className="space-y-3">
        <input
          id="buy-usd"
          name="usd_amount"
          type="number"
          min="1"
          value={usdAmount}
          onChange={(e) => setUsdAmount(e.target.value)}   // no mid‑typing correction
          placeholder="USD amount (min $1)"
          className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <input
          id="buy-txhash"
          name="tx_hash"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="Transaction hash (0x...)"
          className="w-full p-3 border border-[var(--glass-border)] rounded-2xl bg-[var(--input-bg)] text-[var(--text-primary)] outline-none font-mono text-xs placeholder:text-[var(--text-tertiary)]"
        />
        <button
          onClick={handleBuy}
          disabled={submitting}
          className="w-full py-3 bg-gradient-to-r from-[#f0b90b] to-[#d4a30a] text-black rounded-3xl font-semibold hover:opacity-90 disabled:opacity-60 transition flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? 'Verifying…' : 'Verify & Buy'}
        </button>
      </div>
    </ModalWrapper>
  );
}