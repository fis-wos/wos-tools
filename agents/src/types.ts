/**
 * WOS Data Verification Agent Team - Type Definitions
 *
 * 3つのエージェント（調査員・批判員・比較検討員）が連携して
 * 英雄データの正確性を担保するためのデータ型定義。
 */

/** 個別データポイント: 英雄スキルの倍率や係数など1つの値 */
export interface DataPoint {
  heroId: string;
  field: string;        // 's1.atkDmgBuf', 'aT', etc.
  value: number;
  source: DataSource;
  sourceUrl?: string;
  confidence: Confidence;
  version?: string;     // ゲームバージョン
  timestamp: number;
  notes?: string;
}

export type DataSource =
  | 'screenshot'    // 実機スクリーンショット
  | 'official'      // 公式発表
  | 'wiki'          // 有名Wiki (Fandom等)
  | 'reddit'        // Reddit投稿
  | 'youtube'       // YouTube動画
  | 'discord'       // Discord情報
  | 'calculation'   // 逆算・推定値
  | 'datamine';     // データマイニング

export type Confidence = 'high' | 'medium' | 'low';

/** 調査員が出力するレポート */
export interface InvestigationReport {
  id: string;
  heroId: string;
  investigator: string;
  findings: DataPoint[];
  summary: string;
  timestamp: number;
}

/** 批判員が指摘する個別の問題 */
export interface CriticIssue {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  evidence?: string;
  suggestedAction: string;
}

/** 批判員が出力するレポート */
export interface CriticReport {
  id: string;
  targetReportId: string;
  issues: CriticIssue[];
  overallAssessment: 'approved' | 'needs_revision' | 'rejected';
  summary: string;
  timestamp: number;
}

/** 比較検討員が評価する1つの選択肢 */
export interface ComparisonOption {
  name: string;
  description: string;
  scores: Record<string, number>;  // 評価軸 -> スコア (0-100)
  pros: string[];
  cons: string[];
}

/** 比較検討員が出力するレポート */
export interface ComparisonReport {
  id: string;
  topic: string;
  options: ComparisonOption[];
  evaluationCriteria: string[];
  recommendation: string;
  tradeoffs: string;
  timestamp: number;
}

/** エージェント設定 */
export interface AgentConfig {
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
}

export type AgentRole = 'investigator' | 'critic' | 'evaluator';

/** ワークフロー実行結果 */
export interface VerificationResult {
  heroId: string;
  investigation: InvestigationReport;
  criticism: CriticReport;
  reInvestigation?: InvestigationReport;
  comparison: ComparisonReport;
  finalData: DataPoint[];
  status: 'verified' | 'partially_verified' | 'unverified';
}

/** 最適化ワークフロー実行結果 */
export interface OptimizationResult {
  scenario: string;
  candidates: InvestigationReport;
  weaknesses: CriticReport;
  evaluation: ComparisonReport;
  recommendation: string;
}
