import { describe, it, expect } from 'vitest';
import {
  heroLvScale,
  calcRefineMultiplier,
  calcCharmBonus,
  getHeroStats,
  type RefineConfig,
  type CharmConfig,
  type HeroConfig,
} from '../hero-stats';
import { HEROES } from '@wos-tools/data';
import { GS, EK, EH } from '@wos-tools/data';

describe('heroLvScale', () => {
  it('should return 1.0 for Lv80', () => {
    expect(heroLvScale(80)).toBe(1.0);
  });

  it('should return ~0.0125 for Lv1', () => {
    expect(heroLvScale(1)).toBeCloseTo(1 / 80, 4);
  });

  it('should return ~1.25 for Lv100', () => {
    expect(heroLvScale(100)).toBeCloseTo(100 / 80, 4);
  });
});

describe('calcRefineMultiplier', () => {
  it('should return multiplier 1.0 for all refine level 0', () => {
    const refine: RefineConfig = { goggle: 0, glove: 0, belt: 0, boots: 0 };
    const result = calcRefineMultiplier(refine);
    expect(result.lethMul).toBe(1.0);
    expect(result.hpMul).toBe(1.0);
  });

  it('should return correct multipliers for max refine (level 5 all slots)', () => {
    // Refine table: [0, 0.02, 0.04, 0.07, 0.11, 0.16]
    // Leth = goggle + belt => 0.16 + 0.16 = 0.32 => mul = 1.32
    // HP = glove + boots => 0.16 + 0.16 = 0.32 => mul = 1.32
    const refine: RefineConfig = { goggle: 5, glove: 5, belt: 5, boots: 5 };
    const result = calcRefineMultiplier(refine);
    expect(result.lethMul).toBeCloseTo(1.32, 4);
    expect(result.hpMul).toBeCloseTo(1.32, 4);
  });
});

describe('calcCharmBonus', () => {
  it('should return ATK+100% and DEF+100% for all slots at level 100', () => {
    // Each level adds 1%. Goggle+Belt => ATK, Glove+Boots => DEF
    // 50+50 = 100 => 100 * 0.01 = 1.0
    const charm: CharmConfig = { goggle: 50, glove: 50, belt: 50, boots: 50 };
    const result = calcCharmBonus(charm);
    expect(result.atkBonus).toBeCloseTo(1.0, 4);
    expect(result.defBonus).toBeCloseTo(1.0, 4);
  });

  it('should return 0 bonus for all slots at level 0', () => {
    const charm: CharmConfig = { goggle: 0, glove: 0, belt: 0, boots: 0 };
    const result = calcCharmBonus(charm);
    expect(result.atkBonus).toBe(0);
    expect(result.defBonus).toBe(0);
  });
});

describe('getHeroStats', () => {
  it('should compute expected stats for G9 shield hero (Magnus) with default config', () => {
    const magnus = HEROES.find((h) => h.id === 'magnus');
    expect(magnus).toBeDefined();

    const config: HeroConfig = {
      heroLv: 80,
      gearLv: 30,
      refine: { goggle: 0, glove: 0, belt: 0, boots: 0 },
      charm: { goggle: 0, glove: 0, belt: 0, boots: 0 },
    };

    const stats = getHeroStats(magnus!, config);

    // lvScale = 80/80 = 1.0
    // gearLvScale = 30/30 = 1.0
    // gearAtkAdd = 100.0 * 4 * 1.0 = 400
    // baseGs = GS[9] = 940.75
    // ATK = (940.75 + 130 + 400) * 1.0 * (1 + 0) = 1470.75
    // DEF = (940.75 + 190 + 400) * 1.0 * (1 + 0) = 1530.75
    // leth = 232.00 * 1.0 * 1.0 = 232.00
    // hp = 232.00 * 1.0 * 1.0 = 232.00

    expect(stats.atk).toBeCloseTo(1470.75, 1);
    expect(stats.def).toBeCloseTo(1530.75, 1);
    expect(stats.leth).toBeCloseTo(232.0, 1);
    expect(stats.hp).toBeCloseTo(232.0, 1);
  });

  it('should apply charm bonuses correctly', () => {
    const magnus = HEROES.find((h) => h.id === 'magnus')!;

    const config: HeroConfig = {
      heroLv: 80,
      gearLv: 30,
      refine: { goggle: 0, glove: 0, belt: 0, boots: 0 },
      charm: { goggle: 10, glove: 10, belt: 10, boots: 10 },
    };

    const stats = getHeroStats(magnus, config);

    // charmAtkBonus = (10+10)*0.01 = 0.20
    // ATK = 1470.75 * (1 + 0.20) = 1764.9
    expect(stats.atk).toBeCloseTo(1470.75 * 1.2, 1);
  });
});
