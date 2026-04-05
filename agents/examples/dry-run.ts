/**
 * APIキー不要のドライランテスト
 * ワークフローの構造・型・プロンプト構築を検証する
 * 実行: npx tsx examples/dry-run.ts
 */

import { createInvestigator, buildInvestigationRequest, buildReInvestigationRequest } from '../src/investigator';
import { createCritic, buildCriticRequest, needsReInvestigation, hasCriticalIssues, extractFieldsToReInvestigate } from '../src/critic';
import { createEvaluator, buildVerificationEvaluationRequest, buildOptimizationEvaluationRequest, extractRecommendedData } from '../src/evaluator';
import type { InvestigationReport, CriticReport, DataPoint } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

// =============================================================
// 1. エージェント設定の検証
// =============================================================
section('1. エージェント設定');

const investigator = createInvestigator();
assert(investigator.role === 'investigator', 'investigator.role === "investigator"');
assert(investigator.name === '調査員', 'investigator.name === "調査員"');
assert(investigator.systemPrompt.length > 100, 'investigator.systemPrompt is non-trivial');
assert(investigator.systemPrompt.includes('Whiteout Survival'), 'investigator.systemPrompt contains WOS context');

const critic = createCritic();
assert(critic.role === 'critic', 'critic.role === "critic"');
assert(critic.name === '批判員', 'critic.name === "批判員"');
assert(critic.systemPrompt.includes('反証'), 'critic.systemPrompt contains key term "反証"');

const evaluator = createEvaluator();
assert(evaluator.role === 'evaluator', 'evaluator.role === "evaluator"');
assert(evaluator.name === '比較検討員', 'evaluator.name === "比較検討員"');
assert(evaluator.systemPrompt.includes('トレードオフ'), 'evaluator.systemPrompt contains key term "トレードオフ"');

// =============================================================
// 2. 調査依頼メッセージの構築
// =============================================================
section('2. 調査依頼メッセージ構築');

const currentData = {
  s1: { tp: 'always', prob: 1, atkBuf: 25 },
  s2: { tp: 'prob', prob: 0.40, defBuf: 50 },
};

const investigationMsg = buildInvestigationRequest('magnus', currentData, ['s1.atkBuf', 's2.defBuf']);
assert(investigationMsg.includes('magnus'), 'investigation message includes heroId');
assert(investigationMsg.includes('atkBuf'), 'investigation message includes currentData fields');
assert(investigationMsg.includes('s1.atkBuf'), 'investigation message includes focus fields');
assert(investigationMsg.includes('InvestigationReport'), 'investigation message requests JSON format');

const investigationMsgMinimal = buildInvestigationRequest('shura');
assert(investigationMsgMinimal.includes('shura'), 'minimal investigation message includes heroId');
assert(!investigationMsgMinimal.includes('検証対象'), 'minimal message omits currentData section');

// =============================================================
// 3. 批判依頼メッセージの構築
// =============================================================
section('3. 批判依頼メッセージ構築');

const mockInvestigation: InvestigationReport = {
  id: 'inv-magnus-1234567890',
  heroId: 'magnus',
  investigator: 'investigator-agent',
  findings: [
    {
      heroId: 'magnus',
      field: 's1.atkBuf',
      value: 25,
      source: 'wiki',
      confidence: 'medium',
      timestamp: Date.now(),
      notes: 'Fandom wiki記載値',
    },
    {
      heroId: 'magnus',
      field: 's2.defBuf',
      value: 50,
      source: 'screenshot',
      confidence: 'high',
      timestamp: Date.now(),
      notes: '実機スクリーンショットで確認',
    },
  ],
  summary: 'マグナスのスキル1・2のバフ値を調査',
  timestamp: Date.now(),
};

const criticMsg = buildCriticRequest(mockInvestigation);
assert(criticMsg.includes('inv-magnus-1234567890'), 'critic message includes report ID');
assert(criticMsg.includes('s1.atkBuf'), 'critic message includes finding fields');
assert(criticMsg.includes('CriticReport'), 'critic message requests CriticReport format');

const criticMsgWithRef = buildCriticRequest(mockInvestigation, { 'moa.s1.atkBuf': 20 });
assert(criticMsgWithRef.includes('実測確認済み'), 'critic message with reference data includes verified data section');
assert(criticMsgWithRef.includes('moa.s1.atkBuf'), 'critic message includes reference data fields');

// =============================================================
// 4. 批判レポートの判定ロジック
// =============================================================
section('4. 批判レポート判定ロジック');

const mockCriticApproved: CriticReport = {
  id: 'crt-inv-magnus-1234567890-9999',
  targetReportId: 'inv-magnus-1234567890',
  issues: [
    {
      field: 's1.atkBuf',
      severity: 'info',
      description: '値は妥当だが、バージョン情報がない',
      suggestedAction: 'バージョンを追記',
    },
  ],
  overallAssessment: 'approved',
  summary: '大きな問題なし',
  timestamp: Date.now(),
};

assert(!hasCriticalIssues(mockCriticApproved), 'approved report has no critical issues');
assert(!needsReInvestigation(mockCriticApproved), 'approved report does not need re-investigation');

const mockCriticRevision: CriticReport = {
  id: 'crt-inv-magnus-1234567890-8888',
  targetReportId: 'inv-magnus-1234567890',
  issues: [
    {
      field: 's1.atkBuf',
      severity: 'critical',
      description: 'Wiki情報が古い可能性あり。最新パッチで変更されている',
      evidence: 'v2.5パッチノートで調整記載あり',
      suggestedAction: '最新バージョンの実機確認が必要',
    },
    {
      field: 's2.defBuf',
      severity: 'warning',
      description: 'PvPとPvEで異なる値の可能性',
      suggestedAction: 'PvPでの実測を追加確認',
    },
  ],
  overallAssessment: 'needs_revision',
  summary: '要再調査',
  timestamp: Date.now(),
};

assert(hasCriticalIssues(mockCriticRevision), 'revision report has critical issues');
assert(needsReInvestigation(mockCriticRevision), 'revision report needs re-investigation');

const fieldsToReInvestigate = extractFieldsToReInvestigate(mockCriticRevision);
assert(fieldsToReInvestigate.length === 2, 'extracts 2 fields to re-investigate (critical + warning)');
assert(fieldsToReInvestigate[0].field === 's1.atkBuf', 'first field is s1.atkBuf');

// =============================================================
// 5. 再調査依頼メッセージの構築
// =============================================================
section('5. 再調査依頼メッセージ構築');

const reInvestigationMsg = buildReInvestigationRequest(
  'magnus',
  mockInvestigation.findings,
  fieldsToReInvestigate,
);
assert(reInvestigationMsg.includes('再調査'), 're-investigation message includes keyword');
assert(reInvestigationMsg.includes('s1.atkBuf'), 're-investigation message includes target field');
assert(reInvestigationMsg.includes('最新パッチで変更'), 're-investigation message includes critic description');

// =============================================================
// 6. 比較検討依頼メッセージの構築
// =============================================================
section('6. 比較検討依頼メッセージ構築');

const evalMsg = buildVerificationEvaluationRequest(
  'magnus',
  mockInvestigation,
  mockCriticRevision,
);
assert(evalMsg.includes('magnus'), 'evaluation message includes heroId');
assert(evalMsg.includes('初回調査結果'), 'evaluation message includes investigation section');
assert(evalMsg.includes('批判員の検証結果'), 'evaluation message includes criticism section');
assert(evalMsg.includes('ComparisonReport'), 'evaluation message requests ComparisonReport format');

// 再調査ありの場合
const mockReInvestigation: InvestigationReport = {
  id: 'inv-magnus-re-1234567890',
  heroId: 'magnus',
  investigator: 'investigator-agent',
  findings: [
    {
      heroId: 'magnus',
      field: 's1.atkBuf',
      value: 30,
      source: 'screenshot',
      confidence: 'high',
      timestamp: Date.now(),
      notes: '最新バージョンで実機確認。25%→30%に上方修正されていた',
    },
  ],
  summary: '再調査で値の変更を確認',
  timestamp: Date.now(),
};

const evalMsgWithRe = buildVerificationEvaluationRequest(
  'magnus',
  mockInvestigation,
  mockCriticRevision,
  mockReInvestigation,
);
assert(evalMsgWithRe.includes('再調査結果'), 'evaluation message with re-investigation includes section');

// =============================================================
// 7. 編成最適化の比較依頼メッセージ
// =============================================================
section('7. 編成最適化メッセージ構築');

const optMsg = buildOptimizationEvaluationRequest(
  'G9盾マグナス防衛への集結攻撃',
  mockInvestigation,
  mockCriticApproved,
);
assert(optMsg.includes('マグナス防衛'), 'optimization message includes scenario');
assert(optMsg.includes('総合火力'), 'optimization message includes evaluation criteria');
assert(optMsg.includes('ComparisonReport'), 'optimization message requests ComparisonReport format');

// =============================================================
// 8. 最終データ抽出ロジック (extractRecommendedData)
// =============================================================
section('8. 最終データ抽出ロジック');

// Case A: 批判員approved, 再調査なし -> 初回調査結果をそのまま採用
const finalA = extractRecommendedData(mockInvestigation, undefined, mockCriticApproved);
assert(finalA.length === 2, 'Case A: all 2 findings adopted');
assert(finalA[0].value === 25, 'Case A: s1.atkBuf = 25 (original)');
assert(finalA[1].value === 50, 'Case A: s2.defBuf = 50 (original)');

// Case B: 批判員がcritical指摘, 再調査で更新 -> 再調査値を採用
const finalB = extractRecommendedData(mockInvestigation, mockReInvestigation, mockCriticRevision);
assert(finalB.length === 2, 'Case B: 2 findings total');
const s1Data = finalB.find(d => d.field === 's1.atkBuf');
assert(s1Data !== undefined && s1Data.value === 30, 'Case B: s1.atkBuf = 30 (re-investigated value)');
const s2Data = finalB.find(d => d.field === 's2.defBuf');
assert(s2Data !== undefined && s2Data.value === 50, 'Case B: s2.defBuf = 50 (original, warning only)');

// Case C: 批判員がcritical指摘, 再調査なし -> criticalフィールドは除外
const finalC = extractRecommendedData(mockInvestigation, undefined, mockCriticRevision);
assert(finalC.length === 1, 'Case C: only 1 finding (critical excluded)');
assert(finalC[0].field === 's2.defBuf', 'Case C: only s2.defBuf remains');

// =============================================================
// 9. 型の整合性チェック (コンパイル時チェックの補助)
// =============================================================
section('9. 型の整合性チェック');

// AgentConfig型のプロパティが揃っているか
const agentConfigs = [investigator, critic, evaluator];
for (const ac of agentConfigs) {
  assert(
    typeof ac.name === 'string' && typeof ac.role === 'string' &&
    typeof ac.description === 'string' && typeof ac.systemPrompt === 'string',
    `AgentConfig "${ac.name}" has all required string fields`,
  );
}

// DataPoint型の必須フィールド
const sampleDataPoint: DataPoint = {
  heroId: 'test',
  field: 'test.field',
  value: 42,
  source: 'wiki',
  confidence: 'medium',
  timestamp: Date.now(),
};
assert(sampleDataPoint.heroId === 'test', 'DataPoint heroId is set');
assert(sampleDataPoint.source === 'wiki', 'DataPoint source is a valid DataSource');
assert(sampleDataPoint.confidence === 'medium', 'DataPoint confidence is a valid Confidence');

// =============================================================
// Summary
// =============================================================
console.log(`\n=============================`);
console.log(`  Dry-run results: ${passed} passed, ${failed} failed`);
console.log(`=============================`);

if (failed > 0) {
  process.exit(1);
}
