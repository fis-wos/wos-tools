import type { LotteryResult, Winner } from './types.js';

export interface DistributionEntry {
  playerName: string;
  playerId: string;
  rewardName: string;
  rewardTier: string;
  quantity: number;
  probability: string;
  distributed: boolean;
}

export function generateDistributionList(result: LotteryResult): DistributionEntry[] {
  return result.winners.map((w) => ({
    playerName: w.participant.name,
    playerId: w.participant.id,
    rewardName: w.reward.name,
    rewardTier: w.reward.tier,
    quantity: w.reward.quantity,
    probability: (w.probability * 100).toFixed(2) + '%',
    distributed: false,
  }));
}

export function generateMailTemplate(winner: Winner): string {
  return [
    `【SVS褒賞】おめでとうございます！`,
    ``,
    `${winner.participant.name} さん`,
    ``,
    `SVSイベントへの貢献ありがとうございました！`,
    `抽選の結果、以下の報酬が当選しました。`,
    ``,
    `■ 報酬: ${winner.reward.name} × ${winner.reward.quantity}`,
    `■ Tier: ${winner.reward.tier}`,
    `■ 当選確率: ${(winner.probability * 100).toFixed(2)}%`,
    ``,
    `近日中にゲーム内メールにてお届けします。`,
    `引き続きよろしくお願いします！`,
  ].join('\n');
}

export function generateCheckList(result: LotteryResult): string {
  const lines = [
    `SVS褒賞 配布チェックリスト`,
    `シード値: ${result.seed}`,
    `生成日時: ${new Date(result.timestamp).toLocaleString('ja-JP')}`,
    `---`,
  ];

  for (const w of result.winners) {
    lines.push(
      `[ ] ${w.participant.name} → ${w.reward.name}(${w.reward.tier}) × ${w.reward.quantity}`,
    );
  }

  return lines.join('\n');
}

export function exportCSV(result: LotteryResult): string {
  const header = 'プレイヤー名,プレイヤーID,報酬名,Tier,数量,当選確率,配布済み';
  const rows = result.winners.map(
    (w) =>
      [
        `"${w.participant.name}"`,
        `"${w.participant.id}"`,
        `"${w.reward.name}"`,
        w.reward.tier,
        w.reward.quantity,
        (w.probability * 100).toFixed(2) + '%',
        'FALSE',
      ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function exportJSON(result: LotteryResult): string {
  return JSON.stringify(result, null, 2);
}
