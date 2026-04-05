/**
 * @wos-tools/agents
 *
 * WOSデータ検証エージェントチーム
 * 調査員・批判員・比較検討員の3エージェントが連携してデータの正確性を担保する。
 */

// Types
export type {
  DataPoint,
  DataSource,
  Confidence,
  InvestigationReport,
  CriticIssue,
  CriticReport,
  ComparisonOption,
  ComparisonReport,
  AgentConfig,
  AgentRole,
  VerificationResult,
  OptimizationResult,
} from './types';

// Agents
export {
  createInvestigator,
  createInvestigationReportId,
  createEmptyInvestigationReport,
  buildInvestigationRequest,
  buildReInvestigationRequest,
} from './investigator';

export {
  createCritic,
  createCriticReportId,
  createEmptyCriticReport,
  buildCriticRequest,
  hasCriticalIssues,
  needsReInvestigation,
  extractFieldsToReInvestigate,
} from './critic';

export {
  createEvaluator,
  createComparisonReportId,
  createEmptyComparisonReport,
  buildVerificationEvaluationRequest,
  buildOptimizationEvaluationRequest,
  extractRecommendedData,
} from './evaluator';

// Prompts
export {
  WOS_CONTEXT,
  INVESTIGATOR_PROMPT,
  CRITIC_PROMPT,
  EVALUATOR_PROMPT,
} from './prompts';

// Workflow
export type { WorkflowConfig } from './workflow';
export {
  runVerificationWorkflow,
  runOptimizationWorkflow,
} from './workflow';
