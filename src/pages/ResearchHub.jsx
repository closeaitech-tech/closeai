import React, { useState } from 'react';
import { apiCall } from '../utils/api';
import { Search, Loader2 } from 'lucide-react';

export default function ResearchHub({ toast }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await apiCall('/api/wallet/research', { method: 'POST', body: JSON.stringify({ query }) });
      setResult(res);
    } catch (e) { toast('Research failed: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 h-full flex flex-col">
      <h1 className="text-2xl font-heading font-bold mb-6">Research Hub</h1>
      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask market research..."
          className="flex-1 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] outline-none text-sm"
          onKeyDown={e => e.key === 'Enter' && handleResearch()}
        />
        <button onClick={handleResearch} disabled={loading} className="p-3 bg-gradient-to-r from-[var(--accent)] to-violet-500 text-white rounded-xl">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
        </button>
      </div>
      {result && (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-4 overflow-y-auto flex-1">
          <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: result.analysis?.replace(/\n/g, '<br>') }} />
        </div>
      )}
    </div>
  );
}
