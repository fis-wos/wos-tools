'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Participant, RewardItem, LotteryConfig, LotteryResult, Winner } from '@/lib/lottery/types';
import { runLottery, verifyResult } from '@/lib/lottery/lottery-engine';
import {
  isSupabaseAvailable,
  getParticipants,
  addParticipant as apiAddParticipant,
  deleteParticipant as apiDeleteParticipant,
  clearAllParticipants,
  getRewards,
  addReward as apiAddReward,
  updateReward as apiUpdateReward,
  deleteReward as apiDeleteReward,
  swapRewardOrder,
  getResults,
  saveResults,
  clearResults,
  getSimHistory,
  clearSimHistory,
  type SimHistoryRow as ApiSimHistoryRow,
  type SimDetails,
  type SimSideDetail,
  getDeadline,
  setDeadline as apiSetDeadline,
  clearDeadline as apiClearDeadline,
} from '@/lib/svs-api';
import {
  getAnalyses,
  getAnalysisStats,
  deleteAnalysis,
  getTopCounterFormations,
  type CounterAnalysis,
  type AnalysisStats,
} from '@/lib/counter-api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = 'fisfis';

const TIER_BADGE: Record<string, string> = {
  S: 'bg-amber-200 text-amber-800 border border-amber-400',
  A: 'bg-gray-200 text-gray-700 border border-gray-400',
  B: 'bg-orange-100 text-orange-800 border border-orange-400',
};

const TIER_BG: Record<string, string> = {
  S: 'bg-amber-50 border-amber-200',
  A: 'bg-gray-50 border-gray-200',
  B: 'bg-orange-50 border-orange-200',
};

const EQUAL_CONFIG: LotteryConfig = {
  weights: { kills: 0, score: 0, daysActive: 0, base: 1 },
};

type AdminTab = 'sim' | 'participants' | 'rewards' | 'draw' | 'counter' | 'apikeys';

interface SimRow {
  id: string;
  created_at: string;
  winner: string;
  trials: number;
  attacker_formation: string;
  defender_formation: string;
  details?: SimDetails | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: number | string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function generateSeed(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function expandRewards(rewards: RewardItem[]): RewardItem[] {
  const expanded: RewardItem[] = [];
  for (const r of rewards) {
    for (let i = 0; i < r.quantity; i++) {
      expanded.push({ ...r, id: `${r.id}-${i}`, quantity: 1 });
    }
  }
  return expanded;
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  // Auth
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('participants');

  // Data
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [simHistory, setSimHistory] = useState<SimRow[]>([]);
  const [dbAvailable, setDbAvailable] = useState(true);

  // Sim detail modal
  const [selectedSim, setSelectedSim] = useState<SimRow | null>(null);

  // Counter analyses
  const [counterAnalyses, setCounterAnalyses] = useState<CounterAnalysis[]>([]);
  const [counterStats, setCounterStats] = useState<AnalysisStats | null>(null);
  const [topCounters, setTopCounters] = useState<{ formation: string; winRate: number; count: number }[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CounterAnalysis | null>(null);

  // Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reward form
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardQty, setNewRewardQty] = useState(1);
  const [newRewardTier, setNewRewardTier] = useState<'S' | 'A' | 'B'>('A');
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  // Deadline
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [currentDeadline, setCurrentDeadline] = useState<string | null>(null);

  // Draw
  const [seedInput, setSeedInput] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [result, setResult] = useState<LotteryResult | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const handleAuth = useCallback(() => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  }, [passwordInput]);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const available = await isSupabaseAvailable();
      setDbAvailable(available);
      if (!available) {
        setError('Supabaseに接続できません。テーブルが作成されているか確認してください。');
        setLoading(false);
        return;
      }

      const [p, r, dl] = await Promise.all([getParticipants(), getRewards(), getDeadline()]);
      setParticipants(p);
      setRewards(r);
      setCurrentDeadline(dl);

      // Sim history - may fail if table doesn't exist
      try {
        const sh = await getSimHistory();
        setSimHistory(sh);
      } catch {
        // sim_history table may not exist
        setSimHistory([]);
      }

      // Counter analyses - may fail if table doesn't exist
      try {
        const [ca, cs, tc] = await Promise.all([
          getAnalyses(200),
          getAnalysisStats(),
          getTopCounterFormations(),
        ]);
        setCounterAnalyses(ca);
        setCounterStats(cs);
        setTopCounters(tc);
      } catch {
        // counter_analyses table may not exist
        setCounterAnalyses([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadData();
    }
  }, [authenticated, loadData]);

  // ---------------------------------------------------------------------------
  // Participant actions
  // ---------------------------------------------------------------------------

  const handleDeleteParticipant = useCallback(async (id: string) => {
    try {
      await apiDeleteParticipant(id);
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  }, []);

  const handleClearParticipants = useCallback(async () => {
    if (!confirm('全応募者を削除しますか？この操作は取り消せません。')) return;
    try {
      await clearAllParticipants();
      setParticipants([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '全削除に失敗しました');
    }
  }, []);

  const handleExportParticipantsCSV = useCallback(() => {
    const header = 'キャラクター名,同盟名,応募日時';
    const rows = participants.map(
      (a) => `"${a.name}","${a.alliance}","${formatDate(a.registeredAt)}"`,
    );
    downloadCSV(`svs-participants-${Date.now()}.csv`, header + '\n' + rows.join('\n'));
  }, [participants]);

  // ---------------------------------------------------------------------------
  // Reward actions
  // ---------------------------------------------------------------------------

  const handleAddOrUpdateReward = useCallback(async () => {
    const name = newRewardName.trim();
    if (!name) return;
    try {
      if (editingRewardId) {
        await apiUpdateReward(editingRewardId, {
          name,
          tier: newRewardTier,
          quantity: newRewardQty,
        });
        setRewards((prev) =>
          prev.map((r) =>
            r.id === editingRewardId
              ? { ...r, name, tier: newRewardTier, quantity: newRewardQty }
              : r,
          ),
        );
        setEditingRewardId(null);
      } else {
        const newReward = await apiAddReward(name, newRewardTier, newRewardQty);
        setRewards((prev) => [...prev, newReward]);
      }
      setNewRewardName('');
      setNewRewardQty(1);
      setNewRewardTier('A');
    } catch (err) {
      setError(err instanceof Error ? err.message : '報酬の保存に失敗しました');
    }
  }, [newRewardName, newRewardTier, newRewardQty, editingRewardId]);

  const handleDeleteReward = useCallback(async (id: string) => {
    try {
      await apiDeleteReward(id);
      setRewards((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  }, []);

  const handleMoveReward = useCallback(
    async (id: string, dir: -1 | 1) => {
      const idx = rewards.findIndex((r) => r.id === id);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= rewards.length) return;

      try {
        await swapRewardOrder(rewards[idx].id, rewards[target].id);
        setRewards((prev) => {
          const next = [...prev];
          [next[idx], next[target]] = [next[target], next[idx]];
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '並べ替えに失敗しました');
      }
    },
    [rewards],
  );

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

  // ---------------------------------------------------------------------------
  // Deadline actions
  // ---------------------------------------------------------------------------

  const handleSetDeadline = useCallback(async () => {
    if (!deadlineDate) return;
    const iso = `${deadlineDate}T${deadlineTime || '23:59'}:00`;
    try {
      await apiSetDeadline(iso);
      setCurrentDeadline(iso);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '締切の設定に失敗しました');
    }
  }, [deadlineDate, deadlineTime]);

  const handleClearDeadline = useCallback(async () => {
    try {
      await apiClearDeadline();
      setCurrentDeadline(null);
      setDeadlineDate('');
      setDeadlineTime('23:59');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '締切の解除に失敗しました');
    }
  }, []);

  const deadlineDisplay = useMemo(() => {
    if (!currentDeadline) return null;
    const d = new Date(currentDeadline);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [currentDeadline]);

  // ---------------------------------------------------------------------------
  // Draw actions
  // ---------------------------------------------------------------------------

  const handleDraw = useCallback(() => {
    if (participants.length === 0 || rewards.length === 0) return;
    setIsDrawing(true);
    setIsVerified(null);

    const expanded = expandRewards(rewards);
    const seed = seedInput.trim() || generateSeed();
    const config: LotteryConfig = { ...EQUAL_CONFIG, seed };

    setTimeout(async () => {
      const lotteryResult = runLottery(participants, expanded, config);
      setResult(lotteryResult);
      setSeedInput(lotteryResult.seed);
      setIsDrawing(false);

      // Save to Supabase
      try {
        await saveResults(lotteryResult);
      } catch {
        // Continue even if save fails
      }
    }, 800);
  }, [participants, rewards, seedInput]);

  const handleVerify = useCallback(() => {
    if (!result) return;
    const expanded = expandRewards(rewards);
    const verified = verifyResult(participants, expanded, result);
    setIsVerified(verified);
  }, [result, participants, rewards]);

  const handleResetResult = useCallback(async () => {
    setResult(null);
    setIsVerified(null);
    setSeedInput('');
    try {
      await clearResults();
    } catch {
      // Ignore
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Sim history actions
  // ---------------------------------------------------------------------------

  const handleClearSimHistory = useCallback(async () => {
    if (!confirm('全シミュレーション履歴を削除しますか？')) return;
    try {
      await clearSimHistory();
      setSimHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  }, []);

  const handleOpenInSimulator = useCallback((sim: SimRow) => {
    if (!sim.details) return;
    const d = sim.details;
    const buildSide = (side: SimSideDetail) => ({
      leaders: side.leaders.map(l => l.id),
      riders: side.riders.map(r => r.id),
      shieldRatio: side.troopRatio.shield,
      spearRatio: side.troopRatio.spear,
      bowRatio: side.troopRatio.bow,
      totalTroops: side.totalTroops,
    });
    const preset = {
      atk: buildSide(d.atkFormation),
      def: buildSide(d.defFormation),
    };
    localStorage.setItem('wos_sim_preset', JSON.stringify(preset));
    window.open('/simulator', '_blank');
  }, []);

  const handleExportSimCSV = useCallback(() => {
    const header = '日時,勝者,試行回数,攻撃編成,防御編成';
    const rows = simHistory.map(
      (s) =>
        `"${formatDate(s.created_at)}","${s.winner}",${s.trials},"${s.attacker_formation || ''}","${s.defender_formation || ''}"`,
    );
    downloadCSV(`sim-history-${Date.now()}.csv`, header + '\n' + rows.join('\n'));
  }, [simHistory]);

  // ---------------------------------------------------------------------------
  // Winner map for draw tab
  // ---------------------------------------------------------------------------

  const winnerMap = useMemo(() => {
    if (!result) return new Map<string, Winner>();
    const m = new Map<string, Winner>();
    for (const w of result.winners) {
      m.set(w.reward.id, w);
    }
    return m;
  }, [result]);

  // ---------------------------------------------------------------------------
  // Render: Auth gate
  // ---------------------------------------------------------------------------

  if (!authenticated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="panel-glow rounded-2xl border border-wos-border bg-wos-panel p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-ice-blue to-def-blue text-2xl text-white shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary">管理画面</h2>
              <p className="mt-1 text-xs text-text-muted">パスワードを入力してください</p>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="パスワード"
                className="w-full rounded-lg border border-wos-border bg-white px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue focus:ring-2 focus:ring-def-blue/20"
                autoFocus
              />
              <button
                onClick={handleAuth}
                className="w-full rounded-lg bg-gradient-to-r from-ice-blue to-def-blue px-4 py-3 text-sm font-bold text-white shadow transition-all hover:shadow-md active:scale-[0.98]"
              >
                認証
              </button>
              {passwordError && (
                <p className="text-center text-xs text-atk-red">パスワードが正しくありません。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-gradient-gold text-2xl font-bold">管理画面</h2>
          <p className="mt-1 text-xs text-text-muted">
            {dbAvailable ? 'Supabase接続済み' : 'Supabase未接続'}
          </p>
        </div>
        <button
          onClick={() => {
            setAuthenticated(false);
            setPasswordInput('');
          }}
          className="rounded-lg border border-wos-border bg-white px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-wos-dark"
        >
          ログアウト
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-atk-red/30 bg-atk-red/10 px-4 py-3 text-sm text-atk-red">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-xs underline hover:no-underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mb-4 rounded-lg border border-def-blue/30 bg-def-blue/10 px-4 py-3 text-sm text-def-blue">
          データを読み込み中...
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-wos-dark p-1">
        {(
          [
            { key: 'sim' as const, label: 'SIM履歴' },
            { key: 'participants' as const, label: 'SVS応募者' },
            { key: 'rewards' as const, label: 'SVS報酬' },
            { key: 'draw' as const, label: 'SVS抽選' },
            { key: 'counter' as const, label: '解析履歴' },
            { key: 'apikeys' as const, label: '⚙️ API設定' },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* Tab: Simulation History                                            */}
      {/* ================================================================= */}
      {activeTab === 'sim' && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary">
              シミュレーション履歴
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({simHistory.length}件)
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportSimCSV}
                disabled={simHistory.length === 0}
                className="rounded-lg border border-wos-border bg-wos-dark px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white disabled:opacity-40"
              >
                CSV出力
              </button>
              <button
                onClick={handleClearSimHistory}
                disabled={simHistory.length === 0}
                className="rounded-lg border border-atk-red/30 bg-atk-red/5 px-3 py-1.5 text-xs font-medium text-atk-red transition-colors hover:bg-atk-red/10 disabled:opacity-40"
              >
                全削除
              </button>
            </div>
          </div>
          <div className="max-h-[500px] overflow-auto rounded-lg border border-wos-border">
            {simHistory.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">
                シミュレーション履歴がありません
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-wos-dark">
                  <tr className="text-xs font-bold text-text-secondary">
                    <th className="px-3 py-2">日時</th>
                    <th className="px-3 py-2">勝者</th>
                    <th className="px-3 py-2 text-center">試行回数</th>
                    <th className="px-3 py-2">攻撃編成</th>
                    <th className="px-3 py-2">防御編成</th>
                    <th className="px-3 py-2 text-center">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {simHistory.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-wos-border/50 cursor-pointer hover:bg-wos-dark/50 transition-colors"
                      onClick={() => setSelectedSim(s)}
                    >
                      <td className="px-3 py-2 text-xs text-text-muted">{formatDate(s.created_at)}</td>
                      <td className="px-3 py-2 font-medium text-text-primary">{s.winner}</td>
                      <td className="px-3 py-2 text-center text-text-secondary">{s.trials}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-text-secondary">{s.attacker_formation}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-text-secondary">{s.defender_formation}</td>
                      <td className="px-3 py-2 text-center">
                        {s.details ? (
                          <span className="text-[10px] text-def-blue">詳細あり</span>
                        ) : (
                          <span className="text-[10px] text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sim Detail Modal */}
          {selectedSim && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setSelectedSim(null)}
            >
              <div
                className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-wos-border bg-wos-panel p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-text-primary">シミュレーション詳細</h3>
                  <button
                    onClick={() => setSelectedSim(null)}
                    className="rounded-lg border border-wos-border px-3 py-1 text-xs text-text-muted hover:bg-wos-dark"
                  >
                    閉じる
                  </button>
                </div>

                <div className="mb-3 text-xs text-text-muted">
                  {formatDate(selectedSim.created_at)} / 勝者: {selectedSim.winner} / 試行: {selectedSim.trials}回
                </div>

                {selectedSim.details ? (() => {
                  const d = selectedSim.details!;
                  const renderSide = (label: string, side: SimSideDetail, colorClass: string) => (
                    <div className={`rounded-lg border p-3 ${colorClass}`}>
                      <div className="mb-2 text-sm font-bold">{label}</div>
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-medium text-text-secondary">リーダー: </span>
                          {side.leaders.map(l => l.name).join(', ') || 'なし'}
                        </div>
                        <div>
                          <span className="font-medium text-text-secondary">ライダー: </span>
                          {side.riders.map(r => r.name).join(', ') || 'なし'}
                        </div>
                        <div>
                          <span className="font-medium text-text-secondary">兵比: </span>
                          盾{side.troopRatio.shield}:槍{side.troopRatio.spear}:弓{side.troopRatio.bow}
                        </div>
                        <div>
                          <span className="font-medium text-text-secondary">総兵数: </span>
                          {side.totalTroops.toLocaleString()} (T{side.troopTier})
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {renderSide('攻撃側', d.atkFormation, 'border-atk-red/30 bg-atk-red/5')}
                        {renderSide('防御側', d.defFormation, 'border-def-blue/30 bg-def-blue/5')}
                      </div>

                      {/* Results */}
                      <div className="rounded-lg border border-wos-border bg-white/60 p-3">
                        <div className="mb-2 text-sm font-bold text-text-primary">結果</div>
                        <div className="grid grid-cols-3 gap-3 text-center text-xs">
                          <div>
                            <div className="text-text-muted">攻撃勝利</div>
                            <div className="text-lg font-bold text-atk-red">{d.results.atkWins}</div>
                          </div>
                          <div>
                            <div className="text-text-muted">引き分け</div>
                            <div className="text-lg font-bold text-text-primary">{d.results.draws}</div>
                          </div>
                          <div>
                            <div className="text-text-muted">防御勝利</div>
                            <div className="text-lg font-bold text-def-blue">{d.results.defWins}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-center text-xs text-text-muted">
                          平均ターン: {d.results.avgTurns}
                        </div>
                      </div>

                      {/* Last Run Details */}
                      {d.results.lastRun && (
                        <div className="rounded-lg border border-wos-border bg-white/60 p-3">
                          <div className="mb-2 text-sm font-bold text-text-primary">最終実行詳細</div>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="mb-1 font-bold text-atk-red">攻撃側残存</div>
                              <div>盾: {d.results.lastRun.aTroopsLeft.shield.toLocaleString()}</div>
                              <div>槍: {d.results.lastRun.aTroopsLeft.spear.toLocaleString()}</div>
                              <div>弓: {d.results.lastRun.aTroopsLeft.bow.toLocaleString()}</div>
                              <div className="mt-1 border-t border-wos-border pt-1 text-text-secondary">
                                <div>死亡: {d.results.lastRun.aCasualty.dead.toLocaleString()}</div>
                                <div>重傷: {d.results.lastRun.aCasualty.severeWound.toLocaleString()}</div>
                                <div>軽傷: {d.results.lastRun.aCasualty.lightWound.toLocaleString()}</div>
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 font-bold text-def-blue">防御側残存</div>
                              <div>盾: {d.results.lastRun.dTroopsLeft.shield.toLocaleString()}</div>
                              <div>槍: {d.results.lastRun.dTroopsLeft.spear.toLocaleString()}</div>
                              <div>弓: {d.results.lastRun.dTroopsLeft.bow.toLocaleString()}</div>
                              <div className="mt-1 border-t border-wos-border pt-1 text-text-secondary">
                                <div>死亡: {d.results.lastRun.dCasualty.dead.toLocaleString()}</div>
                                <div>重傷: {d.results.lastRun.dCasualty.severeWound.toLocaleString()}</div>
                                <div>軽傷: {d.results.lastRun.dCasualty.lightWound.toLocaleString()}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Open in Simulator button */}
                      <button
                        onClick={() => handleOpenInSimulator(selectedSim)}
                        className="w-full rounded-lg bg-gradient-to-r from-gold to-gold-light px-4 py-3 text-sm font-bold text-white shadow transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        この設定でシミュレーターを開く
                      </button>
                    </div>
                  );
                })() : (
                  <div className="rounded-lg border border-dashed border-wos-border p-6 text-center text-sm text-text-muted">
                    この履歴には詳細データがありません（旧バージョンで保存されたデータ）
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Tab: Participants                                                  */}
      {/* ================================================================= */}
      {activeTab === 'participants' && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary">
              SVS応募者管理
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({participants.length}名)
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportParticipantsCSV}
                disabled={participants.length === 0}
                className="rounded-lg border border-wos-border bg-wos-dark px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white disabled:opacity-40"
              >
                CSV出力
              </button>
              <button
                onClick={handleClearParticipants}
                disabled={participants.length === 0}
                className="rounded-lg border border-atk-red/30 bg-atk-red/5 px-3 py-1.5 text-xs font-medium text-atk-red transition-colors hover:bg-atk-red/10 disabled:opacity-40"
              >
                全削除
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-wos-border bg-wos-dark p-3 text-center">
              <div className="text-2xl font-bold text-def-blue">{participants.length}</div>
              <div className="text-[10px] text-text-muted">総応募者数</div>
            </div>
            <div className="rounded-lg border border-wos-border bg-wos-dark p-3 text-center">
              <div className="text-2xl font-bold text-ice-blue">
                {new Set(participants.map((p) => p.alliance)).size}
              </div>
              <div className="text-[10px] text-text-muted">同盟数</div>
            </div>
            <div className="rounded-lg border border-wos-border bg-wos-dark p-3 text-center">
              <div className="text-2xl font-bold text-gold">
                {rewards.reduce((a, r) => a + r.quantity, 0)}
              </div>
              <div className="text-[10px] text-text-muted">報酬総数</div>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto rounded-lg border border-wos-border">
            {participants.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">応募者がいません</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-wos-dark">
                  <tr className="text-xs font-bold text-text-secondary">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">キャラクター名</th>
                    <th className="px-3 py-2">同盟名</th>
                    <th className="px-3 py-2">応募日時</th>
                    <th className="px-3 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => (
                    <tr key={p.id} className="border-t border-wos-border/50">
                      <td className="px-3 py-2 text-xs text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-text-primary">{p.name}</td>
                      <td className="px-3 py-2 text-text-secondary">{p.alliance}</td>
                      <td className="px-3 py-2 text-xs text-text-muted">{formatDate(p.registeredAt)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDeleteParticipant(p.id)}
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

      {/* ================================================================= */}
      {/* Tab: Rewards                                                       */}
      {/* ================================================================= */}
      {activeTab === 'rewards' && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-4 text-base font-bold text-text-primary">SVS報酬設定</h3>

          {/* 締切設定 */}
          <div className="mb-4 rounded-lg border border-ice-blue/30 bg-ice-blue/5 p-4">
            <div className="mb-3 text-xs font-bold text-ice-blue">応募締切設定</div>
            {currentDeadline && (
              <div className="mb-3 rounded-lg border border-def-blue/30 bg-def-blue/10 px-3 py-2 text-sm text-def-blue">
                現在の締切: <span className="font-bold">{deadlineDisplay}</span>
                {new Date(currentDeadline).getTime() < Date.now() && (
                  <span className="ml-2 text-xs text-atk-red">(締切済み)</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-text-secondary">日付</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-def-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-text-secondary">時刻</label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-def-blue"
                />
              </div>
              <button
                onClick={handleSetDeadline}
                disabled={!deadlineDate}
                className="rounded-lg bg-def-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-def-blue-light disabled:opacity-40"
              >
                締切を設定
              </button>
              {currentDeadline && (
                <button
                  onClick={handleClearDeadline}
                  className="rounded-lg border border-atk-red/30 bg-atk-red/5 px-4 py-2 text-sm font-medium text-atk-red transition-colors hover:bg-atk-red/10"
                >
                  締切を解除
                </button>
              )}
            </div>
          </div>

          {/* プリセット */}
          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-3">
            <div className="mb-2 text-xs font-bold text-gold-dark">📦 プリセット（報酬を一括登録）</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (!confirm('現在の報酬を全て削除してプリセットに置き換えますか？')) return;
                  // 全削除
                  for (const r of rewards) { await apiDeleteReward(r.id); }
                  // 追加
                  await apiAddReward('将軍表彰', 'S', 2);
                  await apiAddReward('士官表彰', 'A', 10);
                  await apiAddReward('兵士表彰', 'B', 50);
                  const fresh = await getRewards();
                  setRewards(fresh);
                }}
                className="rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
              >
                👑 完全支配
              </button>
              <button
                onClick={async () => {
                  if (!confirm('現在の報酬を全て削除してプリセットに置き換えますか？')) return;
                  for (const r of rewards) { await apiDeleteReward(r.id); }
                  await apiAddReward('将軍表彰', 'S', 1);
                  await apiAddReward('士官表彰', 'A', 5);
                  await apiAddReward('兵士表彰', 'B', 25);
                  const fresh = await getRewards();
                  setRewards(fresh);
                }}
                className="rounded-lg bg-gradient-to-r from-ice-blue to-def-blue px-4 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105"
              >
                ⚔️ 通常支配
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-text-muted">完全支配: S×2 A×10 B×50 ／ 通常支配: S×1 A×5 B×25</div>
          </div>

          {/* Add/Edit form */}
          <div className="mb-5 rounded-lg border border-wos-border bg-wos-dark p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={newRewardName}
                onChange={(e) => setNewRewardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddOrUpdateReward()}
                placeholder="報酬名"
                className="min-w-0 flex-1 rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-def-blue"
              />
              <input
                type="number"
                min={1}
                max={99}
                value={newRewardQty}
                onChange={(e) => setNewRewardQty(Number(e.target.value) || 1)}
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
                onClick={handleAddOrUpdateReward}
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
              <p className="py-10 text-center text-sm text-text-muted">報酬が設定されていません</p>
            ) : (
              rewards.map((r, idx) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${TIER_BG[r.tier] || 'border-wos-border bg-white'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveReward(r.id, -1)}
                      disabled={idx === 0}
                      className="text-[10px] text-text-muted hover:text-text-primary disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveReward(r.id, 1)}
                      disabled={idx === rewards.length - 1}
                      className="text-[10px] text-text-muted hover:text-text-primary disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${TIER_BADGE[r.tier]}`}>
                    {r.tier}
                  </span>
                  <span className="flex-1 text-sm font-medium text-text-primary">{r.name}</span>
                  <span className="text-xs text-text-muted">x{r.quantity}</span>
                  <button
                    onClick={() => startEditReward(r)}
                    className="text-xs text-def-blue hover:underline"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteReward(r.id)}
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

      {/* ================================================================= */}
      {/* Tab: Draw                                                          */}
      {/* ================================================================= */}
      {activeTab === 'draw' && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-4 text-base font-bold text-text-primary">SVS抽選実行</h3>

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
              <p>応募者: {participants.length}名</p>
              <p>
                報酬: {rewards.length}種（計 {rewards.reduce((a, r) => a + r.quantity, 0)}個）
              </p>
              <p className="mt-1 text-text-muted">
                全Tier均等抽選。上位Tierから順に抽選し、同一人物の重複当選はありません。
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDraw}
                disabled={participants.length === 0 || rewards.length === 0 || isDrawing}
                className="btn-gold-shine rounded-xl bg-gradient-to-r from-gold to-gold-light px-8 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
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

            {/* Result preview */}
            {result && (
              <div className="rounded-lg border border-wos-border bg-wos-dark p-4">
                <div className="mb-3 text-xs font-bold text-text-secondary">
                  抽選結果（Seed: {result.seed}）
                </div>
                <div className="max-h-[400px] space-y-1 overflow-y-auto">
                  {result.winners.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gold-dark">#{i + 1}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_BADGE[w.reward.tier]}`}>
                          {w.reward.tier}
                        </span>
                        <span className="text-text-primary">{w.reward.name}</span>
                      </div>
                      <div className="text-text-secondary">
                        {w.participant.name}（{w.participant.alliance}）
                      </div>
                    </div>
                  ))}
                </div>
                {participants.length > result.winners.length && (
                  <div className="mt-2 border-t border-wos-border pt-2 text-xs text-text-muted">
                    未当選: {participants.length - result.winners.length}名
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Tab: Counter Analyses                                              */}
      {/* ================================================================= */}
      {activeTab === 'counter' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gold/30 bg-gradient-to-br from-gold/5 to-gold-light/5 p-4 text-center">
              <div className="text-3xl font-bold text-gold-dark">
                {counterStats?.total || 0}
              </div>
              <div className="text-[10px] font-bold text-text-muted">総解析数</div>
            </div>
            <div className="rounded-lg border border-gold/30 bg-gradient-to-br from-gold/5 to-gold-light/5 p-4 text-center">
              <div className="text-3xl font-bold text-gold-dark">
                {counterStats?.avgWinRate
                  ? `${(counterStats.avgWinRate * 100).toFixed(1)}%`
                  : '-'}
              </div>
              <div className="text-[10px] font-bold text-text-muted">平均勝率</div>
            </div>
            <div className="rounded-lg border border-gold/30 bg-gradient-to-br from-gold/5 to-gold-light/5 p-4 text-center">
              <div className="text-3xl font-bold text-gold-dark">
                {counterStats?.topEnemyHeroes?.[0]?.name || '-'}
              </div>
              <div className="text-[10px] font-bold text-text-muted">最頻敵リーダー</div>
            </div>
          </div>

          {/* Top Enemy Heroes Ranking */}
          {counterStats && counterStats.topEnemyHeroes.length > 0 && (
            <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
              <h3 className="mb-3 text-sm font-bold text-text-primary">
                最も遭遇する敵リーダー Top5
              </h3>
              <div className="space-y-2">
                {counterStats.topEnemyHeroes.slice(0, 5).map((hero, idx) => (
                  <div
                    key={hero.name}
                    className="flex items-center gap-3 rounded-lg border border-wos-border bg-wos-dark px-3 py-2"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        idx === 0
                          ? 'bg-gold text-white'
                          : idx === 1
                            ? 'bg-gray-300 text-gray-700'
                            : 'bg-wos-border text-text-secondary'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-text-primary">
                      {hero.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-ice-blue/60"
                        style={{
                          width: `${Math.max(20, (hero.count / (counterStats.topEnemyHeroes[0]?.count || 1)) * 100)}px`,
                        }}
                      />
                      <span className="text-xs font-bold text-text-secondary">
                        {hero.count}回
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Counter Formations Ranking */}
          {topCounters.length > 0 && (
            <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
              <h3 className="mb-3 text-sm font-bold text-text-primary">
                最も効果的なカウンター編成 Top5
              </h3>
              <div className="space-y-2">
                {topCounters.slice(0, 5).map((f, idx) => (
                  <div
                    key={f.formation}
                    className="flex items-center gap-3 rounded-lg border border-wos-border bg-wos-dark px-3 py-2"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        idx === 0
                          ? 'bg-gold text-white'
                          : idx === 1
                            ? 'bg-gray-300 text-gray-700'
                            : 'bg-wos-border text-text-secondary'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-text-primary">
                      {f.formation}
                    </span>
                    <span className="text-xs text-text-muted">
                      {f.count}回使用
                    </span>
                    <span className="text-xs font-bold text-bow-green">
                      平均{(f.winRate * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Detail Modal */}
          {selectedAnalysis && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-wos-border bg-wos-panel p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-text-primary">
                    解析詳細
                  </h3>
                  <button
                    onClick={() => setSelectedAnalysis(null)}
                    className="rounded-lg bg-wos-dark px-3 py-1 text-xs text-text-secondary hover:bg-white"
                  >
                    閉じる
                  </button>
                </div>

                {/* Enemy formation */}
                <div className="mb-4 rounded-lg border border-wos-border bg-wos-dark p-3">
                  <div className="mb-2 text-xs font-bold text-text-secondary">
                    敵編成
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-[10px] text-text-muted">盾:</span>{' '}
                      <span className="font-bold">
                        {selectedAnalysis.enemy_shield_hero || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted">槍:</span>{' '}
                      <span className="font-bold">
                        {selectedAnalysis.enemy_spear_hero || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted">弓:</span>{' '}
                      <span className="font-bold">
                        {selectedAnalysis.enemy_bow_hero || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-muted">
                    兵比: 盾{selectedAnalysis.enemy_troops_shield}% / 槍
                    {selectedAnalysis.enemy_troops_spear}% / 弓
                    {selectedAnalysis.enemy_troops_bow}%
                    {selectedAnalysis.enemy_total_troops &&
                      ` / 総兵数: ${selectedAnalysis.enemy_total_troops.toLocaleString()}`}
                  </div>
                </div>

                {/* Meta */}
                <div className="mb-4 text-xs text-text-muted">
                  <div>解析元: {selectedAnalysis.analyzed_by}</div>
                  {selectedAnalysis.submitted_by && (
                    <div>投稿者: {selectedAnalysis.submitted_by}</div>
                  )}
                  {selectedAnalysis.notes && (
                    <div>メモ: {selectedAnalysis.notes}</div>
                  )}
                </div>

                {/* Counter results Top 5 */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-text-secondary">
                    カウンター提案 Top5
                  </div>
                  {(selectedAnalysis.counter_results || [])
                    .slice(0, 5)
                    .map((cr, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg border px-3 py-2 ${
                          idx === 0
                            ? 'border-gold/40 bg-gold/5'
                            : 'border-wos-border bg-wos-dark'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-primary">
                            #{cr.rank || idx + 1}
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              cr.winRate >= 0.7
                                ? 'text-bow-green'
                                : cr.winRate >= 0.4
                                  ? 'text-gold-dark'
                                  : 'text-atk-red'
                            }`}
                          >
                            {(cr.winRate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-text-secondary">
                          {cr.leaders?.shield || '-'} / {cr.leaders?.spear || '-'}{' '}
                          / {cr.leaders?.bow || '-'}
                        </div>
                        {cr.troopRatio && (
                          <div className="mt-1 flex h-3 overflow-hidden rounded-full">
                            <div
                              className="bg-shield-blue/60"
                              style={{ width: `${cr.troopRatio.shield}%` }}
                            />
                            <div
                              className="bg-spear-orange/60"
                              style={{ width: `${cr.troopRatio.spear}%` }}
                            />
                            <div
                              className="bg-bow-green/60"
                              style={{ width: `${cr.troopRatio.bow}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Analysis Table */}
          <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">
                解析一覧
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({counterAnalyses.length}件)
                </span>
              </h3>
            </div>
            <div className="max-h-[500px] overflow-auto rounded-lg border border-wos-border">
              {counterAnalyses.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">
                  解析履歴がありません
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-wos-dark">
                    <tr className="text-xs font-bold text-text-secondary">
                      <th className="px-3 py-2">日時</th>
                      <th className="px-3 py-2">敵編成</th>
                      <th className="px-3 py-2">兵比</th>
                      <th className="px-3 py-2 text-center">最高勝率</th>
                      <th className="px-3 py-2 text-center">解析元</th>
                      <th className="px-3 py-2">投稿者</th>
                      <th className="px-3 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterAnalyses.map((a) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer border-t border-wos-border/50 transition-colors hover:bg-ice-blue/5"
                        onClick={() => setSelectedAnalysis(a)}
                      >
                        <td className="px-3 py-2 text-xs text-text-muted">
                          {formatDate(a.created_at)}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-text-primary">
                          {[
                            a.enemy_shield_hero,
                            a.enemy_spear_hero,
                            a.enemy_bow_hero,
                          ]
                            .filter(Boolean)
                            .join(' / ') || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex h-2 w-16 overflow-hidden rounded-full">
                            <div
                              className="bg-shield-blue/60"
                              style={{ width: `${a.enemy_troops_shield}%` }}
                            />
                            <div
                              className="bg-spear-orange/60"
                              style={{ width: `${a.enemy_troops_spear}%` }}
                            />
                            <div
                              className="bg-bow-green/60"
                              style={{ width: `${a.enemy_troops_bow}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {a.best_win_rate !== null ? (
                            <span
                              className={`text-xs font-bold ${
                                a.best_win_rate >= 0.7
                                  ? 'text-bow-green'
                                  : a.best_win_rate >= 0.4
                                    ? 'text-gold-dark'
                                    : 'text-atk-red'
                              }`}
                            >
                              {(a.best_win_rate * 100).toFixed(1)}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              a.analyzed_by === 'gemini'
                                ? 'bg-purple-100 text-purple-700'
                                : a.analyzed_by === 'claude'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {a.analyzed_by}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-text-secondary">
                          {a.submitted_by || '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('この解析履歴を削除しますか？')) {
                                deleteAnalysis(a.id).then(() => {
                                  setCounterAnalyses((prev) =>
                                    prev.filter((x) => x.id !== a.id),
                                  );
                                });
                              }
                            }}
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
        </div>
      )}

      {/* ================================================================= */}
      {/* Tab: API Keys                                                      */}
      {/* ================================================================= */}
      {activeTab === 'apikeys' && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-4 text-base font-bold text-text-primary">⚙️ API設定</h3>
          <p className="mb-4 text-xs text-text-muted">
            カウンター提案機能の画像解析に使用するAPIキーを設定します。
            Gemini → Claude の二段構えで解析します。
          </p>

          {/* Gemini API Key */}
          <div className="mb-4 rounded-lg border border-wos-border bg-wos-dark p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm">🔮</span>
              <span className="text-sm font-bold text-text-primary">Gemini API Key</span>
              <span className="text-[10px] text-text-muted">（1次解析・高速・低コスト）</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                defaultValue={typeof window !== 'undefined' ? localStorage.getItem('wos_gemini_api_key') || '' : ''}
                id="gemini-key-input"
                className="flex-1 rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-gold/50"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('gemini-key-input') as HTMLInputElement;
                  if (input?.value) {
                    localStorage.setItem('wos_gemini_api_key', input.value);
                    alert('Gemini APIキーを保存しました');
                  }
                }}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white"
              >
                保存
              </button>
            </div>
            <div className="mt-1 text-[10px] text-text-muted">
              取得: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-def-blue underline">Google AI Studio</a>
            </div>
          </div>

          {/* Claude API Key */}
          <div className="mb-4 rounded-lg border border-wos-border bg-wos-dark p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm">🧠</span>
              <span className="text-sm font-bold text-text-primary">Claude API Key</span>
              <span className="text-[10px] text-text-muted">（2次解析・高精度・フォールバック）</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="sk-ant-api03-..."
                defaultValue={typeof window !== 'undefined' ? localStorage.getItem('wos_claude_api_key') || '' : ''}
                id="claude-key-input"
                className="flex-1 rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-gold/50"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('claude-key-input') as HTMLInputElement;
                  if (input?.value) {
                    localStorage.setItem('wos_claude_api_key', input.value);
                    alert('Claude APIキーを保存しました');
                  }
                }}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-white"
              >
                保存
              </button>
            </div>
            <div className="mt-1 text-[10px] text-text-muted">
              取得: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-def-blue underline">Anthropic Console</a>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border border-wos-border bg-white/50 p-3">
            <div className="text-xs font-bold text-text-primary mb-2">現在の設定状態</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span>{typeof window !== 'undefined' && localStorage.getItem('wos_gemini_api_key') ? '✅' : '❌'}</span>
                <span>Gemini API Key: {typeof window !== 'undefined' && localStorage.getItem('wos_gemini_api_key') ? '設定済み' : '未設定'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{typeof window !== 'undefined' && localStorage.getItem('wos_claude_api_key') ? '✅' : '❌'}</span>
                <span>Claude API Key: {typeof window !== 'undefined' && localStorage.getItem('wos_claude_api_key') ? '設定済み' : '未設定'}</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-text-muted">
              解析順序: Gemini（高速）→ 失敗時 Claude（高精度）にフォールバック
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
