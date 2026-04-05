/**
 * WOS Battle Simulator - Hero Stats Calculation
 * Copied from packages/core/src/hero-stats.ts
 */

import type { Hero, TroopType } from './heroes';
import { GS, EK, EH } from './constants';

/** Gear refinement levels per slot */
export interface RefineConfig {
  goggle: number;
  glove: number;
  belt: number;
  boots: number;
}

/** Charm levels per slot */
export interface CharmConfig {
  goggle: number;
  glove: number;
  belt: number;
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

/** Aggregated base combat stats per troop type */
export interface TroopStats {
  atk: number;
  def: number;
  leth: number;
  hp: number;
}

/**
 * Skill modifier group
 */
export interface SkillMod {
  damageUp: number;
  defenseUp: number;
  oppDamageDown: number;
  oppDefenseDown: number;
}

/** Create a neutral SkillMod */
export function emptySkillMod(): SkillMod {
  return {
    damageUp: 1.0,
    defenseUp: 1.0,
    oppDamageDown: 1.0,
    oppDefenseDown: 1.0,
  };
}

const TROOP_ORDER: TroopType[] = ['shield', 'spear', 'bow'];

export function heroLvScale(lv: number): number {
  return lv / 80;
}

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

export function getHeroStats(hero: Hero, config: HeroConfig): HeroStats {
  const lvScale = heroLvScale(config.heroLv);
  const baseGs = GS[hero.g] ?? GS[1]!;

  const gearLvScale = config.gearLv / 30;
  const gearAtkAdd = hero.gearBase * 4 * gearLvScale;
  const gearDefAdd = hero.gearBase * 4 * gearLvScale;

  const charmBonus = calcCharmBonus(config.charm);
  const refineMul = calcRefineMultiplier(config.refine);

  const atk = (baseGs + EK + gearAtkAdd) * lvScale * (1 + charmBonus.atkBonus);
  const def = (baseGs + EH + gearDefAdd) * lvScale * (1 + charmBonus.defBonus);
  const leth = hero.glg * gearLvScale * refineMul.lethMul;
  const hp = hero.glg * gearLvScale * refineMul.hpMul;

  return { atk, def, leth, hp };
}

export function calcHeroStats(
  leaders: Array<{ hero: Hero; config: HeroConfig }>,
  isAtk: boolean
): TroopStats[] {
  // バトルレポート分析:
  // - ベースステータス(ATK/DEF/殺傷力/HP)は兵種別に差がある
  // - しかし兵士0の兵種でもリーダーのスキル効果は全兵種に適用される
  // - 実装: 全リーダーのステータスを合算して全兵種に適用
  //   （バトルレポートの兵種別差異は研究/装備/ペット等の外部バフが原因と推定）
  let totalAtk = 0, totalDef = 0, totalLeth = 0, totalHp = 0;

  for (const { hero, config } of leaders) {
    const heroStats = getHeroStats(hero, config);

    totalAtk += heroStats.atk;
    totalDef += heroStats.def;
    totalLeth += heroStats.leth;
    totalHp += heroStats.hp;

    if (hero.gs) {
      const applies =
        (isAtk && hero.gs.timing === 'atk') ||
        (!isAtk && hero.gs.timing === 'def');
      if (applies) {
        const bonus = hero.gearBase * (config.gearLv / 30) * 0.5;
        switch (hero.gs.eff) {
          case 'atk': totalAtk += bonus; break;
          case 'def': totalDef += bonus; break;
          case 'leth': totalLeth += bonus; break;
          case 'hp': totalHp += bonus; break;
        }
      }
    }
  }

  return TROOP_ORDER.map(() => ({
    atk: totalAtk,
    def: totalDef,
    leth: totalLeth,
    hp: totalHp,
  }));
}
