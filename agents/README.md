# @wos-tools/agents

WOS (Whiteout Survival) データ検証エージェントチーム。

3つのエージェントが連携してゲームデータ（英雄スキル倍率、ダメージ係数等）の正確性を担保する。

## エージェント構成

```
┌─────────────┐     調査結果     ┌─────────────┐
│   調査員     │ ──────────────> │   批判員     │
│ Investigator │ <────────────── │    Critic    │
│              │   再調査依頼     │              │
└──────┬───────┘                 └──────┬───────┘
       │                                │
       │     調査結果 + 批判結果         │
       └──────────┬─────────────────────┘
                  ▼
          ┌──────────────┐
          │ 比較検討員    │
          │  Evaluator   │
          │              │
          └──────┬───────┘
                 │
                 ▼
           確定データ出力
```

### 調査員 (Investigator)
- ゲーム内データの収集・構造化
- 英雄スキル倍率、兵種相性、バフ計算式の調査
- Web上の情報源からのデータ収集
- 各データに信頼度を付与

### 批判員 (Critic)
- 調査データに対して「本当にそうか？」と反証
- エッジケースや矛盾の指摘
- 情報源の信頼性・鮮度の評価
- PvP/PvE差異、バージョン違いの検出

### 比較検討員 (Evaluator)
- 複数の仮説・データセットを並べて比較分析
- 定量的スコアリング（0-100）
- トレードオフの明示と最適案の推薦

## ワークフロー

### データ検証ワークフロー (`runVerificationWorkflow`)

特定の英雄データの正確性を検証する:

1. 調査員が対象英雄のデータを情報収集
2. 批判員が調査結果を厳しく検証
3. 問題があれば調査員に再調査依頼（最大1回）
4. 比較検討員が最終評価・データ採用判断
5. 確定データを出力（verified / partially_verified / unverified）

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { runVerificationWorkflow } from '@wos-tools/agents';

const client = new Anthropic();
const result = await runVerificationWorkflow('shura', currentShuraData, {
  client,
  model: 'claude-sonnet-4-20250514',
  onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
});

console.log(result.status);     // 'verified' | 'partially_verified' | 'unverified'
console.log(result.finalData);  // DataPoint[]
```

### 編成最適化ワークフロー (`runOptimizationWorkflow`)

特定シナリオに最適な編成を導出する:

1. 調査員が候補編成を列挙
2. 批判員が各編成の弱点を指摘
3. 比較検討員が最適解を推薦

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { runOptimizationWorkflow } from '@wos-tools/agents';

const client = new Anthropic();
const result = await runOptimizationWorkflow(
  'G9以下の英雄のみで構成するPvP集結向け盾兵編成',
  {
    client,
    model: 'claude-sonnet-4-20250514',
    onProgress: (step, detail) => console.log(`[${step}] ${detail}`),
  },
);

console.log(result.recommendation);
```

## 個別エージェントの使用

ワークフローを使わず、個別エージェントの設定を取得して自由に使うことも可能:

```typescript
import { createInvestigator, createCritic, createEvaluator } from '@wos-tools/agents';

const investigator = createInvestigator();
console.log(investigator.systemPrompt);  // システムプロンプト取得

const critic = createCritic();
const evaluator = createEvaluator();
```

## 現在の検証状況

| 英雄 | 世代 | 実測確認 | 信頼度 |
|------|------|---------|--------|
| モア (Moa) | G3 | 済 | high |
| シュラ (Shura) | G9 | 済 | high |
| マグナス (Magnus) | - | 済 | high |
| その他 | - | 未 | low (デフォルト値) |

## ビルド

```bash
npm run build
```
