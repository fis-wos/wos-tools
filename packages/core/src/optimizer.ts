/**
 * WOS Battle Simulator - Optimizer
 *
 * Generates troop ratio grids and leader combinations,
 * then brute-forces optimal configurations via simulation.
 */

import {
  type Hero,
  type TroopType,
  HEROES,
  getHeroById,
} from '@wos-tools/data';
import {
  type HeroConfig,
  type TroopStats,
  calcHeroStats,
} from './hero-stats';
import {
  type TroopCount,
  type SimAggregateResult,
  runSimulation,
} from './battle-engine';

// ── Types ──

/** A ratio tuple [shield%, spear%, bow%] summing to 1.0 */
export type TroopRatio = [number, number, number];

/** Leader combination: [shieldHeroId, spearHeroId, bowHeroId] */
export type LeaderCombo = [string, string, string];

/** Result for a single optimization candidate */
export interface OptimizeCandidate {
  leaders: LeaderCombo;
  riders: string[];
  ratio: TroopRatio;
  troops: TroopCount;
  simResult: SimAggregateResult;
  score: number;
}

/** Optimization configuration */
export interface OptimizeConfig {
  /** Total troops available */
  totalTroops: number;
  /** Enemy troop counts */
  enemyTroops: TroopCount;
  /** Hero configuration for all heroes */
  heroConfig: HeroConfig;
  /** Fixed shield leader ID (optional) */
  fixSh?: string;
  /** Fixed spear leader ID (optional) */
  fixSp?: string;
  /** Fixed bow leader ID (optional) */
  fixBo?: string;
  /** Mode: 'atk' or 'def' */
  mode: 'atk' | 'def';
  /** Number of simulation runs per candidate */
  simRuns?: number;
  /** Enemy hero stats (pre-computed) */
  enemyHeroStats: TroopStats[];
  /** Enemy leaders */
  enemyLeaders: Hero[];
  /** Enemy riders */
  enemyRiders: Hero[];
}

/** Full optimization result */
export interface OptimizeResult {
  candidates: OptimizeCandidate[];
  best: OptimizeCandidate | null;
  totalCombinations: number;
  elapsed: number;
}

// ── Ratio generation ──

/**
 * Generate all troop ratio combinations at 10% increments.
 * Each component is 0.0 to 1.0 in steps of 0.1,
 * and the three components must sum to 1.0.
 */
export function genRatios(): TroopRatio[] {
  const ratios: TroopRatio[] = [];
  for (let sh = 0; sh <= 10; sh++) {
    for (let sp = 0; sp <= 10 - sh; sp++) {
      const bo = 10 - sh - sp;
      ratios.push([sh / 10, sp / 10, bo / 10]);
    }
  }
  return ratios;
}

// ── Leader combination generation ──

/**
 * Generate all valid leader combinations.
 * Each troop type needs exactly one leader.
 * If a fixed hero ID is provided for a slot, only that hero is considered.
 * No hero can appear in multiple slots.
 */
export function genLeaderCombos(
  fixSh?: string,
  fixSp?: string,
  fixBo?: string
): LeaderCombo[] {
  const shieldHeroes = fixSh
    ? [fixSh]
    : HEROES.filter((h) => h.t === 'shield' && h.r === 'SSR').map(
        (h) => h.id
      );
  const spearHeroes = fixSp
    ? [fixSp]
    : HEROES.filter((h) => h.t === 'spear' && h.r === 'SSR').map(
        (h) => h.id
      );
  const bowHeroes = fixBo
    ? [fixBo]
    : HEROES.filter((h) => h.t === 'bow' && h.r === 'SSR').map(
        (h) => h.id
      );

  const combos: LeaderCombo[] = [];
  for (const sh of shieldHeroes) {
    for (const sp of spearHeroes) {
      if (sp === sh) continue;
      for (const bo of bowHeroes) {
        if (bo === sh || bo === sp) continue;
        combos.push([sh, sp, bo]);
      }
    }
  }
  return combos;
}

// ── Rider auto-selection ──

/**
 * Automatically select the best riders given the leader IDs.
 * Riders are heroes not used as leaders, prioritizing:
 * 1. Synergy partners of the leaders
 * 2. Highest generation heroes
 *
 * @param leaderIds - The three leader hero IDs
 * @param mode - 'atk' or 'def' to determine synergy preference
 * @returns Array of rider hero IDs (up to 3)
 */
export function bestRiders(
  leaderIds: string[],
  mode: 'atk' | 'def'
): string[] {
  const leaderSet = new Set(leaderIds);
  const leaders = leaderIds
    .map((id) => getHeroById(id))
    .filter((h): h is Hero => h !== undefined);

  // Collect synergy partners
  const synergySet = new Set<string>();
  for (const leader of leaders) {
    const synergyList = mode === 'atk' ? leader.sa : leader.sd;
    for (const sid of synergyList) {
      if (!leaderSet.has(sid)) {
        synergySet.add(sid);
      }
    }
  }

  // Available heroes (not leaders, SSR only)
  const available = HEROES.filter(
    (h) => !leaderSet.has(h.id) && h.r === 'SSR'
  );

  // Sort: synergy partners first, then by generation descending
  available.sort((a, b) => {
    const aSyn = synergySet.has(a.id) ? 1 : 0;
    const bSyn = synergySet.has(b.id) ? 1 : 0;
    if (aSyn !== bSyn) return bSyn - aSyn;
    return b.g - a.g;
  });

  // Take up to 3 riders
  return available.slice(0, 3).map((h) => h.id);
}

// ── Optimization runner ──

/**
 * Run the full optimization: iterate over leader combos and troop ratios,
 * simulate each, and return the best configuration.
 */
export function runOptimize(config: OptimizeConfig): OptimizeResult {
  const startTime = Date.now();
  const ratios = genRatios();
  const combos = genLeaderCombos(config.fixSh, config.fixSp, config.fixBo);
  const isAtk = config.mode === 'atk';
  const simRuns = config.simRuns ?? 20;

  const candidates: OptimizeCandidate[] = [];
  const totalCombinations = combos.length * ratios.length;

  for (const combo of combos) {
    const [shId, spId, boId] = combo;
    const shHero = getHeroById(shId);
    const spHero = getHeroById(spId);
    const boHero = getHeroById(boId);
    if (!shHero || !spHero || !boHero) continue;

    const leaderHeroes = [shHero, spHero, boHero];
    const riderIds = bestRiders([shId, spId, boId], config.mode);
    const riderHeroes = riderIds
      .map((id) => getHeroById(id))
      .filter((h): h is Hero => h !== undefined);

    // Compute hero stats for this leader set
    const leaderConfigs = leaderHeroes.map((hero) => ({
      hero,
      config: config.heroConfig,
    }));
    const heroStats = calcHeroStats(leaderConfigs, isAtk);

    for (const ratio of ratios) {
      const [shR, spR, boR] = ratio;
      // Skip if a leader's troop type has 0 ratio
      if (shR === 0 || spR === 0 || boR === 0) continue;

      const troops: TroopCount = {
        shield: Math.round(config.totalTroops * shR),
        spear: Math.round(config.totalTroops * spR),
        bow: Math.round(config.totalTroops * boR),
      };

      const simResult = runSimulation({
        aTroops: isAtk ? troops : config.enemyTroops,
        dTroops: isAtk ? config.enemyTroops : troops,
        aHeroStats: isAtk ? heroStats : config.enemyHeroStats,
        dHeroStats: isAtk ? config.enemyHeroStats : heroStats,
        aLeaders: isAtk ? leaderHeroes : config.enemyLeaders,
        aRiders: isAtk ? riderHeroes : config.enemyRiders,
        dLeaders: isAtk ? config.enemyLeaders : leaderHeroes,
        dRiders: isAtk ? config.enemyRiders : riderHeroes,
        runs: simRuns,
      });

      // Score: win rate - own loss rate (higher is better)
      const winRate = isAtk
        ? simResult.atkWins / simResult.runs
        : simResult.defWins / simResult.runs;
      const ownLossRate = isAtk
        ? simResult.avgAtkLossRate
        : simResult.avgDefLossRate;
      const score = winRate - ownLossRate * 0.5;

      candidates.push({
        leaders: combo,
        riders: riderIds,
        ratio,
        troops,
        simResult,
        score,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return {
    candidates,
    best: candidates.length > 0 ? candidates[0] : null,
    totalCombinations,
    elapsed: Date.now() - startTime,
  };
}
