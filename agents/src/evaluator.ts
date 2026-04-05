/**
 * 比較検討員エージェント (Evaluator Agent)
 *
 * 複数の仮説・編成案・アルゴリズムを並べて比較分析し、
 * トレードオフを整理した上で最適案を推薦する。
 */

import type {
  AgentConfig,
  ComparisonReport,
  InvestigationReport,
  CriticReport,
  DataPoint,
} from './types';
import { EVALUATOR_PROMPT } from './prompts';

/** 比較検討員エージェント設定を生成 */
export function createEvaluator(): AgentConfig {
  return {
    name: '比較検討員',
    role: 'evaluator',
    description:
      '複数の選択肢を公平に比較・評価し、最適案を推薦するエージェント。' +
      '定量的スコアリングとトレードオフ分析を行う。',
    systemPrompt: EVALUATOR_PROMPT,
  };
}

/** 比較レポートIDを生成 */
export function createComparisonReportId(topic: string): string {
  const sanitized = topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  return `eval-${sanitized}-${Date.now()}`;
}

/** 空の比較レポートテンプレートを生成 */
export function createEmptyComparisonReport(
  topic: string,
): ComparisonReport {
  return {
    id: createComparisonReportId(topic),
    topic,
    options: [],
    evaluationCriteria: [],
    recommendation: '',
    tradeoffs: '',
    timestamp: Date.now(),
  };
}

/** データ検証ワークフロー用の比較依頼メッセージを構築 */
export function buildVerificationEvaluationRequest(
  heroId: string,
  investigation: InvestigationReport,
  criticism: CriticReport,
  reInvestigation?: InvestigationReport,
): string {
  let message = `以下の英雄のデータ検証結果を比較評価し、最終的なデータの採用判断をしてください。\n\n`;
  message += `## 対象英雄\nID: ${heroId}\n\n`;

  message += `## 初回調査結果\n`;
  message += '```json\n' + JSON.stringify(investigation, null, 2) + '\n```\n\n';

  message += `## 批判員の検証結果\n`;
  message += '```json\n' + JSON.stringify(criticism, null, 2) + '\n```\n\n';

  if (reInvestigation) {
    message += `## 再調査結果\n`;
    message += '```json\n' + JSON.stringify(reInvestigation, null, 2) + '\n```\n\n';
  }

  message += `## 評価要件\n`;
  message += `各データポイントについて、以下を判断してください:\n\n`;
  message += `1. どの値を採用すべきか（初回調査値 vs 再調査値 vs 現行値維持）\n`;
  message += `2. 採用する値の信頼度\n`;
  message += `3. 追加検証が必要なフィールドはあるか\n\n`;
  message += `評価軸: 信頼度 (Reliability), 鮮度 (Freshness), 再現性 (Reproducibility), 整合性 (Consistency), 影響度 (Impact)\n\n`;
  message += `ComparisonReport形式のJSONで出力してください。\n`;
  message += `また、最終的に採用すべきDataPoint[]もrecommendation内に含めてください。\n`;

  return message;
}

/** 編成最適化ワークフロー用の比較依頼メッセージを構築 */
export function buildOptimizationEvaluationRequest(
  scenario: string,
  candidates: InvestigationReport,
  weaknesses: CriticReport,
): string {
  let message = `以下のシナリオに対する編成候補を比較評価し、最適案を推薦してください。\n\n`;
  message += `## シナリオ\n${scenario}\n\n`;

  message += `## 候補編成一覧（調査員作成）\n`;
  message += '```json\n' + JSON.stringify(candidates, null, 2) + '\n```\n\n';

  message += `## 各編成の弱点分析（批判員作成）\n`;
  message += '```json\n' + JSON.stringify(weaknesses, null, 2) + '\n```\n\n';

  message += `## 評価要件\n`;
  message += `評価軸: 総合火力, 耐久性, シナジー, 汎用性, 育成コスト\n\n`;
  message += `- 各候補を0-100でスコアリング\n`;
  message += `- トレードオフを明示\n`;
  message += `- シナリオに最適な編成を推薦（理由付き）\n`;
  message += `- 代替案も提示\n`;
  message += `ComparisonReport形式のJSONで出力してください。\n`;

  return message;
}

/** 比較レポートから最終採用データを抽出するヘルパー */
export function extractRecommendedData(
  investigation: InvestigationReport,
  reInvestigation: InvestigationReport | undefined,
  criticism: CriticReport,
): DataPoint[] {
  const criticalFields = new Set(
    criticism.issues
      .filter((i) => i.severity === 'critical')
      .map((i) => i.field),
  );

  // 再調査結果があるフィールドはそちらを優先
  const reInvestigatedFields = new Set(
    reInvestigation?.findings.map((f) => f.field) ?? [],
  );

  const result: DataPoint[] = [];

  for (const finding of investigation.findings) {
    if (criticalFields.has(finding.field) && !reInvestigatedFields.has(finding.field)) {
      // 批判員がcriticalと判定し、再調査もされていない → 除外
      continue;
    }

    if (reInvestigatedFields.has(finding.field)) {
      // 再調査された → 再調査結果を採用
      const reData = reInvestigation!.findings.find(
        (f) => f.field === finding.field,
      );
      if (reData) {
        result.push(reData);
        continue;
      }
    }

    // それ以外 → 初回調査結果を採用
    result.push(finding);
  }

  // 再調査で新規に追加されたフィールドも含める
  if (reInvestigation) {
    for (const finding of reInvestigation.findings) {
      if (!result.some((r) => r.field === finding.field)) {
        result.push(finding);
      }
    }
  }

  return result;
}
