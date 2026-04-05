/**
 * 調査員エージェント (Investigator Agent)
 *
 * ゲーム内データの収集・構造化を担当。
 * 英雄スキル倍率、兵種相性、バフ計算式の調査を行い、
 * 信頼度付きの調査レポートを出力する。
 */

import type { AgentConfig, InvestigationReport, DataPoint } from './types';
import { INVESTIGATOR_PROMPT } from './prompts';

/** 調査員エージェント設定を生成 */
export function createInvestigator(): AgentConfig {
  return {
    name: '調査員',
    role: 'investigator',
    description:
      'WOSの英雄データを収集・構造化する調査エージェント。' +
      '情報源の優先順位に基づき信頼度付きデータを出力する。',
    systemPrompt: INVESTIGATOR_PROMPT,
  };
}

/** 調査レポートIDを生成 */
export function createInvestigationReportId(heroId: string): string {
  return `inv-${heroId}-${Date.now()}`;
}

/** 空の調査レポートテンプレートを生成 */
export function createEmptyInvestigationReport(
  heroId: string,
): InvestigationReport {
  return {
    id: createInvestigationReportId(heroId),
    heroId,
    investigator: 'investigator-agent',
    findings: [],
    summary: '',
    timestamp: Date.now(),
  };
}

/** 調査員への調査依頼メッセージを構築 */
export function buildInvestigationRequest(
  heroId: string,
  currentData?: Record<string, unknown>,
  focusFields?: string[],
): string {
  let message = `以下の英雄のデータを調査してください。\n\n`;
  message += `## 対象英雄\nID: ${heroId}\n\n`;

  if (currentData) {
    message += `## 現在のデータ（検証対象）\n`;
    message += '```json\n' + JSON.stringify(currentData, null, 2) + '\n```\n\n';
    message +=
      'これらの値が正確かどうか、情報源を探して検証してください。\n\n';
  }

  if (focusFields && focusFields.length > 0) {
    message += `## 特に重点調査するフィールド\n`;
    message += focusFields.map((f) => `- ${f}`).join('\n') + '\n\n';
  }

  message += `## 出力要件\n`;
  message += `- 各データポイントに情報源と信頼度を付与\n`;
  message += `- 実測確認済み英雄（モア、シュラ、マグナス）との比較\n`;
  message += `- 複数情報源がある場合は全て記録\n`;
  message += `- InvestigationReport形式のJSONで出力\n`;

  return message;
}

/** 再調査依頼メッセージを構築（批判員からのフィードバック込み） */
export function buildReInvestigationRequest(
  heroId: string,
  originalFindings: DataPoint[],
  criticIssues: { field: string; description: string; suggestedAction: string }[],
): string {
  let message = `以下の英雄について再調査を依頼します。批判員から指摘を受けたフィールドに焦点を当ててください。\n\n`;
  message += `## 対象英雄\nID: ${heroId}\n\n`;

  message += `## 前回の調査結果\n`;
  message += '```json\n' + JSON.stringify(originalFindings, null, 2) + '\n```\n\n';

  message += `## 批判員からの指摘事項\n`;
  for (const issue of criticIssues) {
    message += `### ${issue.field}\n`;
    message += `- 問題: ${issue.description}\n`;
    message += `- 推奨: ${issue.suggestedAction}\n\n`;
  }

  message += `## 再調査要件\n`;
  message += `- 指摘されたフィールドを重点的に追加調査\n`;
  message += `- 可能であればより信頼度の高い情報源を探す\n`;
  message += `- 前回と異なる情報源での裏取り\n`;
  message += `- InvestigationReport形式のJSONで出力\n`;

  return message;
}
