export type {
  Participant,
  RewardItem,
  LotteryConfig,
  Winner,
  LotteryResult,
} from './types.js';

export {
  calculateWeight,
  weightedRandomSelect,
  runLottery,
  verifyResult,
} from './lottery-engine.js';

export {
  generateDistributionList,
  generateMailTemplate,
  generateCheckList,
  exportCSV,
  exportJSON,
} from './distribution.js';
