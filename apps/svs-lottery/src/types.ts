export interface Participant {
  id: string;
  name: string;
  kills: number;
  score: number;
  daysActive: number;
  rank?: string;
}

export interface RewardItem {
  id: string;
  name: string;
  quantity: number;
  tier: 'S' | 'A' | 'B';
  icon?: string;
}

export interface LotteryConfig {
  weights: {
    kills: number;
    score: number;
    daysActive: number;
    base: number;
  };
  seed?: string;
}

export interface Winner {
  participant: Participant;
  reward: RewardItem;
  weight: number;
  probability: number;
}

export interface LotteryResult {
  winners: Winner[];
  seed: string;
  timestamp: number;
  config: LotteryConfig;
}
