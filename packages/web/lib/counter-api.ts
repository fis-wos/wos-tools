import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CounterAnalysis {
  id: string;
  analyzed_by: string;
  enemy_shield_hero: string | null;
  enemy_spear_hero: string | null;
  enemy_bow_hero: string | null;
  enemy_riders: string[];
  enemy_troops_shield: number;
  enemy_troops_spear: number;
  enemy_troops_bow: number;
  enemy_total_troops: number | null;
  enemy_stats: Record<string, number> | null;
  counter_results: CounterResultRow[];
  best_win_rate: number | null;
  submitted_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CounterResultRow {
  rank: number;
  leaders: { shield?: string; spear?: string; bow?: string };
  riders: string[];
  troopRatio: { shield: number; spear: number; bow: number };
  winRate: number;
  avgTurns?: number;
  avgLossRate?: number;
}

export interface AnalysisStats {
  total: number;
  topEnemyHeroes: { name: string; count: number }[];
  avgWinRate: number;
  recentTrend: CounterAnalysis[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCounterTableAvailable(): boolean {
  // We'll just try and catch errors
  return true;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function saveAnalysis(
  data: Omit<CounterAnalysis, 'id' | 'created_at'>,
): Promise<void> {
  try {
    const { error } = await supabase.from('counter_analyses').insert({
      analyzed_by: data.analyzed_by,
      enemy_shield_hero: data.enemy_shield_hero,
      enemy_spear_hero: data.enemy_spear_hero,
      enemy_bow_hero: data.enemy_bow_hero,
      enemy_riders: data.enemy_riders,
      enemy_troops_shield: data.enemy_troops_shield,
      enemy_troops_spear: data.enemy_troops_spear,
      enemy_troops_bow: data.enemy_troops_bow,
      enemy_total_troops: data.enemy_total_troops,
      enemy_stats: data.enemy_stats,
      counter_results: data.counter_results,
      best_win_rate: data.best_win_rate,
      submitted_by: data.submitted_by,
      notes: data.notes,
    });
    if (error) {
      console.error('Failed to save counter analysis:', error);
    }
  } catch (err) {
    console.error('Failed to save counter analysis:', err);
  }
}

export async function getAnalyses(limit = 100): Promise<CounterAnalysis[]> {
  try {
    const { data, error } = await supabase
      .from('counter_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch counter analyses:', error);
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      analyzed_by: (row.analyzed_by as string) || 'gemini',
      enemy_shield_hero: row.enemy_shield_hero as string | null,
      enemy_spear_hero: row.enemy_spear_hero as string | null,
      enemy_bow_hero: row.enemy_bow_hero as string | null,
      enemy_riders: (row.enemy_riders as string[]) || [],
      enemy_troops_shield: (row.enemy_troops_shield as number) || 0,
      enemy_troops_spear: (row.enemy_troops_spear as number) || 0,
      enemy_troops_bow: (row.enemy_troops_bow as number) || 0,
      enemy_total_troops: row.enemy_total_troops as number | null,
      enemy_stats: row.enemy_stats as Record<string, number> | null,
      counter_results: (row.counter_results as CounterResultRow[]) || [],
      best_win_rate: row.best_win_rate as number | null,
      submitted_by: row.submitted_by as string | null,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
    }));
  } catch (err) {
    console.error('Failed to fetch counter analyses:', err);
    return [];
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('counter_analyses')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Failed to delete counter analysis:', error);
    }
  } catch (err) {
    console.error('Failed to delete counter analysis:', err);
  }
}

export async function getAnalysisStats(): Promise<AnalysisStats> {
  const defaultStats: AnalysisStats = {
    total: 0,
    topEnemyHeroes: [],
    avgWinRate: 0,
    recentTrend: [],
  };

  try {
    const analyses = await getAnalyses(500);
    if (analyses.length === 0) return defaultStats;

    // Total
    const total = analyses.length;

    // Average win rate
    const withWinRate = analyses.filter((a) => a.best_win_rate !== null);
    const avgWinRate =
      withWinRate.length > 0
        ? withWinRate.reduce((sum, a) => sum + (a.best_win_rate || 0), 0) /
          withWinRate.length
        : 0;

    // Top enemy heroes
    const heroCounts = new Map<string, number>();
    for (const a of analyses) {
      for (const name of [
        a.enemy_shield_hero,
        a.enemy_spear_hero,
        a.enemy_bow_hero,
      ]) {
        if (name) {
          heroCounts.set(name, (heroCounts.get(name) || 0) + 1);
        }
      }
    }
    const topEnemyHeroes = Array.from(heroCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent trend
    const recentTrend = analyses.slice(0, 20);

    return { total, topEnemyHeroes, avgWinRate, recentTrend };
  } catch (err) {
    console.error('Failed to get analysis stats:', err);
    return defaultStats;
  }
}

export async function getTopCounterFormations(): Promise<
  { formation: string; winRate: number; count: number }[]
> {
  try {
    const analyses = await getAnalyses(500);
    const formationMap = new Map<
      string,
      { totalWinRate: number; count: number }
    >();

    for (const a of analyses) {
      if (a.counter_results.length === 0) continue;
      const best = a.counter_results[0];
      if (!best.leaders) continue;
      const key = [
        best.leaders.shield || '-',
        best.leaders.spear || '-',
        best.leaders.bow || '-',
      ].join(' / ');
      const existing = formationMap.get(key) || {
        totalWinRate: 0,
        count: 0,
      };
      existing.totalWinRate += best.winRate;
      existing.count += 1;
      formationMap.set(key, existing);
    }

    return Array.from(formationMap.entries())
      .map(([formation, { totalWinRate, count }]) => ({
        formation,
        winRate: totalWinRate / count,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch (err) {
    console.error('Failed to get top counter formations:', err);
    return [];
  }
}
