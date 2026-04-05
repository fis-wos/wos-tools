'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GachaResult {
  id: string;
  participant_name: string;
  participant_alliance: string;
  reward_name: string;
  reward_tier: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = 'fisfis';

const REWARD_POOL = [
  { name: '将軍表彰', tier: 'S', count: 1 },
  { name: '士官表彰', tier: 'A', count: 10 },
  { name: '兵士表彰', tier: 'B', count: 50 },
  { name: 'ハズレ', tier: 'X', count: 30 },
] as const;

const TOTAL_POOL = REWARD_POOL.reduce((s, r) => s + r.count, 0); // 91

const SLOT_ITEMS = ['将軍表彰', '士官表彰', '兵士表彰', 'ハズレ', '士官表彰', '兵士表彰', 'ハズレ', '兵士表彰'];

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  S: {
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-100',
    border: 'border-amber-400',
    text: 'text-amber-700',
    badge: 'bg-amber-200 text-amber-800 border border-amber-400',
  },
  A: {
    bg: 'bg-gradient-to-br from-gray-50 to-slate-100',
    border: 'border-gray-400',
    text: 'text-gray-600',
    badge: 'bg-gray-200 text-gray-700 border border-gray-400',
  },
  B: {
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-800 border border-orange-400',
  },
  X: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-500',
    badge: 'bg-gray-200 text-gray-500 border border-gray-300',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Confetti component (simple CSS-based)
// ---------------------------------------------------------------------------

function Confetti({ tier }: { tier: string }) {
  if (tier === 'X') return null;
  const colors = tier === 'S'
    ? ['#FFD700', '#FFA500', '#FF6347', '#FFD700', '#FFEC8B']
    : tier === 'A'
      ? ['#C0C0C0', '#A0A0A0', '#D4D4D4', '#B0B0B0', '#E0E0E0']
      : ['#CD7F32', '#D4A574', '#C49A6C', '#B8860B', '#DAA520'];

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 2;
        const size = 6 + Math.random() * 8;
        const color = colors[i % colors.length];
        const rotation = Math.random() * 360;
        return (
          <div
            key={i}
            className="absolute animate-confetti-fall"
            style={{
              left: `${left}%`,
              top: '-10px',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotation}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot Machine Component
// ---------------------------------------------------------------------------

function SlotMachine({
  resultName,
  phase,
}: {
  resultName: string | null;
  phase: 'idle' | 'spinning' | 'slowing' | 'done';
}) {
  return (
    <div className="relative mx-auto w-64 overflow-hidden rounded-2xl border-4 border-amber-400 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl">
      {/* Decorative top */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-1 text-center text-xs font-black text-white tracking-widest">
        GACHA
      </div>

      {/* Slot window */}
      <div className="relative h-28 overflow-hidden bg-white/10">
        {/* Gradient overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-slate-900 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-900 to-transparent" />

        {/* Center line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2">
          <div className="mx-2 h-10 rounded-lg border-2 border-amber-400/60" />
        </div>

        {/* Scrolling items */}
        <div
          className={`flex flex-col items-center justify-center transition-none ${
            phase === 'spinning' ? 'animate-slot-spin' :
            phase === 'slowing' ? 'animate-slot-slow' :
            ''
          }`}
          style={phase === 'done' || phase === 'idle' ? { transform: 'translateY(0)' } : undefined}
        >
          {phase === 'done' || phase === 'idle' ? (
            <div className="flex h-28 items-center justify-center">
              <span className={`text-2xl font-black ${
                resultName ? (
                  resultName === 'ハズレ' ? 'text-gray-400' :
                  resultName === '将軍表彰' ? 'text-amber-400' :
                  resultName === '士官表彰' ? 'text-gray-300' :
                  'text-orange-300'
                ) : 'text-white/30'
              }`}>
                {resultName || '???'}
              </span>
            </div>
          ) : (
            <>
              {[...SLOT_ITEMS, ...SLOT_ITEMS, ...SLOT_ITEMS].map((item, i) => (
                <div key={i} className="flex h-10 items-center justify-center">
                  <span className="text-lg font-bold text-white/80">{item}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Bottom decorative */}
      <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-1" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Reveal Component
// ---------------------------------------------------------------------------

function ResultReveal({ tier, rewardName }: { tier: string; rewardName: string }) {
  const style = TIER_STYLES[tier] || TIER_STYLES.X;

  if (tier === 'X') {
    return (
      <div className="mt-6 rounded-2xl border-2 border-gray-300 bg-gray-100 p-8 text-center shadow-lg">
        <div className="mb-2 text-4xl">😢</div>
        <div className="text-2xl font-black text-gray-500">残念...</div>
        <div className="mt-2 text-sm text-gray-400">次回に期待！</div>
      </div>
    );
  }

  if (tier === 'S') {
    return (
      <div className="mt-6 rounded-2xl border-4 border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-100 to-amber-50 p-8 text-center shadow-2xl ring-4 ring-amber-200/50">
        <div className="mb-2 text-4xl">✨</div>
        <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
          おめでとう！
        </div>
        <div className="mt-3 inline-block rounded-full bg-amber-200 px-6 py-2 text-lg font-black text-amber-800 shadow-inner">
          {rewardName}
        </div>
        <div className="mt-2 text-4xl">✨</div>
      </div>
    );
  }

  if (tier === 'A') {
    return (
      <div className="mt-6 rounded-2xl border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-slate-100 p-8 text-center shadow-xl ring-2 ring-gray-300/50">
        <div className="mb-2 text-3xl">🎉</div>
        <div className="text-2xl font-black text-gray-600">当選！</div>
        <div className="mt-3 inline-block rounded-full bg-gray-200 px-5 py-2 text-base font-bold text-gray-700 shadow-inner">
          {rewardName}
        </div>
      </div>
    );
  }

  // B tier
  return (
    <div className="mt-6 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center shadow-lg">
      <div className="mb-2 text-2xl">🎊</div>
      <div className="text-xl font-black text-orange-700">当選！</div>
      <div className="mt-3 inline-block rounded-full bg-orange-100 px-5 py-2 text-base font-bold text-orange-800 shadow-inner">
        {rewardName}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LotteryPage() {
  // --- State ---
  const [hydrated, setHydrated] = useState(false);
  const [results, setResults] = useState<GachaResult[]>([]);

  // Application form
  const [charName, setCharName] = useState('');
  const [allianceName, setAllianceName] = useState('');

  // Gacha state
  const [gachaPhase, setGachaPhase] = useState<'idle' | 'spinning' | 'slowing' | 'done'>('idle');
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already participated check
  const [myResult, setMyResult] = useState<GachaResult | null>(null);

  // Admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Pool status
  const [poolStatus, setPoolStatus] = useState<Record<string, number>>({});

  // --- Hydrate ---
  useEffect(() => {
    async function init() {
      try {
        // Fetch all results
        const { data, error } = await supabase
          .from('svs_results')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data) {
          setResults(data as GachaResult[]);
          // Calculate pool status
          const drawn: Record<string, number> = {};
          for (const r of data as GachaResult[]) {
            drawn[r.reward_tier] = (drawn[r.reward_tier] || 0) + 1;
          }
          setPoolStatus(drawn);
        }
      } catch {
        // Silently fail
      }
      setHydrated(true);
    }
    init();
  }, []);

  // Check from localStorage if user already participated
  useEffect(() => {
    if (!hydrated) return;
    const saved = localStorage.getItem('wos-lottery-my-result');
    if (saved) {
      try {
        setMyResult(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [hydrated]);

  // --- Pool calculation ---
  const remainingPool = useMemo(() => {
    return REWARD_POOL.map((r) => ({
      ...r,
      remaining: r.count - (poolStatus[r.tier] || 0),
    })).filter((r) => r.remaining > 0);
  }, [poolStatus]);

  const totalRemaining = useMemo(() => {
    return remainingPool.reduce((s, r) => s + r.remaining, 0);
  }, [remainingPool]);

  // --- Winners list (exclude ハズレ) ---
  const winners = useMemo(() => {
    return results.filter((r) => r.reward_tier !== 'X');
  }, [results]);

  // --- Draw function ---
  const handleDraw = useCallback(async () => {
    const name = charName.trim();
    const alliance = allianceName.trim();
    if (!name || !alliance) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Check if already participated (by name + alliance)
      const { data: existing } = await supabase
        .from('svs_results')
        .select('*')
        .eq('participant_name', name)
        .eq('participant_alliance', alliance)
        .limit(1);

      if (existing && existing.length > 0) {
        const prev = existing[0] as GachaResult;
        setMyResult(prev);
        localStorage.setItem('wos-lottery-my-result', JSON.stringify(prev));
        setErrorMsg('既に参加済みです。結果は下に表示されています。');
        setIsSubmitting(false);
        return;
      }

      // Check pool
      if (totalRemaining <= 0) {
        setErrorMsg('全ての抽選が終了しました。');
        setIsSubmitting(false);
        return;
      }

      // Fetch latest results to get accurate pool
      const { data: latestResults } = await supabase
        .from('svs_results')
        .select('reward_tier')
        .order('created_at', { ascending: true });

      const freshDrawn: Record<string, number> = {};
      if (latestResults) {
        for (const r of latestResults) {
          const tier = (r as { reward_tier: string }).reward_tier;
          freshDrawn[tier] = (freshDrawn[tier] || 0) + 1;
        }
      }

      const freshPool = REWARD_POOL.map((r) => ({
        ...r,
        remaining: r.count - (freshDrawn[r.tier] || 0),
      })).filter((r) => r.remaining > 0);

      const freshTotal = freshPool.reduce((s, r) => s + r.remaining, 0);

      if (freshTotal <= 0) {
        setErrorMsg('全ての抽選が終了しました。');
        setIsSubmitting(false);
        return;
      }

      // Random draw from pool
      let pick = Math.floor(Math.random() * freshTotal);
      let chosen = freshPool[0];
      for (const item of freshPool) {
        if (pick < item.remaining) {
          chosen = item;
          break;
        }
        pick -= item.remaining;
      }

      // Start animation
      setGachaPhase('spinning');
      setGachaResult(null);
      setShowConfetti(false);

      // Save participant
      const { data: participantData, error: participantError } = await supabase
        .from('svs_participants')
        .insert({ name, alliance })
        .select()
        .single();

      if (participantError) {
        console.error('Failed to save participant:', participantError);
      }

      const participantId = participantData?.id || null;

      // Save result
      const resultRow = {
        participant_id: participantId,
        reward_id: null,
        participant_name: name,
        participant_alliance: alliance,
        reward_name: chosen.name,
        reward_tier: chosen.tier,
        seed: '',
        probability: chosen.remaining / freshTotal,
      };

      const { data: savedResult, error: saveError } = await supabase
        .from('svs_results')
        .insert(resultRow)
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save result:', saveError);
        setErrorMsg('保存に失敗しました。もう一度お試しください。');
        setGachaPhase('idle');
        setIsSubmitting(false);
        return;
      }

      const gResult = savedResult as GachaResult;

      // Animation sequence
      setTimeout(() => {
        setGachaPhase('slowing');
      }, 2000);

      setTimeout(() => {
        setGachaPhase('done');
        setGachaResult(gResult);
        setMyResult(gResult);
        localStorage.setItem('wos-lottery-my-result', JSON.stringify(gResult));

        // Update local results
        setResults((prev) => [...prev, gResult]);
        setPoolStatus((prev) => ({
          ...prev,
          [chosen.tier]: (prev[chosen.tier] || 0) + 1,
        }));

        // Show confetti for winners
        if (chosen.tier !== 'X') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }

        setIsSubmitting(false);
        setCharName('');
        setAllianceName('');
      }, 3500);
    } catch (e) {
      console.error('Draw error:', e);
      setErrorMsg('エラーが発生しました。もう一度お試しください。');
      setGachaPhase('idle');
      setIsSubmitting(false);
    }
  }, [charName, allianceName, totalRemaining]);

  // --- Admin: password ---
  const handlePasswordSubmit = useCallback(() => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAdminAuth(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
    }
  }, [passwordInput]);

  // --- Admin: clear all ---
  const handleClearAll = useCallback(async () => {
    if (!confirm('全てのデータをリセットしますか？この操作は取り消せません。')) return;
    try {
      await supabase.from('svs_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('svs_participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setResults([]);
      setPoolStatus({});
      setMyResult(null);
      setGachaResult(null);
      localStorage.removeItem('wos-lottery-my-result');
    } catch (e) {
      console.error('Clear error:', e);
    }
  }, []);

  // --- Render ---
  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-text-muted">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Confetti */}
      {showConfetti && gachaResult && <Confetti tier={gachaResult.reward_tier} />}

      {/* Header with gear icon */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-gradient-gold text-2xl font-bold">
          SVS褒賞抽選for564
        </h2>
        <button
          onClick={() => setShowAdminModal(true)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-wos-dark hover:text-text-secondary"
          title="管理画面"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* ============================================================= */}
      {/* Pool Status                                                     */}
      {/* ============================================================= */}
      <section className="mb-6 rounded-xl border border-wos-border bg-wos-panel p-4">
        <h3 className="mb-3 text-sm font-bold text-text-primary">残り本数</h3>
        <div className="grid grid-cols-4 gap-2">
          {REWARD_POOL.map((r) => {
            const drawn = poolStatus[r.tier] || 0;
            const remaining = r.count - drawn;
            const style = TIER_STYLES[r.tier];
            return (
              <div
                key={r.tier}
                className={`rounded-lg border ${style.border} ${style.bg} p-3 text-center`}
              >
                <div className={`text-xs font-bold ${style.text}`}>{r.name}</div>
                <div className={`text-xl font-black ${style.text}`}>
                  {remaining}
                  <span className="text-xs font-normal">/{r.count}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-right text-xs text-text-muted">
          残り合計: {totalRemaining}/{TOTAL_POOL}本
        </div>
      </section>

      {/* ============================================================= */}
      {/* Gacha Section                                                   */}
      {/* ============================================================= */}
      <section className="mb-8 rounded-xl border border-wos-border bg-gradient-to-br from-blue-50 to-sky-50 p-6">
        {myResult && gachaPhase !== 'spinning' && gachaPhase !== 'slowing' ? (
          /* Already participated */
          <div className="text-center">
            <h3 className="mb-4 text-base font-bold text-text-primary">あなたの抽選結果</h3>
            <div className="mb-3 text-sm text-text-secondary">
              {myResult.participant_name}（{myResult.participant_alliance}）さんは参加済みです
            </div>
            <ResultReveal tier={myResult.reward_tier} rewardName={myResult.reward_name} />
          </div>
        ) : (
          /* Application + Gacha */
          <div>
            <h3 className="mb-4 text-center text-lg font-bold text-text-primary">
              🎰 SVS褒賞ガチャ
            </h3>

            {/* Slot Machine */}
            <div className="mb-6">
              <SlotMachine
                resultName={gachaPhase === 'done' && gachaResult ? gachaResult.reward_name : null}
                phase={gachaPhase}
              />
            </div>

            {/* Result reveal */}
            {gachaPhase === 'done' && gachaResult && (
              <ResultReveal tier={gachaResult.reward_tier} rewardName={gachaResult.reward_name} />
            )}

            {/* Application form */}
            {gachaPhase === 'idle' && !myResult && (
              <div className="mx-auto max-w-md space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      キャラクター名 <span className="text-atk-red">*</span>
                    </label>
                    <input
                      type="text"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                      placeholder="キャラクター名を入力"
                      className="w-full rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue focus:ring-1 focus:ring-def-blue/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      同盟名 <span className="text-atk-red">*</span>
                    </label>
                    <input
                      type="text"
                      value={allianceName}
                      onChange={(e) => setAllianceName(e.target.value)}
                      placeholder="同盟名を入力"
                      className="w-full rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue focus:ring-1 focus:ring-def-blue/30"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-atk-red/30 bg-atk-red/10 px-4 py-2 text-sm text-atk-red">
                    {errorMsg}
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={handleDraw}
                    disabled={!charName.trim() || !allianceName.trim() || isSubmitting || totalRemaining <= 0}
                    className="rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-10 py-3.5 text-base font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {isSubmitting ? '抽選中...' : totalRemaining <= 0 ? '抽選終了' : '🎰 抽選開始！'}
                  </button>
                </div>

                <p className="text-center text-xs text-text-muted">
                  1人1回限り。応募と同時に抽選が行われます。
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/* Winners Table                                                   */}
      {/* ============================================================= */}
      <section className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
        <h3 className="mb-4 text-base font-bold text-text-primary">当選者一覧</h3>
        {winners.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            まだ当選者はいません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-wos-border text-xs font-bold text-text-secondary">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">報酬名</th>
                  <th className="px-3 py-2 text-center">Tier</th>
                  <th className="px-3 py-2">当選者名</th>
                  <th className="px-3 py-2">同盟名</th>
                  <th className="hidden px-3 py-2 sm:table-cell">日時</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w, i) => {
                  const style = TIER_STYLES[w.reward_tier] || TIER_STYLES.B;
                  return (
                    <tr
                      key={w.id}
                      className={`border-b border-wos-border/50 ${style.bg}`}
                    >
                      <td className="px-3 py-2 text-xs text-text-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {w.reward_name}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${style.badge}`}>
                          {w.reward_tier}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {w.participant_name}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {w.participant_alliance}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-text-muted sm:table-cell">
                        {formatDate(w.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-right text-xs text-text-muted">
          当選者数: {winners.length}名 / 参加者数: {results.length}名
        </div>
      </section>

      {/* ============================================================= */}
      {/* Admin Modal                                                    */}
      {/* ============================================================= */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-wos-border bg-white shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => {
                setShowAdminModal(false);
                setAdminAuth(false);
                setPasswordInput('');
                setPasswordError(false);
              }}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!adminAuth ? (
              <div className="p-8">
                <h3 className="mb-4 text-lg font-bold text-text-primary">管理画面</h3>
                <p className="mb-4 text-sm text-text-secondary">パスワードを入力してください。</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder="パスワード"
                    className="flex-1 rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue focus:ring-1 focus:ring-def-blue/30"
                    autoFocus
                  />
                  <button
                    onClick={handlePasswordSubmit}
                    className="rounded-lg bg-def-blue px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-def-blue-light"
                  >
                    認証
                  </button>
                </div>
                {passwordError && (
                  <p className="mt-2 text-xs text-atk-red">パスワードが正しくありません。</p>
                )}
              </div>
            ) : (
              <div className="p-6">
                <h3 className="mb-4 text-lg font-bold text-text-primary">管理画面</h3>

                {/* Pool status */}
                <div className="mb-4 rounded-lg border border-wos-border bg-wos-dark p-3 text-xs text-text-secondary">
                  <p className="font-bold">報酬プール状況</p>
                  {REWARD_POOL.map((r) => {
                    const drawn = poolStatus[r.tier] || 0;
                    return (
                      <p key={r.tier}>
                        {r.name}（{r.tier}）: {drawn}/{r.count} 消費済み
                      </p>
                    );
                  })}
                  <p className="mt-1">参加者数: {results.length}名 / 当選者数: {winners.length}名</p>
                </div>

                {/* All results table */}
                <div className="mb-4">
                  <h4 className="mb-2 text-sm font-bold text-text-primary">全参加者結果</h4>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-wos-border">
                    {results.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-muted">データなし</p>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-wos-dark">
                          <tr className="text-xs font-bold text-text-secondary">
                            <th className="px-2 py-1.5">名前</th>
                            <th className="px-2 py-1.5">同盟</th>
                            <th className="px-2 py-1.5">結果</th>
                            <th className="px-2 py-1.5">日時</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => (
                            <tr key={r.id} className="border-t border-wos-border/50">
                              <td className="px-2 py-1.5 text-text-primary">{r.participant_name}</td>
                              <td className="px-2 py-1.5 text-text-secondary">{r.participant_alliance}</td>
                              <td className="px-2 py-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${(TIER_STYLES[r.reward_tier] || TIER_STYLES.X).badge}`}>
                                  {r.reward_name}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-text-muted">{formatDate(r.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAll}
                    className="rounded-lg border border-atk-red/40 bg-atk-red/10 px-5 py-2 text-sm font-bold text-atk-red transition-colors hover:bg-atk-red/20"
                  >
                    全データリセット
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
