/**
 * マグナス(G9盾)のスキルデータを検証するデモ
 * 環境変数 ANTHROPIC_API_KEY が必要
 * 実行: npx tsx examples/verify-hero.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { runVerificationWorkflow } from '../src/workflow';

async function main() {
  const client = new Anthropic();

  const result = await runVerificationWorkflow(
    'magnus',
    {
      // 現在のシミュレーターの値
      s1: { tp: 'always', prob: 1, atkBuf: 25, lbl: '全部隊攻撃力+25%' },
      s2: { tp: 'prob', prob: 0.40, defBuf: 50, lbl: '全部隊防御+50%(40%)' },
      s3: { tp: 'always', prob: 1, defBuf: 10, atkDmgBuf: 10, lbl: '盾被ダメ-10%/弓与ダメ+10%' },
    },
    {
      client,
      model: 'claude-sonnet-4-20250514',
      onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
    }
  );

  console.log('\n=== 検証結果 ===');
  console.log(`ステータス: ${result.status}`);
  console.log(`確定データ: ${result.finalData.length}件`);
  result.finalData.forEach(d => {
    console.log(`  ${d.field}: ${d.value} (信頼度: ${d.confidence}, 出典: ${d.source})`);
  });
}

main().catch(console.error);
