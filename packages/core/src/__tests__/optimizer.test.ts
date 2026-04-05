import { describe, it, expect } from 'vitest';
import { genRatios, genLeaderCombos } from '../optimizer';
import { HEROES } from '@wos-tools/data';

describe('genRatios', () => {
  const ratios = genRatios();

  it('should generate 66 ratio patterns', () => {
    // C(12,2) = 66 combinations for (a+b+c=10, a,b,c >= 0)
    expect(ratios.length).toBe(66);
  });

  it('should have each pattern sum to 1.0 (shield + spear + bow = 100%)', () => {
    for (const [sh, sp, bo] of ratios) {
      expect(sh + sp + bo).toBeCloseTo(1.0, 6);
    }
  });

  it('should have all values between 0 and 1', () => {
    for (const [sh, sp, bo] of ratios) {
      expect(sh).toBeGreaterThanOrEqual(0);
      expect(sh).toBeLessThanOrEqual(1);
      expect(sp).toBeGreaterThanOrEqual(0);
      expect(sp).toBeLessThanOrEqual(1);
      expect(bo).toBeGreaterThanOrEqual(0);
      expect(bo).toBeLessThanOrEqual(1);
    }
  });
});

describe('genLeaderCombos', () => {
  it('should return exactly 1 combo when all three are fixed', () => {
    const combos = genLeaderCombos('norah', 'logan', 'gwen');
    expect(combos.length).toBe(1);
    expect(combos[0]).toEqual(['norah', 'logan', 'gwen']);
  });

  it('should generate all valid combos when all three are auto (no fix)', () => {
    const combos = genLeaderCombos();

    // Number of SSR heroes per type
    const shieldCount = HEROES.filter((h) => h.t === 'shield' && h.r === 'SSR').length;
    const spearCount = HEROES.filter((h) => h.t === 'spear' && h.r === 'SSR').length;
    const bowCount = HEROES.filter((h) => h.t === 'bow' && h.r === 'SSR').length;

    // All combinations (no overlap possible since each type is distinct)
    const expected = shieldCount * spearCount * bowCount;
    expect(combos.length).toBe(expected);
  });

  it('should not have duplicate hero IDs in any combo', () => {
    const combos = genLeaderCombos();
    for (const [sh, sp, bo] of combos) {
      const unique = new Set([sh, sp, bo]);
      expect(unique.size).toBe(3);
    }
  });
});
