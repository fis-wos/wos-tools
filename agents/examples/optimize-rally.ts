/**
 * 集結攻撃の最適編成を3エージェントで検討するデモ
 * 環境変数 ANTHROPIC_API_KEY が必要
 * 実行: npx tsx examples/optimize-rally.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { runOptimizationWorkflow } from '../src/workflow';

async function main() {
  const client = new Anthropic();

  const result = await runOptimizationWorkflow(
    '相手がマグナス(G9盾)+ロイド(G11槍)+ライジーア(G12弓)の防衛編成。' +
    '当方はG9-G12の英雄を保有。集結攻撃で最適な編成と兵士比率を提案してください。',
    {
      client,
      model: 'claude-sonnet-4-20250514',
      onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
    }
  );

  console.log('\n=== 最適化結果 ===');
  console.log(`推薦: ${result.recommendation}`);
}

main().catch(console.error);
