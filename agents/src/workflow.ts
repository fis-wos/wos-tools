/**
 * WOS Data Verification Workflow
 *
 * 3つのエージェント（調査員・批判員・比較検討員）の連携ワークフロー。
 * Claude APIを使用して各エージェントを順次実行し、データ検証を行う。
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  InvestigationReport,
  CriticReport,
  ComparisonReport,
  VerificationResult,
  OptimizationResult,
  DataPoint,
} from './types';
import { createInvestigator, buildInvestigationRequest, buildReInvestigationRequest } from './investigator';
import { createCritic, buildCriticRequest, needsReInvestigation, extractFieldsToReInvestigate } from './critic';
import { createEvaluator, buildVerificationEvaluationRequest, buildOptimizationEvaluationRequest, extractRecommendedData } from './evaluator';

/** ワークフロー設定 */
export interface WorkflowConfig {
  /** Anthropic APIクライアント */
  client: Anthropic;
  /** 使用するモデル */
  model?: string;
  /** 最大再調査回数 */
  maxReInvestigations?: number;
  /** 各エージェントの最大トークン数 */
  maxTokens?: number;
  /** 進捗コールバック */
  onProgress?: (step: string, detail: string) => void;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_REINVESTIGATIONS = 1;

/** エージェントにメッセージを送信し、レスポンスを取得 */
async function callAgent(
  config: WorkflowConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await config.client.messages.create({
    model: config.model ?? DEFAULT_MODEL,
    max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('エージェントからテキスト応答を取得できませんでした');
  }
  return textBlock.text;
}

/** レスポンスからJSONを抽出 */
function extractJson<T>(response: string): T {
  // ```json ... ``` ブロックを探す
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]) as T;
  }

  // JSONブロックがない場合、レスポンス全体をパースを試みる
  // 先頭/末尾の非JSONテキストを除去
  const trimmed = response.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
  return JSON.parse(trimmed) as T;
}

/**
 * データ検証ワークフロー
 *
 * 1. 調査員が情報収集
 * 2. 批判員が調査結果を検証
 * 3. 必要なら調査員に再調査依頼
 * 4. 比較検討員が最終評価
 * 5. 確定データを出力
 */
export async function runVerificationWorkflow(
  heroId: string,
  currentData: Record<string, unknown> | undefined,
  config: WorkflowConfig,
): Promise<VerificationResult> {
  const investigator = createInvestigator();
  const critic = createCritic();
  const evaluator = createEvaluator();
  const maxReInvestigations = config.maxReInvestigations ?? DEFAULT_MAX_REINVESTIGATIONS;
  const progress = config.onProgress ?? (() => {});

  // Step 1: 調査員が情報収集
  progress('investigation', `英雄 ${heroId} のデータ調査を開始`);
  const investigationMessage = buildInvestigationRequest(heroId, currentData);
  const investigationResponse = await callAgent(
    config,
    investigator.systemPrompt,
    investigationMessage,
  );
  const investigation = extractJson<InvestigationReport>(investigationResponse);
  progress('investigation', `調査完了: ${investigation.findings.length}件のデータポイント`);

  // Step 2: 批判員が調査結果を検証
  progress('criticism', '調査結果の検証を開始');
  const criticMessage = buildCriticRequest(investigation);
  const criticResponse = await callAgent(
    config,
    critic.systemPrompt,
    criticMessage,
  );
  const criticism = extractJson<CriticReport>(criticResponse);
  progress('criticism', `検証完了: ${criticism.issues.length}件の指摘 (${criticism.overallAssessment})`);

  // Step 3: 必要なら再調査
  let reInvestigation: InvestigationReport | undefined;

  if (needsReInvestigation(criticism) && maxReInvestigations > 0) {
    progress('re-investigation', '再調査を依頼');
    const fieldsToReInvestigate = extractFieldsToReInvestigate(criticism);
    const reInvestigationMessage = buildReInvestigationRequest(
      heroId,
      investigation.findings,
      fieldsToReInvestigate,
    );
    const reInvestigationResponse = await callAgent(
      config,
      investigator.systemPrompt,
      reInvestigationMessage,
    );
    reInvestigation = extractJson<InvestigationReport>(reInvestigationResponse);
    progress('re-investigation', `再調査完了: ${reInvestigation.findings.length}件のデータポイント`);
  }

  // Step 4: 比較検討員が最終評価
  progress('evaluation', '最終評価を開始');
  const evaluationMessage = buildVerificationEvaluationRequest(
    heroId,
    investigation,
    criticism,
    reInvestigation,
  );
  const evaluationResponse = await callAgent(
    config,
    evaluator.systemPrompt,
    evaluationMessage,
  );
  const comparison = extractJson<ComparisonReport>(evaluationResponse);
  progress('evaluation', '最終評価完了');

  // Step 5: 確定データを構築
  const finalData = extractRecommendedData(investigation, reInvestigation, criticism);

  const verifiedCount = finalData.filter((d) => d.confidence === 'high').length;
  const totalCount = finalData.length;
  let status: VerificationResult['status'];
  if (verifiedCount === totalCount && totalCount > 0) {
    status = 'verified';
  } else if (verifiedCount > 0) {
    status = 'partially_verified';
  } else {
    status = 'unverified';
  }

  return {
    heroId,
    investigation,
    criticism,
    reInvestigation,
    comparison,
    finalData,
    status,
  };
}

/**
 * 編成最適化ワークフロー
 *
 * 1. 調査員が候補編成を列挙
 * 2. 批判員が各編成の弱点を指摘
 * 3. 比較検討員が最適解を導出
 */
export async function runOptimizationWorkflow(
  scenario: string,
  config: WorkflowConfig,
): Promise<OptimizationResult> {
  const investigator = createInvestigator();
  const critic = createCritic();
  const evaluator = createEvaluator();
  const progress = config.onProgress ?? (() => {});

  // Step 1: 調査員が候補編成を列挙
  progress('investigation', `シナリオ「${scenario}」の候補編成を調査開始`);
  const candidateMessage =
    `以下のシナリオに適した編成候補を調査してください。\n\n` +
    `## シナリオ\n${scenario}\n\n` +
    `## 要件\n` +
    `- 最低3つ、最大5つの候補編成を列挙\n` +
    `- 各編成の英雄構成とその理由\n` +
    `- 想定される強みとシナジー\n` +
    `- InvestigationReport形式のJSONで出力\n`;
  const candidateResponse = await callAgent(
    config,
    investigator.systemPrompt,
    candidateMessage,
  );
  const candidates = extractJson<InvestigationReport>(candidateResponse);
  progress('investigation', '候補編成の調査完了');

  // Step 2: 批判員が各編成の弱点を指摘
  progress('criticism', '各編成の弱点分析を開始');
  const weaknessMessage = buildCriticRequest(candidates);
  const weaknessResponse = await callAgent(
    config,
    critic.systemPrompt,
    weaknessMessage,
  );
  const weaknesses = extractJson<CriticReport>(weaknessResponse);
  progress('criticism', `弱点分析完了: ${weaknesses.issues.length}件の指摘`);

  // Step 3: 比較検討員が最適解を導出
  progress('evaluation', '最適編成の評価を開始');
  const evaluationMessage = buildOptimizationEvaluationRequest(
    scenario,
    candidates,
    weaknesses,
  );
  const evaluationResponse = await callAgent(
    config,
    evaluator.systemPrompt,
    evaluationMessage,
  );
  const evaluation = extractJson<ComparisonReport>(evaluationResponse);
  progress('evaluation', '最適編成の評価完了');

  return {
    scenario,
    candidates,
    weaknesses,
    evaluation,
    recommendation: evaluation.recommendation,
  };
}
