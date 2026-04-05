import { describe, it, expect } from 'vitest';
import { runLottery, verifyResult } from '../lottery-engine';
import type { Participant, RewardItem, LotteryConfig } from '../types';

// ── Test fixtures ──

function makeParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    kills: (count - i) * 100, // Descending kill count
    score: (count - i) * 1000,
    daysActive: 7,
  }));
}

const defaultConfig: LotteryConfig = {
  weights: {
    kills: 0.4,
    score: 0.4,
    daysActive: 0.1,
    base: 0.1,
  },
  seed: 'test-seed-12345',
};

const sampleRewards: RewardItem[] = [
  { id: 'r1', name: 'S Tier Prize', quantity: 1, tier: 'S' },
  { id: 'r2', name: 'A Tier Prize', quantity: 1, tier: 'A' },
  { id: 'r3', name: 'B Tier Prize 1', quantity: 1, tier: 'B' },
  { id: 'r4', name: 'B Tier Prize 2', quantity: 1, tier: 'B' },
  { id: 'r5', name: 'B Tier Prize 3', quantity: 1, tier: 'B' },
];

// ── Tests ──

describe('lottery reproducibility', () => {
  it('should produce the same result with the same seed', () => {
    const participants = makeParticipants(20);
    const result1 = runLottery(participants, sampleRewards, defaultConfig);
    const result2 = runLottery(participants, sampleRewards, defaultConfig);

    expect(result1.winners.length).toBe(result2.winners.length);
    for (let i = 0; i < result1.winners.length; i++) {
      expect(result1.winners[i].participant.id).toBe(
        result2.winners[i].participant.id,
      );
      expect(result1.winners[i].reward.id).toBe(result2.winners[i].reward.id);
    }
  });

  it('should produce different results with different seeds', () => {
    const participants = makeParticipants(20);
    const result1 = runLottery(participants, sampleRewards, {
      ...defaultConfig,
      seed: 'seed-alpha',
    });
    const result2 = runLottery(participants, sampleRewards, {
      ...defaultConfig,
      seed: 'seed-beta',
    });

    // At least some winners should differ (not guaranteed but very likely with 20 people)
    const ids1 = result1.winners.map((w) => w.participant.id).join(',');
    const ids2 = result2.winners.map((w) => w.participant.id).join(',');
    // Very unlikely to be identical with different seeds
    expect(ids1 === ids2).toBe(false);
  });
});

describe('lottery tier distribution', () => {
  it('should assign Tier S to top contributors more often', () => {
    const participants = makeParticipants(20);
    const rewards: RewardItem[] = [
      { id: 'rs', name: 'S Prize', quantity: 1, tier: 'S' },
    ];

    // Run multiple lotteries with different seeds and check if top players win Tier S more
    const topWins: Record<string, number> = {};
    const runs = 200;

    for (let i = 0; i < runs; i++) {
      const result = runLottery(participants, rewards, {
        ...defaultConfig,
        seed: `tier-s-test-${i}`,
      });
      if (result.winners.length > 0) {
        const winnerId = result.winners[0].participant.id;
        topWins[winnerId] = (topWins[winnerId] ?? 0) + 1;
      }
    }

    // The top contributor (p1) should win more than the bottom one (p20)
    const p1Wins = topWins['p1'] ?? 0;
    const p20Wins = topWins['p20'] ?? 0;
    expect(p1Wins).toBeGreaterThan(p20Wins);
  });

  it('should distribute Tier B roughly equally', () => {
    const participants = makeParticipants(5);
    const rewards: RewardItem[] = [
      { id: 'rb1', name: 'B Prize', quantity: 1, tier: 'B' },
    ];

    const wins: Record<string, number> = {};
    const runs = 500;

    for (let i = 0; i < runs; i++) {
      const result = runLottery(participants, rewards, {
        ...defaultConfig,
        seed: `tier-b-test-${i}`,
      });
      if (result.winners.length > 0) {
        const winnerId = result.winners[0].participant.id;
        wins[winnerId] = (wins[winnerId] ?? 0) + 1;
      }
    }

    // Each of 5 players should win roughly 20% of the time (allow 8%-35%)
    for (const pid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      const rate = (wins[pid] ?? 0) / runs;
      expect(rate, `${pid} win rate`).toBeGreaterThan(0.08);
      expect(rate, `${pid} win rate`).toBeLessThan(0.35);
    }
  });
});

describe('verifyResult', () => {
  it('should return true for a valid unmodified result', () => {
    const participants = makeParticipants(10);
    const result = runLottery(participants, sampleRewards, defaultConfig);
    expect(verifyResult(participants, sampleRewards, result)).toBe(true);
  });

  it('should return false for a tampered result', () => {
    const participants = makeParticipants(10);
    const result = runLottery(participants, sampleRewards, defaultConfig);

    // Tamper: swap first winner's participant
    const tampered = {
      ...result,
      winners: [...result.winners],
    };
    if (tampered.winners.length >= 2) {
      tampered.winners[0] = {
        ...tampered.winners[0],
        participant: tampered.winners[1].participant,
      };
    }

    expect(verifyResult(participants, sampleRewards, tampered)).toBe(false);
  });
});
