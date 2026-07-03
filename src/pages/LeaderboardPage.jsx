import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Trophy, Loader2 } from 'lucide-react';

export default function LeaderboardPage() {
  const [type, setType] = useState('staked');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiCall(`/api/leaderboard?type=${type}`)
      .then(res => setData(res.leaderboard))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="max-w-2xl mx-auto p-4 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
      <div className="flex gap-2 mb-4">
        {['staked','burned','streak'].map(t => (
          <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${type===t ? 'bg-[var(--accent)] text-white' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? <Loader2 className="animate-spin mx-auto" /> : data.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center font-bold">{idx < 3 ? ['🥇','🥈','🥉'][idx] : idx+1}</span>
              <div>
                <div className="text-sm font-medium">{entry.name || entry.email?.split('@')[0]}</div>
                {entry.email && <div className="text-xs text-[var(--text-tertiary)]">{entry.email}</div>}
              </div>
            </div>
            <span className="font-mono text-sm text-[var(--accent)]">{entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}