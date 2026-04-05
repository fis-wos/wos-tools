/**
 * WOS Battle Simulator - Hero Stats Calculation
 *
 * Handles level scaling, gear refinement, charm bonuses,
 * and composite hero stat computation.
 *
 * Stats are split into:
 * - CombatStats: base ATK/DEF/Lethality/HP per troop type
 * - SkillMod: multiplier group from skill buffs/debuffs (computed separately in battle-engine)
 */

import {
  type Hero,
  type TroopType,
  GS,
  EK,
  EH,
} from '@wos-tools/data';

/** Gear refinement levels per slot */
export interface RefineConfig {
  /** Goggle refinement level (adds lethality) */
  goggle: number;
  /** Glove refinement level (adds HP) */
  glove: number;
  /** Belt refinement level (adds lethality) */
  belt: number;
  /** Boots refinement level (adds HP) */
  boots: number;
}

/** Charm (陶冶) levels per slot */
export interface CharmConfig {
  /** Goggle charm level (ATK bonus) */
  goggle: number;
  /** Glove charm level (DEF bonus) */
  glove: number;
  /** Belt charm level (ATK bonus) */
  belt: number;
  /** Boots charm level (DEF bonus) */
  boots: number;
}

/** Per-hero configuration */
export interface HeroConfig {
  heroLv: number;
  gearLv: number;
  refine: RefineConfig;
  charm: CharmConfig;
}

/** Computed effective stats for one hero */
export interface HeroStats {
  atk: number;
  def: number;
  leth: number;
  hp: number;
}

/** Aggregated base combat stats per troop type for battle (no skill mods mixed in) */
export interface TroopStats {
  atk: number;
  def: number;
  leth: number;
  hp: number;
}

/**
 * Skill modifier group -- separated from base stats.
 * Used in the damage formula: SkillMod = (damageUp * oppDefenseDown) / (defenseUp * oppDamageDown)
 *
 * All values are multiplicative totals (1.0 = no effect).
 */
export interface SkillMod {
  /** Friendly damage increase (味方与ダメ増加). Product of all damage-up buffs. */
  damageUp: number;
  /** Friendly defense increase / damage reduction (味方被ダメ軽減). Product of all defense-up buffs. */
  defenseUp: number;
  /** Enemy damage reduction debuff (敵与ダメ低下). Product of all debuffs applied to enemy's damage. */
  oppDamageDown: number;
  /** Enemy defense reduction debuff (敵防御低下). Product of all debuffs weakening enemy's defense. */
  oppDefenseDown: number;
}

/** Create a neutral (no-effect) SkillMod */
export function emptySkillMod(): SkillMod {
  return {
    damageUp: 1.0,
    defenseUp: 1.0,
    oppDamageDown: 1.0,
    oppDefenseDown: 1.0,
  };
}

/** Troop type order: shield=0, spear=1, bow=2 */
const TROOP_ORDER: TroopType[] = ['shield', 'spear', 'bow'];

/**
 * Level scaling factor. Lv80 = 1.0 baseline.
 * Linear interpolation: scale = lv / 80
 */
export function heroLvScale(lv: number): number {
  return lv / 80;
}

/**
 * Calculate refine multiplier for lethality (goggle+belt) and HP (glove+boots).
 * Each refine level adds a percentage.
 * Refine levels: 0-5 => 0%, 2%, 4%, 7%, 11%, 16%
 */
const REFINE_TABLE = [0, 0.02, 0.04, 0.07, 0.11, 0.16];

export function calcRefineMultiplier(refine: RefineConfig): {
  lethMul: number;
  hpMul: number;
} {
  const goggleVal = REFINE_TABLE[Math.min(refine.goggle, 5)] ?? 0;
  const beltVal = REFINE_TABLE[Math.min(refine.belt, 5)] ?? 0;
  const gloveVal = REFINE_TABLE[Math.min(refine.glove, 5)] ?? 0;
  const bootsVal = REFINE_TABLE[Math.min(refine.boots, 5)] ?? 0;

  return {
    lethMul: 1 + goggleVal + beltVal,
    hpMul: 1 + gloveVal + bootsVal,
  };
}

/**
 * Calculate charm bonus.
 * Each charm level adds cumulative ATK or DEF bonus.
 * Charm levels 0-10: each level adds 1% to the respective stat.
 * Goggle/Belt => ATK, Glove/Boots => DEF
 */
export function calcCharmBonus(charm: CharmConfig): {
  atkBonus: number;
  defBonus: number;
} {
  const atkPct = (charm.goggle + charm.belt) * 0.01;
  const defPct = (charm.glove + charm.boots) * 0.01;
  return {
    atkBonus: atkPct,
    defBonus: defPct,
  };
}

/**
 * Calculate effective stats for a single hero.
 *
 * ATK = (GS[g] + EK + gearAtkAdd) * lvScale * (1 + charmAtkBonus)
 * DEF = (GS[g] + EH + gearDefAdd) * lvScale * (1 + charmDefBonus)
 * Lethality = glg * gearLvScale * refineLethMul
 * HP = glg * gearLvScale * refineHpMul
 */
export function getHeroStats(hero: Hero, config: HeroConfig): HeroStats {
  const lvScale = heroLvScale(config.heroLv);
  const baseGs = GS[hero.g] ?? GS[1]!;

  // Gear level scale: gearLv out of 30
  const gearLvScale = config.gearLv / 30;

  // Gear adds to base stats: 4 slots of gear
  const gearAtkAdd = hero.gearBase * 4 * gearLvScale;
  const gearDefAdd = hero.gearBase * 4 * gearLvScale;

  // Charm bonuses
  const charmBonus = calcCharmBonus(config.charm);

  // Refine multipliers
  const refineMul = calcRefineMultiplier(config.refine);

  // Base ATK/DEF
  const atk = (baseGs + EK + gearAtkAdd) * lvScale * (1 + charmBonus.atkBonus);
  const def = (baseGs + EH + gearDefAdd) * lvScale * (1 + charmBonus.defBonus);

  // Lethality from exclusive weapon
  const leth = hero.glg * gearLvScale * refineMul.lethMul;

  // HP% from exclusive weapon
  const hp = hero.glg * gearLvScale * refineMul.hpMul;

  return { atk, def, leth, hp };
}

/**
 * Calculate aggregated hero stats per troop type for a set of leaders.
 *
 * @param leaders - Array of { hero, config } for each leader slot
 * @param isAtk - Whether this is the attacking side (affects gear skill application)
 * @returns Array of TroopStats indexed by troop type [shield, spear, bow]
 */
export function calcHeroStats(
  leaders: Array<{ hero: Hero; config: HeroConfig }>,
  isAtk: boolean
): TroopStats[] {
  // Initialize per-troop stats
  const stats: TroopStats[] = TROOP_ORDER.map(() => ({
    atk: 0,
    def: 0,
    leth: 0,
    hp: 0,
  }));

  for (const { hero, config } of leaders) {
    const heroStats = getHeroStats(hero, config);
    const tIdx = TROOP_ORDER.indexOf(hero.t);

    // Base stat contribution
    stats[tIdx].atk += heroStats.atk;
    stats[tIdx].def += heroStats.def;
    stats[tIdx].leth += heroStats.leth;
    stats[tIdx].hp += heroStats.hp;

    // Gear skill: conditional bonus based on atk/def side
    if (hero.gs) {
      const applies =
        (isAtk && hero.gs.timing === 'atk') ||
        (!isAtk && hero.gs.timing === 'def');
      if (applies) {
        const bonus = hero.gearBase * (config.gearLv / 30) * 0.5;
        switch (hero.gs.eff) {
          case 'atk':
            stats[tIdx].atk += bonus;
            break;
          case 'def':
            stats[tIdx].def += bonus;
            break;
          case 'leth':
            stats[tIdx].leth += bonus;
            break;
          case 'hp':
            stats[tIdx].hp += bonus;
            break;
        }
      }
    }
  }

  return stats;
}
