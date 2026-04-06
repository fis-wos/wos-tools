/**
 * Hero Gear (英雄装備) data and calculations.
 *
 * 4 gear pieces: ゴーグル / グローブ / ベルト / 靴
 *
 * MAX values (神話+100, 精錬Lv.20, 配能+100):
 *   ゴーグル: 殺傷力+300%, 配能(遠征)ATK+70%・DEF+30%
 *   グローブ: HP+300%,     配能(遠征)DEF+70%・ATK+30%
 *   ベルト:   HP+300%,     配能(遠征)ATK+70%・DEF+30%
 *   靴:       殺傷力+300%, 配能(遠征)DEF+70%・ATK+30%
 *
 * 合計:
 *   殺傷力: 600% → 精錬200%適用 → 1800%
 *   HP:     600% → 精錬200%適用 → 1800%
 *   ATK(配能): 200%
 *   DEF(配能): 200%
 */

/** Hero gear level definition */
export interface HeroGearLevel {
  id: string;
  name: string;
  /** Lethality bonus % (4 pieces combined) */
  lethPercent: number;
  /** HP bonus % (4 pieces combined) */
  hpPercent: number;
  /** ATK bonus % from 配能 (4 pieces combined) */
  atkPercent: number;
  /** DEF bonus % from 配能 (4 pieces combined) */
  defPercent: number;
}

/**
 * Practical hero gear levels for the UI dropdown.
 *
 * スクショから判明した実測値:
 *   レジェンド(精錬0, 配能0):      殺傷力/HP +3.33% per piece
 *   レジェンド(+100, 精錬Lv.1):    殺傷力/HP +55.00% per piece
 *   神話(+39, 精錬Lv.11=+110%):    殺傷力 +145.95% per piece
 *   神話(+19, 精錬Lv.12=+120%):    HP +130.90% per piece
 *   神話(+100, 精錬Lv.20=+200%):   殺傷力/HP +300.00% per piece (MAX)
 *
 * 配能(遠征合計): 各部位 ATK+70% or DEF+70% + もう片方+30%
 *   4部位合計: ATK+200%, DEF+200%
 *
 * 殺傷力/HP: 2 pieces each (ゴーグル+靴 = 殺傷力, グローブ+ベルト = HP)
 */
export const HERO_GEAR_LEVELS: HeroGearLevel[] = [
  { id: 'none', name: 'なし', lethPercent: 0, hpPercent: 0, atkPercent: 0, defPercent: 0 },
  { id: 'legend_low', name: 'レジェンド(低)', lethPercent: 7, hpPercent: 7, atkPercent: 0, defPercent: 0 },
  // 3.33%×2部位=6.66%≈7%, 配能なし
  { id: 'legend_high', name: 'レジェンド(精錬1)', lethPercent: 110, hpPercent: 110, atkPercent: 0, defPercent: 0 },
  // 55%×2部位=110%
  { id: 'gold_mid', name: '神話(中強化)', lethPercent: 292, hpPercent: 262, atkPercent: 40, defPercent: 40 },
  // ゴーグル145.95+靴≈146=292, グローブ130.9+ベルト≈131=262
  { id: 'gold_max', name: '神話(MAX精錬20)', lethPercent: 600, hpPercent: 600, atkPercent: 200, defPercent: 200 },
  // 300%×2=600%
  { id: 'red', name: 'レジェンド(赤)', lethPercent: 800, hpPercent: 800, atkPercent: 280, defPercent: 280 },
];

/**
 * Calculate hero gear stats for a given level.
 * Returns lethality%, HP%, ATK%, DEF% bonuses.
 */
export function calcHeroGearStats(levelId: string): { leth: number; hp: number; atk: number; def: number } {
  const level = HERO_GEAR_LEVELS.find((l) => l.id === levelId);
  if (!level) return { leth: 0, hp: 0, atk: 0, def: 0 };
  return {
    leth: level.lethPercent,
    hp: level.hpPercent,
    atk: level.atkPercent,
    def: level.defPercent,
  };
}
