import { describe, it, expect } from 'vitest';
import { HEROES, type Hero, type Skill, type TroopType } from '../heroes';

const SSR_HEROES = HEROES.filter((h) => h.r === 'SSR');

describe('heroes data', () => {
  it('should have exactly 37 SSR heroes', () => {
    expect(SSR_HEROES.length).toBe(37);
  });

  it('should have correct hero count per generation', () => {
    // G1 has 4 heroes (2 shield, 1 spear, 1 bow); G2-G12 have 3 each
    const g1 = SSR_HEROES.filter((h) => h.g === 1);
    expect(g1.length, 'Generation 1 should have 4 heroes').toBe(4);

    for (let g = 2; g <= 12; g++) {
      const gen = SSR_HEROES.filter((h) => h.g === g);
      expect(gen.length, `Generation ${g} should have 3 heroes`).toBe(3);

      const types = gen.map((h) => h.t).sort();
      expect(types, `Generation ${g} should have shield, spear, bow`).toEqual([
        'bow',
        'shield',
        'spear',
      ]);
    }
  });

  it('should have valid skill data types for all heroes', () => {
    for (const hero of SSR_HEROES) {
      const skills = [hero.s1, hero.s2, hero.s3];
      for (const skill of skills) {
        if (skill === null) continue;

        // tp must be 'always', 'prob', or 'periodic'
        expect(['always', 'prob', 'periodic']).toContain(skill.tp);

        // prob must be a number between 0 and 1
        expect(skill.prob).toBeGreaterThanOrEqual(0);
        expect(skill.prob).toBeLessThanOrEqual(1);

        // lbl must be a non-empty string
        expect(typeof skill.lbl).toBe('string');
        expect(skill.lbl.length).toBeGreaterThan(0);

        // Optional numeric fields should be numbers if present
        const numericFields: (keyof Skill)[] = [
          'atkDmgBuf',
          'defBuf',
          'atkBuf',
          'defStatBuf',
          'hpBuf',
          'lethBuf',
          'atkDebuf',
          'defDebuf',
          'atkStatDebuf',
          'lethDebuf',
          'stun',
          'dotDmg',
          'reflectBuf',
          'critRate',
          'extraAtk',
          'dodge',
          'shield',
          'period',
          'duration',
        ];
        for (const field of numericFields) {
          if (skill[field] !== undefined) {
            expect(typeof skill[field], `${hero.id}.${field}`).toBe('number');
          }
        }
      }
    }
  });

  it('should have unique hero IDs', () => {
    const ids = SSR_HEROES.map((h) => h.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
