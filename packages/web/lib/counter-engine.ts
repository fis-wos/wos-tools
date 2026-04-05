/**
 * WOS Counter Formation Engine
 *
 * Finds optimal counter formations against a given enemy setup
 * by iterating through hero combinations and simulating battles.
 */

import { HEROES, type Hero, type TroopType } from './engine/heroes';
import {
  runSimulation,
  type SimConfig,
  type TroopCount,
} from './engine/battle-engine';
import {
  calcHeroStats,
  type TroopStats,
  type HeroConfig,
} from './engine/hero-stats';
import type { TroopTier } from './engine/troop-skills';

export interface CounterResult {
  rank: number;
  leaders: { shield: Hero; spear: Hero; bow: Hero };
  riders: Hero[];
  troopRatio: { shield: number; spear: number; bow: number };
  winRate: number;
  avgTurns: number;
  avgLossRate: number;
}

/** Default hero config for counter engine simulations */
function defaultHeroConfig(): HeroConfig {
  return {
    heroLv: 80,
    gearLv: 30,
    refine: { goggle: 5, glove: 5, belt: 5, boots: 5 },
    charm: { goggle: 10, glove: 10, belt: 10, boots: 10 },
  };
}

/** Build TroopStats array from leaders */
function buildHeroStats(leaders: Hero[], isAtk: boolean): TroopStats[] {
  const config = defaultHeroConfig();
  const entries = leaders.map((hero) => ({ hero, config }));
  if (entries.length === 0) {
    return [
      { atk: 500, def: 500, leth: 100, hp: 100 },
      { atk: 500, def: 500, leth: 100, hp: 100 },
      { atk: 500, def: 500, leth: 100, hp: 100 },
    ];
  }
  return calcHeroStats(entries, isAtk);
}

/** Troop ratio presets to test (must sum to 100) */
const RATIO_PRESETS: { shield: number; spear: number; bow: number }[] = [
  { shield: 40, spear: 30, bow: 30 },
  { shield: 30, spear: 40, bow: 30 },
  { shield: 30, spear: 30, bow: 40 },
  { shield: 50, spear: 25, bow: 25 },
  { shield: 25, spear: 50, bow: 25 },
  { shield: 25, spear: 25, bow: 50 },
  { shield: 34, spear: 33, bow: 33 },
];

/**
 * Progress callback type for UI updates.
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Find the best counter formations against a given enemy setup.
 *
 * Uses chunked async execution to avoid blocking the UI thread.
 *
 * @param enemyLeaders - Enemy leader heroes (up to 3)
 * @param enemyRiders - Enemy rider heroes
 * @param enemyTroops - Enemy troop counts
 * @param availableHeroes - Heroes available to the player
 * @param totalTroops - Total troop count for counter side
 * @param trials - Number of simulation runs per combination
 * @param onProgress - Progress callback
 * @param troopTier - Troop tier (default: 11)
 * @returns Top counter formations sorted by win rate
 */
export async function findCounterFormations(
  enemyLeaders: Hero[],
  enemyRiders: Hero[],
  enemyTroops: TroopCount,
  availableHeroes: Hero[],
  totalTroops: number = 1800000,
  trials: number = 30,
  onProgress?: ProgressCallback,
  troopTier: TroopTier = 11
): Promise<CounterResult[]> {
  // Classify available heroes by troop type
  const byType: Record<TroopType, Hero[]> = { shield: [], spear: [], bow: [] };
  for (const h of availableHeroes) {
    // Only use SSR heroes as leaders
    if (h.r === 'SSR') {
      byType[h.t].push(h);
    }
  }

  // If any type has no heroes, we can't form a complete leader set — use partial
  const shieldPool = byType.shield.length > 0 ? byType.shield : [null];
  const spearPool = byType.spear.length > 0 ? byType.spear : [null];
  const bowPool = byType.bow.length > 0 ? byType.bow : [null];

  // Generate all leader combinations
  type LeaderCombo = {
    shield: Hero | null;
    spear: Hero | null;
    bow: Hero | null;
  };
  const combos: LeaderCombo[] = [];
  for (const s of shieldPool) {
    for (const sp of spearPool) {
      for (const b of bowPool) {
        // Ensure no duplicate heroes
        const ids = new Set(
          [s, sp, b].filter((h): h is Hero => h !== null).map((h) => h.id)
        );
        const count = [s, sp, b].filter((h) => h !== null).length;
        if (ids.size === count) {
          combos.push({ shield: s, spear: sp, bow: b });
        }
      }
    }
  }

  // Limit combinations to avoid excessive computation
  // Pick top heroes per type by generation (higher gen = better)
  const MAX_COMBOS = 200;
  let effectiveCombos = combos;
  if (combos.length > MAX_COMBOS) {
    // Sort heroes by generation and limit per type
    const topN = 4;
    const topShield = byType.shield
      .sort((a, b) => b.g - a.g)
      .slice(0, topN);
    const topSpear = byType.spear
      .sort((a, b) => b.g - a.g)
      .slice(0, topN);
    const topBow = byType.bow.sort((a, b) => b.g - a.g).slice(0, topN);

    effectiveCombos = [];
    for (const s of topShield.length > 0 ? topShield : [null]) {
      for (const sp of topSpear.length > 0 ? topSpear : [null]) {
        for (const b of topBow.length > 0 ? topBow : [null]) {
          const ids = new Set(
            [s, sp, b]
              .filter((h): h is Hero => h !== null)
              .map((h) => h.id)
          );
          const count = [s, sp, b].filter((h) => h !== null).length;
          if (ids.size === count) {
            effectiveCombos.push({ shield: s, spear: sp, bow: b });
          }
        }
      }
    }
  }

  // Build enemy hero stats
  const enemyHeroStats = buildHeroStats(enemyLeaders, false);

  // Test each combination with each ratio preset
  const totalTasks = effectiveCombos.length * RATIO_PRESETS.length;
  let completed = 0;

  type TaskResult = {
    combo: LeaderCombo;
    ratio: { shield: number; spear: number; bow: number };
    winRate: number;
    avgTurns: number;
    avgLossRate: number;
  };

  const results: TaskResult[] = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < effectiveCombos.length; i += CHUNK_SIZE) {
    // Yield to UI thread between chunks
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const chunk = effectiveCombos.slice(i, i + CHUNK_SIZE);
    for (const combo of chunk) {
      const leaders = [combo.shield, combo.spear, combo.bow].filter(
        (h): h is Hero => h !== null
      );
      const atkHeroStats = buildHeroStats(leaders, true);

      for (const ratio of RATIO_PRESETS) {
        const ratioSum = ratio.shield + ratio.spear + ratio.bow;
        const atkTroops: TroopCount = {
          shield: Math.round((totalTroops * ratio.shield) / ratioSum),
          spear: Math.round((totalTroops * ratio.spear) / ratioSum),
          bow: Math.round((totalTroops * ratio.bow) / ratioSum),
        };

        const config: SimConfig = {
          aTroops: atkTroops,
          dTroops: enemyTroops,
          aHeroStats: atkHeroStats,
          dHeroStats: enemyHeroStats,
          aLeaders: leaders,
          aRiders: [],
          dLeaders: enemyLeaders,
          dRiders: enemyRiders,
          aTroopTier: troopTier,
          dTroopTier: troopTier,
          runs: trials,
        };

        const simResult = runSimulation(config);

        results.push({
          combo,
          ratio,
          winRate: simResult.atkWins / simResult.runs,
          avgTurns: simResult.avgTurns,
          avgLossRate: simResult.avgAtkLossRate,
        });

        completed++;
      }
    }

    if (onProgress) {
      onProgress(completed, totalTasks);
    }
  }

  // Sort by win rate (descending), then by loss rate (ascending)
  results.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return a.avgLossRate - b.avgLossRate;
  });

  // Deduplicate: keep the best ratio for each leader combo
  const seen = new Set<string>();
  const top: CounterResult[] = [];

  for (const r of results) {
    const key = [
      r.combo.shield?.id || '_',
      r.combo.spear?.id || '_',
      r.combo.bow?.id || '_',
    ].join('-');

    if (seen.has(key)) continue;
    seen.add(key);

    top.push({
      rank: top.length + 1,
      leaders: {
        shield: r.combo.shield!,
        spear: r.combo.spear!,
        bow: r.combo.bow!,
      },
      riders: [],
      troopRatio: r.ratio,
      winRate: r.winRate,
      avgTurns: r.avgTurns,
      avgLossRate: r.avgLossRate,
    });

    if (top.length >= 5) break;
  }

  return top;
}
