'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Participant, RewardItem, LotteryConfig, LotteryResult, Winner } from '@/lib/lottery/types';
import { runLottery, verifyResult } from '@/lib/lottery/lottery-engine';
import {
  isSupabaseAvailable,
  resetSupabaseCache,
  getParticipants,
  addParticipant as apiAddParticipant,
  deleteParticipant as apiDeleteParticipant,
  clearAllParticipants,
  getRewards,
  addReward as apiAddReward,
  updateReward as apiUpdateReward,
  deleteReward as apiDeleteReward,
  swapRewardOrder,
  saveResults,
  clearResults,
  getDeadline,
} from '@/lib/svs-api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = 'fisfis';

const STORAGE_KEYS = {
  applicants: 'wos-lottery-applicants',
  rewards: 'wos-lottery-rewards',
  result: 'wos-lottery-result',
} as const;

const TIER_BG: Record<string, string> = {
  S: 'bg-amber-100 border-amber-300',
  A: 'bg-gray-100 border-gray-300',
  B: 'bg-orange-50 border-orange-300',
};

const TIER_BADGE: Record<string, string> = {
  S: 'bg-amber-200 text-amber-800 border border-amber-400',
  A: 'bg-gray-200 text-gray-700 border border-gray-400',
  B: 'bg-orange-100 text-orange-800 border border-orange-400',
};

const EQUAL_CONFIG: LotteryConfig = {
  weights: { kills: 0, score: 0, daysActive: 0, base: 1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function generateSeed(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function makeParticipant(name: string, alliance: string): Participant {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    alliance,
    registeredAt: Date.now(),
    kills: 0,
    score: 0,
    daysActive: 1,
  };
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Expand rewards
// ---------------------------------------------------------------------------

function expandRewards(rewards: RewardItem[]): RewardItem[] {
  const expanded: RewardItem[] = [];
  for (const r of rewards) {
    for (let i = 0; i < r.quantity; i++) {
      expanded.push({ ...r, id: `${r.id}-${i}`, quantity: 1 });
    }
  }
  return expanded;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCSV(applicants: Participant[]) {
  const header = 'キャラクター名,同盟名,応募日時';
  const rows = applicants.map(
    (a) => `"${a.name}","${a.alliance}","${formatDate(a.registeredAt)}"`,
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lottery-applicants-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LotteryPage() {
  // --- State ---
  const [applicants, setApplicants] = useState<Participant[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [result, setResult] = useState<LotteryResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);

  // Deadline
  const [deadline, setDeadline] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Application form
  const [charName, setCharName] = useState('');
  const [allianceName, setAllianceName] = useState('');
  const [applied, setApplied] = useState(false);

  // Admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [adminTab, setAdminTab] = useState<'applicants' | 'rewards' | 'draw'>('applicants');

  // Reward form (admin)
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardQty, setNewRewardQty] = useState(1);
  const [newRewardTier, setNewRewardTier] = useState<'S' | 'A' | 'B'>('A');
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  // Draw (admin)
  const [seedInput, setSeedInput] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // --- Hydrate: try Supabase first, fallback to localStorage ---
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const available = await isSupabaseAvailable();
        if (cancelled) return;

        if (available) {
          setUseSupabase(true);
          const [p, r, dl] = await Promise.all([getParticipants(), getRewards(), getDeadline()]);
          if (cancelled) return;
          setApplicants(p);
          setRewards(r);
          setDeadline(dl);
          // Result is stored locally for display since it's derived data
          setResult(loadJSON<LotteryResult | null>(STORAGE_KEYS.result, null));
        } else {
          // Fallback to localStorage
          setUseSupabase(false);
          setApplicants(loadJSON<Participant[]>(STORAGE_KEYS.applicants, []));
          setRewards(loadJSON<RewardItem[]>(STORAGE_KEYS.rewards, []));
          setResult(loadJSON<LotteryResult | null>(STORAGE_KEYS.result, null));
        }
      } catch {
        // Fallback to localStorage on any error
        if (cancelled) return;
        setUseSupabase(false);
        setApplicants(loadJSON<Participant[]>(STORAGE_KEYS.applicants, []));
        setRewards(loadJSON<RewardItem[]>(STORAGE_KEYS.rewards, []));
        setResult(loadJSON<LotteryResult | null>(STORAGE_KEYS.result, null));
      }
      if (!cancelled) setHydrated(true);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // --- Persist to localStorage (as backup, always) ---
  useEffect(() => {
    if (!hydrated) return;
    saveJSON(STORAGE_KEYS.applicants, applicants);
  }, [applicants, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(STORAGE_KEYS.rewards, rewards);
  }, [rewards, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(STORAGE_KEYS.result, result);
  }, [result, hydrated]);

  // --- Countdown timer for deadline ---
  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isPastDeadline = useMemo(() => {
    if (!deadline) return false;
    return now >= new Date(deadline).getTime();
  }, [deadline, now]);

  const countdownText = useMemo(() => {
    if (!deadline) return null;
    const deadlineMs = new Date(deadline).getTime();
    const diff = deadlineMs - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `あと${days}日${hours}時間${minutes}分`;
    if (hours > 0) return `あと${hours}時間${minutes}分${seconds}秒`;
    return `あと${minutes}分${seconds}秒`;
  }, [deadline, now]);

  const deadlineDisplay = useMemo(() => {
    if (!deadline) return null;
    const d = new Date(deadline);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [deadline]);

  // --- Build winner map for result table ---
  const winnerMap = useMemo(() => {
    if (!result) return new Map<string, Winner>();
    const m = new Map<string, Winner>();
    for (const w of result.winners) {
      m.set(w.reward.id, w);
    }
    return m;
  }, [result]);

  const resultRows = useMemo(() => {
    const expanded = expandRewards(rewards);
    return expanded.map((r) => {
      const winner = winnerMap.get(r.id);
      return { reward: r, winner: winner ?? null };
    });
  }, [rewards, winnerMap]);

  // --- User actions ---
  const handleApply = useCallback(async () => {
    const name = charName.trim();
    const alliance = allianceName.trim();
    if (!name || !alliance) return;

    if (useSupabase) {
      try {
        const p = await apiAddParticipant(name, alliance);
        setApplicants((prev) => [...prev, p]);
      } catch {
        // Fallback: add locally
        const p = makeParticipant(name, alliance);
        setApplicants((prev) => [...prev, p]);
      }
    } else {
      const p = makeParticipant(name, alliance);
      setApplicants((prev) => [...prev, p]);
    }
    setCharName('');
    setAllianceName('');
    setApplied(true);
  }, [charName, allianceName, useSupabase]);

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

  // --- Admin: applicant management ---
  const removeApplicant = useCallback(async (id: string) => {
    if (useSupabase) {
      try {
        await apiDeleteParticipant(id);
      } catch {
        // Continue removing locally
      }
    }
    setApplicants((prev) => prev.filter((a) => a.id !== id));
  }, [useSupabase]);

  // --- Admin: reward management ---
  const addOrUpdateReward = useCallback(async () => {
    const name = newRewardName.trim();
    if (!name) return;

    if (editingRewardId) {
      if (useSupabase) {
        try {
          await apiUpdateReward(editingRewardId, { name, quantity: newRewardQty, tier: newRewardTier });
        } catch {
          // Continue locally
        }
      }
      setRewards((prev) =>
        prev.map((r) =>
          r.id === editingRewardId
            ? { ...r, name, quantity: newRewardQty, tier: newRewardTier }
            : r,
        ),
      );
      setEditingRewardId(null);
    } else {
      if (useSupabase) {
        try {
          const newReward = await apiAddReward(name, newRewardTier, newRewardQty);
          setRewards((prev) => [...prev, newReward]);
          setNewRewardName('');
          setNewRewardQty(1);
          setNewRewardTier('A');
          return;
        } catch {
          // Fallback to local
        }
      }
      setRewards((prev) => [
        ...prev,
        {
          id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          quantity: newRewardQty,
          tier: newRewardTier,
        },
      ]);
    }
    setNewRewardName('');
    setNewRewardQty(1);
    setNewRewardTier('A');
  }, [newRewardName, newRewardQty, newRewardTier, editingRewardId, useSupabase]);

  const startEditReward = useCallback((r: RewardItem) => {
    setEditingRewardId(r.id);
    setNewRewardName(r.name);
    setNewRewardQty(r.quantity);
    setNewRewardTier(r.tier);
  }, []);

  const cancelEditReward = useCallback(() => {
    setEditingRewardId(null);
    setNewRewardName('');
    setNewRewardQty(1);
    setNewRewardTier('A');
  }, []);

  const removeReward = useCallback(async (id: string) => {
    if (useSupabase) {
      try {
        await apiDeleteReward(id);
      } catch {
        // Continue locally
      }
    }
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }, [useSupabase]);

  const moveReward = useCallback(async (id: string, dir: -1 | 1) => {
    const idx = rewards.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= rewards.length) return;

    if (useSupabase) {
      try {
        await swapRewardOrder(rewards[idx].id, rewards[target].id);
      } catch {
        // Continue locally
      }
    }
    setRewards((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, [rewards, useSupabase]);

  // --- Admin: draw ---
  const handleDraw = useCallback(() => {
    if (applicants.length === 0 || rewards.length === 0) return;
    setIsDrawing(true);
    setIsVerified(null);

    const expanded = expandRewards(rewards);
    const seed = seedInput.trim() || generateSeed();
    const config: LotteryConfig = { ...EQUAL_CONFIG, seed };

    setTimeout(async () => {
      const lotteryResult = runLottery(applicants, expanded, config);
      setResult(lotteryResult);
      setSeedInput(lotteryResult.seed);
      setIsDrawing(false);

      // Save to Supabase if available
      if (useSupabase) {
        try {
          await saveResults(lotteryResult);
        } catch {
          // Continue - result is saved locally via useEffect
        }
      }
    }, 800);
  }, [applicants, rewards, seedInput, useSupabase]);

  const handleVerify = useCallback(() => {
    if (!result) return;
    const expanded = expandRewards(rewards);
    const verified = verifyResult(applicants, expanded, result);
    setIsVerified(verified);
  }, [result, applicants, rewards]);

  const handleResetResult = useCallback(async () => {
    setResult(null);
    setIsVerified(null);
    setSeedInput('');
    if (useSupabase) {
      try {
        await clearResults();
      } catch {
        // Ignore
      }
    }
  }, [useSupabase]);

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
      {/* Deadline Banner                                                */}
      {/* ============================================================= */}
      {deadline && (
        <section className="mb-4">
          {isPastDeadline ? (
            <div className="rounded-xl border border-atk-red/30 bg-atk-red/10 px-5 py-4 text-center">
              <p className="text-sm font-bold text-atk-red">応募は締め切りました</p>
              <p className="mt-1 text-xs text-atk-red/70">締切: {deadlineDisplay}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-def-blue/30 bg-def-blue/10 px-5 py-4 text-center">
              <p className="text-xs text-def-blue/70">応募締切: {deadlineDisplay}</p>
              <p className="mt-1 text-lg font-bold text-def-blue">{countdownText}</p>
            </div>
          )}
        </section>
      )}

      {/* ============================================================= */}
      {/* Application Form                                               */}
      {/* ============================================================= */}
      {isPastDeadline ? (
        <section className="panel-glow mb-8 rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-2 text-base font-bold text-text-primary">応募フォーム</h3>
          <p className="text-sm text-text-muted">応募受付は終了しました。抽選結果は下の一覧で確認できます。</p>
        </section>
      ) : (
      <section className="panel-glow mb-8 rounded-xl border border-wos-border bg-wos-panel p-5">
        <h3 className="mb-4 text-base font-bold text-text-primary">応募フォーム</h3>
        {applied ? (
          <div className="rounded-lg border border-bow-green/40 bg-bow-green/10 px-4 py-3 text-sm text-bow-green">
            応募済みです。抽選結果は下の一覧で確認できます。
            <button
              onClick={() => setApplied(false)}
              className="ml-3 text-xs underline hover:no-underline"
            >
              もう一度応募する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
            <button
              onClick={handleApply}
              disabled={!charName.trim() || !allianceName.trim()}
              className="rounded-lg bg-def-blue px-6 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-def-blue-light hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              応募する
            </button>
          </div>
        )}
      </section>
      )}

      {/* ============================================================= */}
      {/* Results Table                                                  */}
      {/* ============================================================= */}
      <section className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
        <h3 className="mb-4 text-base font-bold text-text-primary">当選結果一覧</h3>
        {resultRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            報酬が設定されていません。管理者による設定をお待ちください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-wos-border text-xs font-bold text-text-secondary">
                  <th className="px-3 py-2">報酬名</th>
                  <th className="px-3 py-2 text-center">Tier</th>
                  <th className="px-3 py-2">当選者名</th>
                  <th className="px-3 py-2">同盟名</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row, i) => {
                  const tierBg = TIER_BG[row.reward.tier] || '';
                  return (
                    <tr
                      key={`${row.reward.id}-${i}`}
                      className={`border-b border-wos-border/50 ${tierBg}`}
                    >
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {row.reward.name}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${TIER_BADGE[row.reward.tier]}`}
                        >
                          {row.reward.tier}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.winner ? (
                          <span className="font-medium text-text-primary">
                            {row.winner.participant.name}
                          </span>
                        ) : (
                          <span className="text-text-muted">抽選待ち</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.winner ? (
                          <span className="text-text-secondary">
                            {row.winner.participant.alliance}
                          </span>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <div className="mt-3 text-right text-[10px] text-text-muted">
            Seed: {result.seed} | {formatDate(result.timestamp)}
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/* Admin Modal                                                    */}
      {/* ============================================================= */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-2xl border border-wos-border bg-white shadow-2xl">
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!adminAuth ? (
              /* --- Password Gate --- */
              <div className="p-8">
                <h3 className="mb-4 text-lg font-bold text-text-primary">
                  管理画面
                </h3>
                <p className="mb-4 text-sm text-text-secondary">
                  パスワードを入力してください。
                </p>
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
                  <p className="mt-2 text-xs text-atk-red">
                    パスワードが正しくありません。
                  </p>
                )}
              </div>
            ) : (
              /* --- Admin Panel --- */
              <div className="p-6">
                <h3 className="mb-4 text-lg font-bold text-text-primary">
                  管理画面
                </h3>

                {/* Tabs */}
                <div className="mb-5 flex gap-1 rounded-lg bg-wos-dark p-1">
                  {(
                    [
                      { key: 'applicants', label: '応募者一覧' },
                      { key: 'rewards', label: '報酬設定' },
                      { key: 'draw', label: '抽選実行' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAdminTab(tab.key)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        adminTab === tab.key
                          ? 'bg-white text-text-primary shadow-sm'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ------ Applicants Tab ------ */}
                {adminTab === 'applicants' && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-text-secondary">
                        応募者数: {applicants.length}名
                      </span>
                      <button
                        onClick={() => exportCSV(applicants)}
                        disabled={applicants.length === 0}
                        className="rounded-lg border border-wos-border bg-wos-dark px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white disabled:opacity-40"
                      >
                        CSVエクスポート
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-wos-border">
                      {applicants.length === 0 ? (
                        <p className="py-6 text-center text-sm text-text-muted">
                          応募者がいません
                        </p>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-wos-dark">
                            <tr className="text-xs font-bold text-text-secondary">
                              <th className="px-3 py-2">キャラ名</th>
                              <th className="px-3 py-2">同盟名</th>
                              <th className="px-3 py-2">応募日時</th>
                              <th className="px-3 py-2 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {applicants.map((a) => (
                              <tr
                                key={a.id}
                                className="border-t border-wos-border/50"
                              >
                                <td className="px-3 py-2 text-text-primary">
                                  {a.name}
                                </td>
                                <td className="px-3 py-2 text-text-secondary">
                                  {a.alliance}
                                </td>
                                <td className="px-3 py-2 text-xs text-text-muted">
                                  {formatDate(a.registeredAt)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => removeApplicant(a.id)}
                                    className="text-xs text-atk-red hover:underline"
                                  >
                                    削除
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ------ Rewards Tab ------ */}
                {adminTab === 'rewards' && (
                  <div>
                    {/* Add/Edit form */}
                    <div className="mb-4 rounded-lg border border-wos-border bg-wos-dark p-4">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={newRewardName}
                          onChange={(e) => setNewRewardName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && addOrUpdateReward()
                          }
                          placeholder="報酬名"
                          className="min-w-0 flex-1 rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue"
                        />
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={newRewardQty}
                          onChange={(e) =>
                            setNewRewardQty(Number(e.target.value) || 1)
                          }
                          className="w-16 rounded-lg border border-wos-border bg-white px-2 py-2 text-center text-sm text-text-primary outline-none focus:border-def-blue"
                          title="数量"
                        />
                      </div>
                      <div className="mb-3 flex gap-1">
                        {(['S', 'A', 'B'] as const).map((tier) => (
                          <button
                            key={tier}
                            onClick={() => setNewRewardTier(tier)}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-bold transition-colors ${
                              newRewardTier === tier
                                ? TIER_BADGE[tier]
                                : 'border-wos-border bg-white text-text-muted'
                            }`}
                          >
                            Tier {tier}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={addOrUpdateReward}
                          disabled={!newRewardName.trim()}
                          className="rounded-lg bg-def-blue px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-def-blue-light disabled:opacity-40"
                        >
                          {editingRewardId ? '更新' : '追加'}
                        </button>
                        {editingRewardId && (
                          <button
                            onClick={cancelEditReward}
                            className="rounded-lg border border-wos-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-white"
                          >
                            キャンセル
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reward list */}
                    <div className="space-y-1">
                      {rewards.length === 0 ? (
                        <p className="py-6 text-center text-sm text-text-muted">
                          報酬が設定されていません
                        </p>
                      ) : (
                        rewards.map((r, idx) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-lg border border-wos-border bg-white px-3 py-2"
                          >
                            {/* Up / Down */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveReward(r.id, -1)}
                                disabled={idx === 0}
                                className="text-[10px] text-text-muted hover:text-text-primary disabled:opacity-20"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveReward(r.id, 1)}
                                disabled={idx === rewards.length - 1}
                                className="text-[10px] text-text-muted hover:text-text-primary disabled:opacity-20"
                              >
                                ▼
                              </button>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-bold ${TIER_BADGE[r.tier]}`}
                            >
                              {r.tier}
                            </span>
                            <span className="flex-1 text-sm font-medium text-text-primary">
                              {r.name}
                            </span>
                            <span className="text-xs text-text-muted">
                              x{r.quantity}
                            </span>
                            <button
                              onClick={() => startEditReward(r)}
                              className="text-xs text-def-blue hover:underline"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => removeReward(r.id)}
                              className="text-xs text-atk-red hover:underline"
                            >
                              削除
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ------ Draw Tab ------ */}
                {adminTab === 'draw' && (
                  <div className="space-y-4">
                    {/* Seed */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        シード値（空欄で自動生成）
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={seedInput}
                          onChange={(e) => setSeedInput(e.target.value)}
                          placeholder="自動生成"
                          className="flex-1 rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue"
                        />
                        <button
                          onClick={() => setSeedInput(generateSeed())}
                          className="rounded-lg border border-wos-border bg-white px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-wos-dark"
                        >
                          生成
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="rounded-lg border border-wos-border bg-wos-dark p-3 text-xs text-text-secondary">
                      <p>応募者: {applicants.length}名</p>
                      <p>
                        報酬: {rewards.length}種（計{' '}
                        {rewards.reduce((a, r) => a + r.quantity, 0)}個）
                      </p>
                      <p className="mt-1 text-text-muted">
                        全Tier均等抽選。上位Tierから順に抽選し、同一人物の重複当選はありません。
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleDraw}
                        disabled={
                          applicants.length === 0 ||
                          rewards.length === 0 ||
                          isDrawing
                        }
                        className="rounded-xl bg-gradient-to-r from-gold to-gold-light px-8 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                      >
                        {isDrawing ? '抽選中...' : '抽選実行'}
                      </button>
                      {result && (
                        <>
                          <button
                            onClick={handleVerify}
                            className="rounded-xl border border-def-blue/40 bg-def-blue/10 px-5 py-3 text-sm font-bold text-def-blue transition-colors hover:bg-def-blue/20"
                          >
                            結果検証
                          </button>
                          <button
                            onClick={handleResetResult}
                            className="rounded-xl border border-atk-red/40 bg-atk-red/10 px-5 py-3 text-sm font-bold text-atk-red transition-colors hover:bg-atk-red/20"
                          >
                            結果リセット
                          </button>
                        </>
                      )}
                    </div>

                    {/* Verification */}
                    {isVerified !== null && (
                      <div
                        className={`rounded-lg border p-3 text-sm ${
                          isVerified
                            ? 'border-bow-green/40 bg-bow-green/10 text-bow-green'
                            : 'border-atk-red/40 bg-atk-red/10 text-atk-red'
                        }`}
                      >
                        {isVerified
                          ? 'Seed検証成功: 同じシードで同じ結果が再現されました'
                          : '検証失敗: 結果が一致しません'}
                      </div>
                    )}

                    {/* Result preview in admin */}
                    {result && (
                      <div className="rounded-lg border border-wos-border bg-wos-dark p-3">
                        <div className="mb-2 text-xs font-bold text-text-secondary">
                          抽選結果プレビュー（Seed: {result.seed}）
                        </div>
                        <div className="max-h-60 space-y-1 overflow-y-auto">
                          {result.winners.map((w, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded bg-white px-3 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gold-dark">
                                  #{i + 1}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_BADGE[w.reward.tier]}`}
                                >
                                  {w.reward.tier}
                                </span>
                                <span className="text-text-primary">
                                  {w.reward.name}
                                </span>
                              </div>
                              <div className="text-text-secondary">
                                {w.participant.name}（{w.participant.alliance}）
                              </div>
                            </div>
                          ))}
                        </div>
                        {applicants.length > result.winners.length && (
                          <div className="mt-2 border-t border-wos-border pt-2 text-[10px] text-text-muted">
                            未当選:{' '}
                            {applicants.length - result.winners.length}名
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
