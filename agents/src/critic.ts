/**
 * 批判員エージェント (Critic Agent)
 *
 * 調査データや計算ロジックに対して反証を試み、
 * エッジケースや矛盾を指摘する。情報源の信頼性を評価し、
 * 仮説を壊す役割を担う。
 */

import type { AgentConfig, CriticReport, InvestigationReport } from './types';
import { CRITIC_PROMPT } from './prompts';

/** 批判員エージェント設定を生成 */
export function createCritic(): AgentConfig {
  return {
    name: '批判員',
    role: 'critic',
    description:
      '調査データの正確性を厳しく検証するエージェント。' +
      '矛盾、エッジケース、情報源の信頼性を評価し反証を試みる。',
    systemPrompt: CRITIC_PROMPT,
  };
}

/** 批判レポートIDを生成 */
export function createCriticReportId(targetReportId: string): string {
  return `crt-${targetReportId}-${Date.now()}`;
}

/** 空の批判レポートテンプレートを生成 */
export function createEmptyCriticReport(
  targetReportId: string,
): CriticReport {
  return {
    id: createCriticReportId(targetReportId),
    targetReportId,
    issues: [],
    overallAssessment: 'needs_revision',
    summary: '',
    timestamp: Date.now(),
  };
}

/** 批判員への検証依頼メッセージを構築 */
export function buildCriticRequest(
  investigationReport: InvestigationReport,
  knownVerifiedData?: Record<string, unknown>,
): string {
  let message = `以下の調査レポートを厳しく検証してください。\n\n`;

  message += `## 調査レポート\n`;
  message += '```json\n' + JSON.stringify(investigationReport, null, 2) + '\n```\n\n';

  if (knownVerifiedData) {
    message += `## 実測確認済みの参照データ\n`;
    message += '```json\n' + JSON.stringify(knownVerifiedData, null, 2) + '\n```\n\n';
    message += `上記の確認済みデータとの整合性もチェックしてください。\n\n`;
  }

  message += `## 検証要件\n`;
  message += `以下の観点で全てのデータポイントを検証してください:\n\n`;
  message += `1. **情報源の信頼性**: 情報源は最新版に基づいているか？\n`;
  message += `2. **データの整合性**: 同世代の他英雄と比較して異常値はないか？\n`;
  message += `3. **PvP/PvE差異**: モードによって異なる値を持つ可能性はないか？\n`;
  message += `4. **数学的検証**: ダメージ計算式に代入して妥当か？\n`;
  message += `5. **バージョン差異**: 最近のバランス調整の影響はないか？\n\n`;
  message += `- 各問題にseverity (critical/warning/info) を付与\n`;
  message += `- 問題がない場合もその理由を明記\n`;
  message += `- CriticReport形式のJSONで出力\n`;

  return message;
}

/** 批判レポートに重大な問題があるか判定 */
export function hasCriticalIssues(report: CriticReport): boolean {
  return report.issues.some((issue) => issue.severity === 'critical');
}

/** 再調査が必要か判定 */
export function needsReInvestigation(report: CriticReport): boolean {
  return (
    report.overallAssessment === 'needs_revision' ||
    report.overallAssessment === 'rejected'
  );
}

/** 批判レポートから再調査対象フィールドを抽出 */
export function extractFieldsToReInvestigate(
  report: CriticReport,
): { field: string; description: string; suggestedAction: string }[] {
  return report.issues
    .filter((issue) => issue.severity === 'critical' || issue.severity === 'warning')
    .map((issue) => ({
      field: issue.field,
      description: issue.description,
      suggestedAction: issue.suggestedAction,
    }));
}
