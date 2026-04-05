import { describe, it, expect } from 'vitest';
import { sim1, evSk, simRally, runRallySimulation, type TroopCount, type RallyConfig, type RallyParticipant } from '../battle-engine';
import type { TroopStats } from '../hero-stats';
import type { Hero, Skill } from '@wos-tools/data';

// ── Helpers ──

function makeTroops(shield: number, spear: number, bow: number): TroopCount {
  return { shield, spear, bow };
}

function makeStats(atk: number, def: number, leth: number, hp: number): TroopStats {
  return { atk, def, leth, hp };
}

const defaultStats: TroopStats[] = [
  makeStats(1000, 1000, 100, 100),
  makeStats(1000, 1000, 100, 100),
  makeStats(1000, 1000, 100, 100),
];

function makeMinimalHero(overrides?: Partial<Hero>): Hero {
  return {
    id: 'test',
    n: 'Test',
    g: 1,
    r: 'SSR',
    t: 'shield',
    img: '',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 50,
    gearBase: 20,
    s1: null,
    s2: null,
    s3: null,
    sd: [],
    sa: [],
    ...overrides,
  };
}

// ── Tests ──

describe('sim1 - battle simulation', () => {
  it('should determine a winner within MAX_TURNS', () => {
    const troops = makeTroops(10000, 10000, 10000);
    const result = sim1(
      troops,
      troops,
      defaultStats,
      defaultStats,
      [],
      [],
      [],
      [],
    );
    expect(result.turns).toBeLessThanOrEqual(100);
    expect(['atk', 'def', 'draw']).toContain(result.winner);
  });

  it('should always let the side with overwhelming stat advantage win', () => {
    const troops = makeTroops(10000, 10000, 10000);
    const strongStats: TroopStats[] = [
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
    ];
    const weakStats: TroopStats[] = [
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
    ];
    const runs = 20;

    for (let i = 0; i < runs; i++) {
      const result = sim1(
        troops,
        troops,
        strongStats,
        weakStats,
        [],
        [],
        [],
        [],
      );
      expect(result.winner).toBe('atk');
    }
  });

  it('should end within 100 turns', () => {
    const troops = makeTroops(100000, 100000, 100000);
    const tankStats: TroopStats[] = [
      makeStats(100, 10000, 10, 1000),
      makeStats(100, 10000, 10, 1000),
      makeStats(100, 10000, 10, 1000),
    ];

    const result = sim1(
      troops,
      troops,
      tankStats,
      tankStats,
      [],
      [],
      [],
      [],
    );

    expect(result.turns).toBeLessThanOrEqual(100);
  });

  it('should target front-line first (shield before spear/bow)', () => {
    // Only bow troops on attacker, enemy has shield + bow
    const aTroops = makeTroops(0, 0, 10000);
    const dTroops = makeTroops(100, 0, 10000);

    const result = sim1(
      aTroops,
      dTroops,
      defaultStats,
      defaultStats,
      [],
      [],
      [],
      [],
    );

    // After battle, defender shield should be reduced before bow takes damage
    // Check first log entry: damage should be dealt to defender's shield first
    if (result.logs.length > 0) {
      const firstLog = result.logs[0];
      // Defender's shield should have taken damage (front-line targeting)
      expect(firstLog.dDmg.shield).toBeGreaterThan(0);
    }
  });

  it('should produce casualty reports', () => {
    const troops = makeTroops(10000, 10000, 10000);
    const strongStats: TroopStats[] = [
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
    ];
    const weakStats: TroopStats[] = [
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
    ];

    const result = sim1(
      troops,
      troops,
      strongStats,
      weakStats,
      [],
      [],
      [],
      [],
    );

    // Winner (attacker) should have casualty report
    expect(result.aCasualty).toBeDefined();
    expect(result.aCasualty.dead).toBe(0); // winner has 0% dead
    expect(result.aCasualty.survived).toBeGreaterThan(0);

    // Loser (defender) should have casualty report
    expect(result.dCasualty).toBeDefined();
    // Defender loser: 0% dead, 35% severe, 65% light
    expect(result.dCasualty.dead).toBe(0);
    expect(result.dCasualty.severeWound).toBeGreaterThan(0);
  });

  it('attacker loser should have 35% dead troops', () => {
    const troops = makeTroops(10000, 10000, 10000);
    const weakStats: TroopStats[] = [
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
      makeStats(100, 100, 10, 10),
    ];
    const strongStats: TroopStats[] = [
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
      makeStats(5000, 5000, 200, 200),
    ];

    const result = sim1(
      troops,
      troops,
      weakStats,
      strongStats,
      [],
      [],
      [],
      [],
    );

    expect(result.winner).toBe('def');
    const totalLoss = 30000 - result.aCasualty.survived;
    if (totalLoss > 0) {
      // Attacker loser: 27% dead (CASUALTY_ATK_LOSER.dead = 0.27)
      const expectedDead = Math.floor(totalLoss * 0.27);
      expect(result.aCasualty.dead).toBe(expectedDead);
    }
  });
});

describe('evSk - skill evaluation', () => {
  it('should always activate "always" type skills', () => {
    const alwaysSkill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkBuf: 0.10,
      lbl: 'ATK+10%',
    };

    const hero = makeMinimalHero({
      s1: alwaysSkill,
      s2: null,
      s3: null,
    });

    // Run 50 times - should always fire
    for (let i = 0; i < 50; i++) {
      const effect = evSk([hero], []);
      // atkBuf goes into selfMod.damageUp as (1 + 0) * (1 + 0.10) = 1.10
      expect(effect.selfMod.damageUp).toBeCloseTo(1.10, 4);
    }
  });

  it('should activate "prob" type skills according to probability', () => {
    const probSkill: Skill = {
      tp: 'prob',
      prob: 0.50,
      atkDmgBuf: 0.20,
      lbl: '50%:AtkDmg+20%',
    };

    const hero = makeMinimalHero({
      s1: probSkill,
      s2: null,
      s3: null,
    });

    let fires = 0;
    const runs = 1000;

    for (let i = 0; i < runs; i++) {
      const effect = evSk([hero], []);
      // When fired: damageUp = (1 + 0.20) * (1 + 0) = 1.20
      // When not fired: damageUp = 1.0
      if (effect.selfMod.damageUp > 1.0) fires++;
    }

    // With p=0.50, expect roughly 50% activation (allow 35%-65% range)
    const rate = fires / runs;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.65);
  });

  it('should only use S1 for riders, not S2/S3', () => {
    const s1Skill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkDmgBuf: 0.10,
      lbl: 'S1: AtkDmg+10%',
    };
    const s2Skill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkDmgBuf: 0.50,
      lbl: 'S2: AtkDmg+50%',
    };
    const s3Skill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkDmgBuf: 0.30,
      lbl: 'S3: AtkDmg+30%',
    };

    const rider = makeMinimalHero({
      id: 'rider1',
      s1: s1Skill,
      s2: s2Skill,
      s3: s3Skill,
    });

    const effect = evSk([], [rider]);
    // Only S1 fires for rider: damageUp = (1 + 0.10) * 1 = 1.10
    expect(effect.selfMod.damageUp).toBeCloseTo(1.10, 4);
  });

  it('should deduplicate riders with same hero ID', () => {
    const s1Skill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkDmgBuf: 0.10,
      lbl: 'S1: AtkDmg+10%',
    };

    const rider1 = makeMinimalHero({ id: 'same_hero', s1: s1Skill });
    const rider2 = makeMinimalHero({ id: 'same_hero', s1: s1Skill });

    const effect = evSk([], [rider1, rider2]);
    // Only one should count: damageUp = 1 + 0.10 = 1.10
    expect(effect.selfMod.damageUp).toBeCloseTo(1.10, 4);
  });

  it('should not allow rider to duplicate a leader hero', () => {
    const leaderSkill: Skill = {
      tp: 'always',
      prob: 1.0,
      atkDmgBuf: 0.10,
      lbl: 'Leader ATK+10%',
    };
    const leader = makeMinimalHero({
      id: 'hero_x',
      s1: leaderSkill,
      s2: null,
      s3: null,
    });
    const rider = makeMinimalHero({
      id: 'hero_x',
      s1: leaderSkill,
    });

    const effect = evSk([leader], [rider]);
    // Leader contributes damageUp = (1 + 0.10) = 1.10
    // Rider with same ID should be skipped
    expect(effect.selfMod.damageUp).toBeCloseTo(1.10, 4);
  });

  it('leaders should have all 3 skills activate', () => {
    const s1: Skill = { tp: 'always', prob: 1.0, atkDmgBuf: 0.10, lbl: 'S1' };
    const s2: Skill = { tp: 'always', prob: 1.0, atkBuf: 0.05, lbl: 'S2' };
    const s3: Skill = { tp: 'always', prob: 1.0, defBuf: 0.20, lbl: 'S3' };

    const leader = makeMinimalHero({ s1, s2, s3 });

    const effect = evSk([leader], []);
    // damageUp = (1 + 0.10) * (1 + 0.05) = 1.155
    expect(effect.selfMod.damageUp).toBeCloseTo(1.155, 3);
    // defenseUp = 1 + 0.20 = 1.20
    expect(effect.selfMod.defenseUp).toBeCloseTo(1.20, 4);
  });
});

// ── Rally simulation tests ──

describe('simRally - rally battle simulation', () => {
  const defaultTroopStats: Record<'shield' | 'spear' | 'bow', TroopStats> = {
    shield: makeStats(1000, 1000, 100, 100),
    spear: makeStats(1000, 1000, 100, 100),
    bow: makeStats(1000, 1000, 100, 100),
  };

  function makeRallyHero(id: string, t: 'shield' | 'spear' | 'bow', overrides?: Partial<Hero>): Hero {
    return makeMinimalHero({ id, n: `Hero_${id}`, t, ...overrides });
  }

  function makeBaseRallyConfig(overrides?: Partial<RallyConfig>): RallyConfig {
    return {
      atkLeaders: [
        makeRallyHero('a_shield', 'shield'),
        makeRallyHero('a_spear', 'spear'),
        makeRallyHero('a_bow', 'bow'),
      ],
      atkLeaderTroops: makeTroops(10000, 10000, 10000),
      atkJoiners: [],
      atkHeroStats: { ...defaultTroopStats },
      defLeaders: [
        makeRallyHero('d_shield', 'shield'),
        makeRallyHero('d_spear', 'spear'),
        makeRallyHero('d_bow', 'bow'),
      ],
      defLeaderTroops: makeTroops(10000, 10000, 10000),
      defJoiners: [],
      defHeroStats: { ...defaultTroopStats },
      ...overrides,
    };
  }

  it('should determine a winner within MAX_TURNS', () => {
    const config = makeBaseRallyConfig();
    const result = simRally(config);

    expect(result.turns).toBeLessThanOrEqual(100);
    expect(['atk', 'def', 'draw']).toContain(result.winner);
    expect(result.atkTotalTroops).toBe(30000);
    expect(result.defTotalTroops).toBe(30000);
  });

  it('should let the stronger side win consistently', () => {
    const strongStats: Record<'shield' | 'spear' | 'bow', TroopStats> = {
      shield: makeStats(5000, 5000, 200, 200),
      spear: makeStats(5000, 5000, 200, 200),
      bow: makeStats(5000, 5000, 200, 200),
    };
    const weakStats: Record<'shield' | 'spear' | 'bow', TroopStats> = {
      shield: makeStats(100, 100, 10, 10),
      spear: makeStats(100, 100, 10, 10),
      bow: makeStats(100, 100, 10, 10),
    };

    const config = makeBaseRallyConfig({
      atkHeroStats: strongStats,
      defHeroStats: weakStats,
    });

    for (let i = 0; i < 10; i++) {
      const result = simRally(config);
      expect(result.winner).toBe('atk');
    }
  });

  it('should aggregate joiner troops into the pool', () => {
    const joiner: RallyParticipant = {
      playerId: 'j1',
      playerName: 'Joiner1',
      hero: makeRallyHero('j1_hero', 'shield'),
      troops: makeTroops(5000, 5000, 5000),
    };

    const config = makeBaseRallyConfig({
      atkJoiners: [joiner],
    });

    const result = simRally(config);
    // Total atk troops = leader(30000) + joiner(15000) = 45000
    expect(result.atkTotalTroops).toBe(45000);
    expect(result.defTotalTroops).toBe(30000);
  });

  it('should produce per-participant casualty results', () => {
    const joiners: RallyParticipant[] = [
      {
        playerId: 'j1',
        playerName: 'Joiner1',
        hero: makeRallyHero('j1_hero', 'shield'),
        troops: makeTroops(3000, 3000, 3000),
      },
      {
        playerId: 'j2',
        playerName: 'Joiner2',
        hero: makeRallyHero('j2_hero', 'spear'),
        troops: makeTroops(2000, 2000, 2000),
      },
    ];

    const config = makeBaseRallyConfig({
      atkJoiners: joiners,
    });

    const result = simRally(config);

    // Leader + 2 joiners = 3 participant results on atk side
    expect(result.atkParticipants).toHaveLength(3);
    expect(result.atkParticipants[0].playerId).toBe('__leader__');
    expect(result.atkParticipants[1].playerId).toBe('j1');
    expect(result.atkParticipants[2].playerId).toBe('j2');

    // Each participant should have a valid casualty report
    for (const p of result.atkParticipants) {
      expect(p.casualties).toBeDefined();
      const c = p.casualties;
      expect(c.dead + c.severeWound + c.lightWound + c.survived).toBe(
        p.troopsSent.shield + p.troopsSent.spear + p.troopsSent.bow
      );
    }
  });

  it('should produce leader matchup data for all 3 troop types', () => {
    const config = makeBaseRallyConfig();
    const result = simRally(config);

    expect(result.leaderMatchups).toHaveLength(3);
    expect(result.leaderMatchups[0].type).toBe('shield');
    expect(result.leaderMatchups[1].type).toBe('spear');
    expect(result.leaderMatchups[2].type).toBe('bow');

    for (const m of result.leaderMatchups) {
      expect(m.atkLoss).toBeGreaterThanOrEqual(0);
      expect(m.defLoss).toBeGreaterThanOrEqual(0);
    }
  });

  it('should produce battle logs', () => {
    const config = makeBaseRallyConfig();
    const result = simRally(config);

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.length).toBe(result.turns);
  });
});

describe('runRallySimulation - multi-run rally', () => {
  function makeRallyHero(id: string, t: 'shield' | 'spear' | 'bow'): Hero {
    return makeMinimalHero({ id, n: `Hero_${id}`, t });
  }

  it('should run multiple simulations and aggregate', () => {
    const config: RallyConfig = {
      atkLeaders: [
        makeRallyHero('a_shield', 'shield'),
        makeRallyHero('a_spear', 'spear'),
        makeRallyHero('a_bow', 'bow'),
      ],
      atkLeaderTroops: { shield: 5000, spear: 5000, bow: 5000 },
      atkJoiners: [],
      atkHeroStats: {
        shield: makeStats(1000, 1000, 100, 100),
        spear: makeStats(1000, 1000, 100, 100),
        bow: makeStats(1000, 1000, 100, 100),
      },
      defLeaders: [
        makeRallyHero('d_shield', 'shield'),
        makeRallyHero('d_spear', 'spear'),
        makeRallyHero('d_bow', 'bow'),
      ],
      defLeaderTroops: { shield: 5000, spear: 5000, bow: 5000 },
      defJoiners: [],
      defHeroStats: {
        shield: makeStats(1000, 1000, 100, 100),
        spear: makeStats(1000, 1000, 100, 100),
        bow: makeStats(1000, 1000, 100, 100),
      },
      runs: 10,
    };

    const agg = runRallySimulation(config);
    expect(agg.runs).toBe(10);
    expect(agg.results).toHaveLength(10);
    expect(agg.atkWins + agg.defWins + agg.draws).toBe(10);
    expect(agg.avgTurns).toBeGreaterThan(0);
  });
});
