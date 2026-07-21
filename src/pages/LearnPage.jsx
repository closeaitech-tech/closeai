import React from 'react';
import { BookOpen } from 'lucide-react';

const SECTIONS = [
  {
    title: 'What is OS AI?',
    content: 'OS AI is the Operating System for Intelligence — a next‑generation AI platform powered by the CLOSE token. Built by Osinachi Chukwu, OS AI combines a ChatGPT‑class conversational assistant with a non‑custodial multi‑chain wallet, making it the most complete AI ecosystem in the world.'
  },
  {
    title: 'What is CLOSE?',
    content: 'CLOSE is the native utility token of OS AI. Every AI interaction burns CLOSE tokens, permanently reducing supply and increasing scarcity. CLOSE is built on the Polygon blockchain for fast, low‑cost transactions.'
  },
  {
    title: 'How to use CLOSE for AI chat',
    content: 'Each message you send to OS AI burns 25 CLOSE tokens. This deflationary mechanism means the more OS AI is used, the more valuable CLOSE becomes. Simply hold CLOSE in your OS Wallet and start chatting.'
  },
  {
    title: 'How to buy CLOSE',
    content: 'Send POL (or any supported asset) to the hot wallet address displayed in the "Buy CLOSE" modal under OS Wallet. Paste the transaction hash, and your CLOSE will be credited automatically. Minimum purchase: $1.00.'
  },
  {
    title: 'How to trade CLOSE on Polygon',
    content: 'You can trade CLOSE on any decentralized exchange (DEX) that supports Polygon, such as QuickSwap. Use the Swap feature in your OS Wallet to exchange CLOSE for other tokens directly without leaving the app.'
  },
  {
    title: 'How to stake CLOSE',
    content: 'Staking CLOSE earns you rewards and unlocks higher tiers within the OS AI ecosystem. The tiers are: Builder (4M CLOSE), Pro (15M CLOSE), and Enterprise (35M CLOSE). Stake from the OS Wallet to start earning.'
  },
  {
    title: 'OS Wallet — Your Sovereign Wallet',
    content: 'The OS Wallet is a non‑custodial, multi‑chain wallet. You hold your private keys — no one else can access your funds. The wallet supports Polygon, Ethereum, BSC, Arbitrum, and Base. Send, receive, and manage all your assets in one place.'
  },
  {
    title: 'Transaction from Chat',
    content: 'You can execute transactions directly from the chat interface. Simply type "send 50 CLOSE to 0x..." and OS AI will present a confirmation card. Confirm the transaction, and it will be signed and broadcast from your wallet.'
  },
];

export default function LearnPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen size={28} className="text-[var(--accent)]" />
        <h1 className="text-2xl font-heading font-bold">Learn about OS AI</h1>
      </div>
      <div className="space-y-4">
        {SECTIONS.map((s, i) => (
          <div
            key={i}
            className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-5 backdrop-blur-xl hover:border-[var(--accent)] transition-all duration-200"
          >
            <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">
              {s.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {s.content}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 p-5 bg-gradient-to-r from-[var(--accent)] to-violet-500 rounded-2xl text-white text-center">
        <p className="text-lg font-heading font-bold mb-2">Ready to start?</p>
        <p className="text-sm opacity-90">Open the OS Wallet, get CLOSE, and experience the future of AI.</p>
      </div>
    </div>
  );
}