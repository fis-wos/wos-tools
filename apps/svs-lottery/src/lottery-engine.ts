import type {
  Participant,
  RewardItem,
  LotteryConfig,
  Winner,
  LotteryResult,
} from './types.js';

// ---- Seeded PRNG (mulberry32) ----

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed: string): () => number {
  return mulberry32(hashString(seed));
}

// ---- Helpers ----

function generateSeed(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function normalize(values: number[]): number[] {
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => v / max);
}

// ---- Core Functions ----

export function calculateWeight(
  participant: Participant,
  allParticipants: Participant[],
  config: LotteryConfig,
): number {
  const killsArr = allParticipants.map((p) => p.kills);
  const scoreArr = allParticipants.map((p) => p.score);
  const daysArr = allParticipants.map((p) => p.daysActive);

  const normKills = normalize(killsArr);
  const normScore = normalize(scoreArr);
  const normDays = normalize(daysArr);

  const idx = allParticipants.indexOf(participant);
  if (idx === -1) return 0;

  const w = config.weights;
  return (
    normKills[idx] * w.kills +
    normScore[idx] * w.score +
    normDays[idx] * w.daysActive +
    w.base
  );
}

export function weightedRandomSelect(
  participants: Participant[],
  weights: number[],
  rng: () => number,
  exclude: Set<string> = new Set(),
): { participant: Participant; weight: number; probability: number } | null {
  const eligible: { participant: Participant; weight: number }[] = [];
  for (let i = 0; i < participants.length; i++) {
    if (!exclude.has(participants[i].id)) {
      eligible.push({ participant: participants[i], weight: weights[i] });
    }
  }

  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return null;

  const r = rng() * totalWeight;
  let cumulative = 0;
  for (const entry of eligible) {
    cumulative += entry.weight;
    if (r <= cumulative) {
      return {
        participant: entry.participant,
        weight: entry.weight,
        probability: entry.weight / totalWeight,
      };
    }
  }

  // Fallback (floating point edge case)
  const last = eligible[eligible.length - 1];
  return {
    participant: last.participant,
    weight: last.weight,
    probability: last.weight / totalWeight,
  };
}

export function runLottery(
  participants: Participant[],
  rewards: RewardItem[],
  config: LotteryConfig,
): LotteryResult {
  const seed = config.seed || generateSeed();
  const rng = createRng(seed);

  // Calculate weights for all participants
  const weights = participants.map((p) => calculateWeight(p, participants, config));

  // Sort rewards by tier priority: S -> A -> B
  const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2 };
  const sortedRewards = [...rewards].sort(
    (a, b) => tierOrder[a.tier] - tierOrder[b.tier],
  );

  const winners: Winner[] = [];
  const assigned = new Set<string>();

  // Rank participants by weight (descending) for Tier S
  const ranked = participants
    .map((p, i) => ({ participant: p, weight: weights[i] }))
    .sort((a, b) => b.weight - a.weight);

  for (const reward of sortedRewards) {
    if (reward.tier === 'S') {
      // Tier S: prioritise top contributors (weighted heavily toward top)
      // Create boosted weights: square the weights to amplify differences
      const boostedWeights = weights.map((w) => w * w);
      const selected = weightedRandomSelect(participants, boostedWeights, rng, assigned);
      if (selected) {
        winners.push({ ...selected, reward });
        assigned.add(selected.participant.id);
      }
    } else if (reward.tier === 'A') {
      // Tier A: standard weighted random
      const selected = weightedRandomSelect(participants, weights, rng, assigned);
      if (selected) {
        winners.push({ ...selected, reward });
        assigned.add(selected.participant.id);
      }
    } else {
      // Tier B: equal chance (participation prize)
      const equalWeights = participants.map(() => 1);
      const selected = weightedRandomSelect(participants, equalWeights, rng, assigned);
      if (selected) {
        winners.push({ ...selected, reward });
        assigned.add(selected.participant.id);
      }
    }
  }

  return {
    winners,
    seed,
    timestamp: Date.now(),
    config: { ...config, seed },
  };
}

export function verifyResult(
  participants: Participant[],
  rewards: RewardItem[],
  result: LotteryResult,
): boolean {
  const reproduced = runLottery(participants, rewards, {
    ...result.config,
    seed: result.seed,
  });

  if (reproduced.winners.length !== result.winners.length) return false;

  for (let i = 0; i < reproduced.winners.length; i++) {
    if (reproduced.winners[i].participant.id !== result.winners[i].participant.id) return false;
    if (reproduced.winners[i].reward.id !== result.winners[i].reward.id) return false;
  }

  return true;
}
