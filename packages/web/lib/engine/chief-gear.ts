/**
 * Chief Gear (領主装備) and Gem (宝石) data and calculations.
 *
 * Each gear tier provides ATK% and DEF% per piece.
 * There are 6 gear pieces, all with identical stats.
 * Total bonus = tier ATK% * 6.
 *
 * Gems provide lethality% and HP% bonuses per troop type.
 * All gem types (守護/生命/精鋭) share the same level-based values.
 */

/** Chief gear tier definition */
export interface ChiefGearTier {
  id: string;
  name: string;
  /** ATK% per piece */
  atk: number;
  /** DEF% per piece */
  def: number;
}

/** Gem level definition */
export interface GemLevel {
  lv: number;
  name: string;
  /** Lethality bonus % */
  leth: number;
  /** HP bonus % */
  hp: number;
}

/** Practical gear tiers for the UI dropdown */
export const CHIEF_GEAR_TIERS: ChiefGearTier[] = [
  { id: 'none', name: 'なし', atk: 0, def: 0 },
  { id: 'epic', name: 'エピック', atk: 34.00, def: 34.00 },
  { id: 'legend', name: 'レジェンド', atk: 56.78, def: 56.78 },
  { id: 'legend_t2_s3', name: 'レジェンドT2★3', atk: 85.00, def: 85.00 },
  { id: 'myth', name: '神話', atk: 89.25, def: 89.25 },
  { id: 'myth_t1', name: '神話T1', atk: 106.25, def: 106.25 },
  { id: 'myth_t2', name: '神話T2', atk: 123.25, def: 123.25 },
  { id: 'myth_t3', name: '神話T3', atk: 140.25, def: 140.25 },
  { id: 'myth_t4', name: '神話T4', atk: 161.50, def: 161.50 },
  { id: 'myth_t4_s1', name: '神話T4★1', atk: 170.00, def: 170.00 },
  { id: 'myth_t4_s2', name: '神話T4★2', atk: 178.50, def: 178.50 },
  { id: 'myth_t4_s3', name: '神話T4★3', atk: 187.00, def: 187.00 },
];

/** Gem levels (lethality + HP, same for all gem types) - all levels 0-16 */
export const GEM_LEVELS: GemLevel[] = [
  { lv: 0, name: 'なし', leth: 0, hp: 0 },
  { lv: 1, name: 'Lv1', leth: 9, hp: 9 },
  { lv: 2, name: 'Lv2', leth: 12, hp: 12 },
  { lv: 3, name: 'Lv3', leth: 16, hp: 16 },
  { lv: 4, name: 'Lv4', leth: 19, hp: 19 },
  { lv: 5, name: 'Lv5', leth: 25, hp: 25 },
  { lv: 6, name: 'Lv6', leth: 30, hp: 30 },
  { lv: 7, name: 'Lv7', leth: 35, hp: 35 },
  { lv: 8, name: 'Lv8', leth: 40, hp: 40 },
  { lv: 9, name: 'Lv9', leth: 45, hp: 45 },
  { lv: 10, name: 'Lv10', leth: 50, hp: 50 },
  { lv: 11, name: 'Lv11', leth: 55, hp: 55 },
  { lv: 12, name: 'Lv12', leth: 64, hp: 64 },
  { lv: 13, name: 'Lv13', leth: 73, hp: 73 },
  { lv: 14, name: 'Lv14', leth: 82, hp: 82 },
  { lv: 15, name: 'Lv15', leth: 91, hp: 91 },
  { lv: 16, name: 'Lv16', leth: 100, hp: 100 },
];

/** Number of gear pieces (all same stats) */
const GEAR_PIECES = 6;

/**
 * Calculate total chief gear stats (6 pieces combined).
 * Returns total ATK% and DEF% across all 6 gear pieces.
 */
export function calcChiefGearStats(gearTierId: string): { atk: number; def: number } {
  const tier = CHIEF_GEAR_TIERS.find((t) => t.id === gearTierId);
  if (!tier) return { atk: 0, def: 0 };
  return { atk: tier.atk * GEAR_PIECES, def: tier.def * GEAR_PIECES };
}

/**
 * Calculate gem stats for a given gem level.
 * Returns lethality% and HP% bonuses.
 */
export function calcGemStats(gemLv: number): { leth: number; hp: number } {
  const gem = GEM_LEVELS.find((g) => g.lv === gemLv);
  if (!gem) return { leth: 0, hp: 0 };
  return { leth: gem.leth, hp: gem.hp };
}

/** Default gems: 6 gear pieces x 3 gem slots (shield, spear, bow), all Lv16 */
export function defaultGems(): number[][] {
  return Array.from({ length: 6 }, () => [16, 16, 16]);
}

/**
 * Calculate per-troop-type gem totals from the 6x3 gems matrix.
 * gems[i] = [shieldGemLv, spearGemLv, bowGemLv] for gear piece i.
 * Returns { shield: { leth, hp }, spear: { leth, hp }, bow: { leth, hp } }
 */
export function calcGemsTotalByType(gems: number[][]): Record<'shield' | 'spear' | 'bow', { leth: number; hp: number }> {
  const result = {
    shield: { leth: 0, hp: 0 },
    spear: { leth: 0, hp: 0 },
    bow: { leth: 0, hp: 0 },
  };
  const types: ('shield' | 'spear' | 'bow')[] = ['shield', 'spear', 'bow'];
  for (let i = 0; i < 6; i++) {
    const row = gems[i] ?? [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      const stats = calcGemStats(row[j] ?? 0);
      result[types[j]].leth += stats.leth;
      result[types[j]].hp += stats.hp;
    }
  }
  return result;
}
