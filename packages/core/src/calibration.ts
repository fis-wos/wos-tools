/**
 * WOS ダメージ計算式キャリブレーション
 *
 * バトルレポートのスクリーンショットから読み取ったデータを用いて、
 * ダメージ計算式の係数 C を逆算する。
 *
 * 既知の式 (battle-engine.ts):
 *   kills = C * sqrt(自軍兵数) * (ATK * Leth) / (敵DEF * 敵HP) * SkillMod * typeBonus * jitter
 *
 * 現在のエンジンでは C=1 が暗黙的に使われている。
 * このスクリプトは実戦データからCの推定値を求め、
 * 併せて負傷/死亡率の定数を検証する。
 *
 * キャリブレーション結果 (2026-04-05 最終版):
 * - 攻撃側敗北: 27% dead / 13% severe / 60% light (実データに合わせて調整)
 * - 防衛側敗北:  0% dead / 35% severe / 65% light
 * - 勝利側:      4% dead / 46% severe / 50% light
 *
 * 確認済みメカニクス:
 * - 兵種レーン制の兵士プール方式
 * - 英雄はグローバルバフ提供者（英雄vsマッチアップではない）
 * - 三すくみ: 盾→弓(+10%), 槍→弓(+10%), 弓→盾(+10%)（殿堂FC3確認）
 * - 槍Ambusher: FC5で20%確率前列飛び越え
 *
 * 注意:
 * - スクショの数値は読み取り精度に限界がある
 * - 追加ステータスの%値は差分表示（自軍-敵軍）の可能性が高い
 * - 推定値には幅を持たせて報告する
 */

// ── Type definitions ──

export interface BattleReportData {
  id: string;
  date: string;
  attacker: {
    totalTroops: number;
    troops?: { shield: number; spear: number; bow: number };
    /** 追加ステータス %値 (バトルレポートの差分表示) */
    stats: { atk: number; def: number; leth: number; hp: number };
    wounded: number;
    dead: number;
    lost: number;
  };
  defender: {
    totalTroops: number;
    troops?: { shield: number; spear: number; bow: number };
    stats: { atk: number; def: number; leth: number; hp: number };
    wounded: number;
    dead: number;
    lost: number;
  };
  winner: 'atk' | 'def';
}

export interface MatchupData {
  id: string;
  atkHero: string;
  defHero: string;
  atkTroops: { shield: number; spear: number; bow: number };
  defTroops: { shield: number; spear: number; bow: number };
}

export interface CalibrationResult {
  estimatedC: number;
  cRange: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
  casualtyAnalysis: CasualtyAnalysis;
  details: CalibrationDetail[];
}

export interface CalibrationDetail {
  reportId: string;
  totalAtkLoss: number;
  totalDefLoss: number;
  estimatedC: number | null;
  notes: string;
}

export interface CasualtyAnalysis {
  /** 各バトルレポートから推定された死亡率 */
  observedDeadRates: { reportId: string; deadRate: number; notes: string }[];
  /** 現在の仮定 (35% dead / 10% severe / 55% light) との整合性 */
  consistentWithModel: boolean;
  analysis: string;
}

// ── Battle report data from screenshots ──

export const BATTLE_REPORTS: BattleReportData[] = [
  {
    id: 'battle1_20250804',
    date: '2025-08-04',
    attacker: {
      totalTroops: 54_642_825,
      stats: { atk: -2645.1, def: -2854.6, leth: -2854.6, hp: -3073.0 },
      // レポート表示: 負傷1,506,384 / 死亡471,121 / 損害168,855
      wounded: 1_506_384,
      dead: 471_121,
      lost: 168_855,
    },
    defender: {
      totalTroops: 0, // 不明
      stats: { atk: -2454.6, def: -2645.1, leth: -2645.1, hp: -2854.6 },
      wounded: 1_506_384,
      dead: 0,
      lost: 0,
    },
    winner: 'atk', // 攻撃側勝利と推定（攻撃側の損害が小さい）
  },
  {
    id: 'battle2_20250609',
    date: '2025-06-09',
    attacker: {
      totalTroops: 36_752_456,
      stats: { atk: -2196.7, def: -2454.6, leth: -2454.6, hp: -2826.5 },
      wounded: 1_536_632,
      dead: 551_897,
      lost: 847_361,
    },
    defender: {
      totalTroops: 34_027_363,
      stats: { atk: -2849.8, def: -3073.0, leth: -3073.0, hp: -3176.1 },
      wounded: 1_536_612,
      dead: 0,
      lost: 0,
    },
    winner: 'def', // 防衛側勝利と推定（攻撃側の損害が大きい）
  },
  {
    id: 'battle3_20260110',
    date: '2026-01-10',
    attacker: {
      totalTroops: 75_520_358,
      stats: { atk: 0, def: 0, leth: 0, hp: 0 }, // 不明
      wounded: 1_104_472,
      dead: 51_148,
      lost: 51_398,
    },
    defender: {
      totalTroops: 66_025_828,
      stats: { atk: 0, def: 0, leth: 0, hp: 0 }, // 不明
      wounded: 1_104_112,
      dead: 0,
      lost: 1_092_152,
    },
    winner: 'atk', // 攻撃側勝利（防衛側損害が大きい、生存300,826）
  },
];

// ── Special enhancement data from battle reports ──

export interface SpecialEnhancementData {
  id: string;
  /** ATK差 (攻撃側 - 防衛側) */
  atkDiff: number;
  /** DEF差 (攻撃側 - 防衛側) */
  defDiffRange: { min: number; max: number };
  /** 敵歩兵HP上昇 */
  enemyInfantryHpBoost: number;
  /** 集結部隊強化 */
  rallyBoost: number;
}

export const SPECIAL_ENHANCEMENTS: SpecialEnhancementData[] = [
  {
    id: 'enhancement_battle2_3',
    atkDiff: -39.0,
    defDiffRange: { min: -30.0, max: -8.0 },
    enemyInfantryHpBoost: 5.0,
    rallyBoost: -6.0,
  },
];

// ── Calibrated casualty rates (2026-04-05 final) ──

export const CALIBRATED_CASUALTY_RATES = {
  /** 攻撃側敗北: 実データから35%→27%に下方修正 */
  atkLoser: { dead: 0.27, severeWound: 0.13, lightWound: 0.60 },
  /** 防衛側敗北: 変更なし */
  defLoser: { dead: 0.00, severeWound: 0.35, lightWound: 0.65 },
  /** 勝利側: 0%→4%に上方修正（実データで少量の死亡を確認） */
  winner: { dead: 0.04, severeWound: 0.46, lightWound: 0.50 },
} as const;

export const MATCHUP_DATA: MatchupData[] = [
  {
    id: 'matchup_4711',
    atkHero: 'マグナス',
    defHero: 'フレイヤ',
    atkTroops: { shield: 31_605, spear: 40_666, bow: 10_107 },
    defTroops: { shield: 0, spear: 66_941, bow: 14_052 },
  },
  {
    id: 'matchup_4712',
    atkHero: 'ソニヤ',
    defHero: 'ブランシュ',
    atkTroops: { shield: 91_808, spear: 40_666, bow: 10_107 },
    defTroops: { shield: 52_770, spear: 66_941, bow: 14_052 },
  },
];

// ── Casualty rate verification ──

/**
 * バトルレポートの数値から負傷/死亡比率を検証する。
 *
 * WOSのバトルレポートにおける用語解釈:
 *   - 「負傷」= wounded (軽傷+重傷の合計、回復可能)
 *   - 「死亡」= dead (永久喪失)
 *   - 「損害」= total casualties? or specific category?
 *
 * 調整済みモデル (2026-04-05):
 *   攻撃側敗北: 27% dead / 13% severe / 60% light (実データに合わせて調整)
 *   防衛側敗北:  0% dead / 35% severe / 65% light
 *   勝者:        4% dead / 46% severe / 50% light
 */
export function analyzeCasualties(reports: BattleReportData[]): CasualtyAnalysis {
  const observedDeadRates: CasualtyAnalysis['observedDeadRates'] = [];

  for (const r of reports) {
    const atkTotalLoss = r.attacker.wounded + r.attacker.dead + r.attacker.lost;

    if (atkTotalLoss > 0 && r.attacker.dead > 0) {
      // dead / totalLoss
      const deadRate = r.attacker.dead / atkTotalLoss;

      // 「損害」の解釈を検証
      // 仮説A: 損害 = dead + wounded (総損害)
      // 仮説B: 損害 = dead のみ追加カテゴリ
      // 仮説C: 損害 = 重傷 (severe wound)

      const hypothesisA_totalLoss = r.attacker.wounded + r.attacker.dead;
      const hypothesisA_deadRate = r.attacker.dead / hypothesisA_totalLoss;

      // 仮説D: lost が重傷, wounded が軽傷, dead はそのまま
      // totalCasualties = wounded + dead + lost
      // dead/total, lost/total, wounded/total の比率を確認
      const deadPct = (r.attacker.dead / atkTotalLoss * 100).toFixed(1);
      const lostPct = (r.attacker.lost / atkTotalLoss * 100).toFixed(1);
      const woundedPct = (r.attacker.wounded / atkTotalLoss * 100).toFixed(1);

      let notes = `total=${atkTotalLoss}, dead=${deadPct}%, lost=${lostPct}%, wounded=${woundedPct}%`;
      notes += ` | 仮説A(dead/(w+d)): ${(hypothesisA_deadRate * 100).toFixed(1)}%`;

      // 仮説E: woundedとlostは別のカテゴリ、deadは独立
      // バトルレポートの「負傷」「死亡」「損害」がそれぞれ何を指すか
      // バトル1: 負傷1,506,384 / 死亡471,121 / 損害168,855
      //   → 負傷+死亡=1,977,505、損害168,855は重傷？
      //   → dead/(wounded+dead) = 23.8%
      // バトル2: 負傷1,536,632 / 死亡551,897 / 損害847,361
      //   → dead/(wounded+dead) = 26.4%
      // バトル3: 負傷1,104,472 / 死亡51,148 / 損害51,398
      //   → dead/(wounded+dead) = 4.4% (勝者なので0%想定、差異あり)

      observedDeadRates.push({ reportId: r.id, deadRate, notes });
    }
  }

  // 結果分析
  // バトル1: 攻撃側勝利のはずだが dead > 0 → 勝者でも死亡が出る？
  // バトル3: 攻撃側勝利、dead=51,148 → 勝者でも少量の死亡
  //
  // これは35%/10%/55%モデルと整合しない可能性がある
  // 可能性: バトルレポートの「負傷」「死亡」「損害」は
  // battle-engine.tsのcasualty categoriesとは異なる分類

  const analysis = `
=== 負傷/死亡率分析 ===

バトルレポートの数値パターン:

バトル1 (攻撃側勝利推定):
  負傷: 1,506,384 / 死亡: 471,121 / 損害: 168,855
  → dead/(wounded+dead) = 23.8%
  → 勝者モデル(0% dead)と不一致 → 攻撃側敗北の可能性、または用語解釈が異なる

バトル2 (防衛側勝利推定):
  負傷: 1,536,632 / 死亡: 551,897 / 損害: 847,361
  → dead/(wounded+dead) = 26.4%
  → 攻撃側敗者モデル(35% dead)に近い値

バトル3 (攻撃側勝利):
  負傷: 1,104,472 / 死亡: 51,148 / 損害: 51,398
  → dead/(wounded+dead) = 4.4%
  → 勝者モデル(0% dead)に近いが完全に0ではない
  → 防衛側損害: 1,092,152 → dead=0(防衛側敗者モデル0% dead)と整合

重要な発見:
1. 「損害」は「dead」や「wounded」とは別のカテゴリの可能性が高い
   - 重傷(severe wound)に対応する可能性
   - または、戦闘中のターン毎累積ダメージの表示

2. バトル1の解釈見直し:
   - dead=471,121 は攻撃側敗者(35%モデル)を示唆
   - 仮に totalCasualty = wounded + dead = 1,977,505
   - dead/total = 23.8% → 35%より低い → スキルや英雄効果で変動？

3. 35%/10%/55%モデルの検証:
   - バトル2が最も敗者モデルに近い(dead率26.4%)
   - ただし35%には達していない
   - 可能性: 35%は最大値で、実際はスキルやバフにより変動する

4. 「損害」の解釈候補:
   a) 重傷兵 (severe wound) → hospital送り
   b) 戦場での純損失 (net field loss)
   c) 資源換算の損害量

結論:
  現在の35%/10%/55%モデルは大まかな近似としては妥当だが、
  実際のデータとは15-30%の乖離がある。
  バトルレポートの用語定義の正確な理解が必要。
`.trim();

  const consistentWithModel =
    observedDeadRates.some((r) => r.deadRate > 0.2 && r.deadRate < 0.4);

  return { observedDeadRates, consistentWithModel, analysis };
}

// ── Coefficient C estimation ──

/**
 * キルフォーミュラの係数Cを逆算する。
 *
 * kills = C * sqrt(atkTroops) * (atk * leth) / (def * hp) * skillMod * typeBonus
 *
 * バトルレポートからの逆算:
 *   C = kills / (sqrt(atkTroops) * (atk * leth) / (def * hp) * skillMod * typeBonus)
 *
 * 問題: ATK/DEF/Leth/HPの絶対値がバトルレポートからは読み取れない。
 * バトルレポートの%値は差分表示であり、基礎ステータスが不明。
 *
 * アプローチ:
 * 1. %値から相対的なstat比を推定
 * 2. 典型的な英雄ステータス（G10-12、Lv80）を仮定
 * 3. 複数のバトルデータからCの一貫性を確認
 */
export function calibrate(reports: BattleReportData[]): CalibrationResult {
  const details: CalibrationDetail[] = [];

  // ── 典型的な英雄ステータスの仮定値 ──
  // G10英雄 Lv80, ギアLv30, リファイン5/5/5/5 を仮定
  // ATK ≈ (1110.89 + 130 + 119.6*4) * 1.0 ≈ 1719.3
  // DEF ≈ (1110.89 + 190 + 119.6*4) * 1.0 ≈ 1779.3
  // Leth ≈ 277.5 * 1.0 * 1.32 ≈ 366.3
  // HP  ≈ 277.5 * 1.0 * 1.32 ≈ 366.3
  const BASE_ATK = 1719;
  const BASE_DEF = 1779;
  const BASE_LETH = 366;
  const BASE_HP = 366;

  for (const r of reports) {
    const atkTotalLoss = r.attacker.wounded + r.attacker.dead + r.attacker.lost;
    const defTotalLoss = r.defender.wounded + r.defender.dead + r.defender.lost;

    let estimatedC: number | null = null;
    let notes = '';

    // 防衛側の総損害（攻撃側が与えたダメージ）から C を逆算
    if (defTotalLoss > 0 && r.attacker.totalTroops > 0 && r.defender.totalTroops > 0) {
      // %値からの追加ステータスの解釈
      // バトルレポートの表示は「自軍 - 敵軍」の差分
      // 例: ATK -2645.1% → 自軍のATK増加ステータスが敵より2645.1%低い
      // つまり、skill modifierの比率を反映している
      //
      // SkillMod ∝ (1 + atkBuff%) / (1 + defBuff%)
      // 差分が-2645%ということは、この比率が非常に小さい
      // → しかしこれは追加%ボーナスの差であり、基礎ステータスに対する乗数

      // 追加ステータスの解釈:
      // WOSの追加ステータスは「研究 + 英雄スキル + バフ」による%増加
      // 例: ATK +2645% → 基礎ATKの26.45倍が追加される → 実効ATK = 基礎 * (1 + 26.45)
      //
      // バトルレポートの差分:
      // 攻撃側ATK: -2645.1% → 防衛側より2645.1%ポイント低い
      // つまり: atkSide_atkPct - defSide_atkPct = -2645.1

      // SkillMod計算のための仮定:
      // 両側のATK追加ステータスを直接知ることはできないが、
      // 差分から相対的な比率は推定できる
      //
      // 仮に:
      //   攻撃側ATK% = X, 防衛側ATK% = X + 2645.1
      //   効果ATK_atk = BASE_ATK * (1 + X/100)
      //   効果ATK_def = BASE_ATK * (1 + (X+2645.1)/100)
      //
      // Xの値を仮定する必要がある
      // 典型的なATK%: 2000-4000% (上位プレイヤー)

      // SkillModが分からない場合、SkillMod=1と仮定してCの下限/上限を推定

      // 簡略化: typeBonus平均=1.033 (1/3が有利、2/3が等倍)
      const avgTypeBonus = (1.10 + 1.0 + 1.0) / 3;

      // SkillMod = 1.0 と仮定（バフなし）
      const skillMod = 1.0;

      // 100ターンでの累積killsを逆算
      // 1ターンあたりの kills_per_turn = defTotalLoss / turns
      // turns は不明だが、典型的に20-60ターン
      const turnsEstimate = 40; // 中央推定

      // 各ターンでの kills:
      // kills_per_turn = C * sqrt(atkTroops) * (ATK * Leth) / (DEF * HP) * skillMod * typeBonus
      // ただし兵数はターン毎に減少するため、初期兵数のsqrt平均を使用
      const avgAtkTroops = r.attacker.totalTroops * 0.85; // ターン平均で15%減と仮定
      const sqrtAvgTroops = Math.sqrt(avgAtkTroops);

      const statRatio = (BASE_ATK * BASE_LETH) / (BASE_DEF * BASE_HP);
      const denominator = sqrtAvgTroops * statRatio * skillMod * avgTypeBonus * turnsEstimate;

      if (denominator > 0) {
        estimatedC = defTotalLoss / denominator;
        notes = `defLoss=${defTotalLoss}, turns≈${turnsEstimate}, skillMod=1.0(仮), typeBonus=${avgTypeBonus.toFixed(3)}`;
      } else {
        notes = 'denominator is zero or negative';
      }
    }

    // 攻撃側の損害からも逆算（防衛側 → 攻撃側へのダメージ）
    if (atkTotalLoss > 0 && r.defender.totalTroops > 0) {
      const avgDefTroops = r.defender.totalTroops > 0 ? r.defender.totalTroops * 0.85 : 0;
      if (avgDefTroops > 0) {
        const sqrtAvgDefTroops = Math.sqrt(avgDefTroops);
        const statRatio = (BASE_ATK * BASE_LETH) / (BASE_DEF * BASE_HP);
        const avgTypeBonus = (1.10 + 1.0 + 1.0) / 3;
        const turnsEstimate = 40;
        const denominator = sqrtAvgDefTroops * statRatio * 1.0 * avgTypeBonus * turnsEstimate;
        if (denominator > 0) {
          const cFromAtkLoss = atkTotalLoss / denominator;
          notes += ` | C(from atkLoss)=${cFromAtkLoss.toFixed(6)}`;
        }
      }
    }

    details.push({
      reportId: r.id,
      totalAtkLoss: r.attacker.wounded + r.attacker.dead + r.attacker.lost,
      totalDefLoss: r.defender.wounded + r.defender.dead + r.defender.lost,
      estimatedC,
      notes,
    });
  }

  // 有効な推定値を集約
  const validCs = details.filter((d) => d.estimatedC !== null).map((d) => d.estimatedC!);
  const avgC = validCs.length > 0 ? validCs.reduce((a, b) => a + b, 0) / validCs.length : 0;
  const minC = validCs.length > 0 ? Math.min(...validCs) : 0;
  const maxC = validCs.length > 0 ? Math.max(...validCs) : 0;

  // 信頼度: データポイント数と分散で判定
  const variance =
    validCs.length > 1
      ? validCs.reduce((sum, c) => sum + (c - avgC) ** 2, 0) / (validCs.length - 1)
      : Infinity;
  const cv = avgC > 0 ? Math.sqrt(variance) / avgC : Infinity; // 変動係数

  let confidence: CalibrationResult['confidence'] = 'low';
  if (validCs.length >= 3 && cv < 0.3) confidence = 'medium';
  if (validCs.length >= 5 && cv < 0.15) confidence = 'high';

  const casualtyAnalysis = analyzeCasualties(reports);

  return {
    estimatedC: avgC,
    cRange: { min: minC, max: maxC },
    confidence,
    casualtyAnalysis,
    details,
  };
}

// ── Run calibration and output results ──

export function runCalibration(): string {
  const result = calibrate(BATTLE_REPORTS);

  const lines: string[] = [];
  lines.push('=== WOS Damage Formula Calibration Results ===\n');

  lines.push(`Estimated C (coefficient): ${result.estimatedC.toFixed(6)}`);
  lines.push(`C range: [${result.cRange.min.toFixed(6)}, ${result.cRange.max.toFixed(6)}]`);
  lines.push(`Confidence: ${result.confidence}\n`);

  lines.push('--- Per-report details ---');
  for (const d of result.details) {
    lines.push(`\n[${d.reportId}]`);
    lines.push(`  ATK total loss: ${d.totalAtkLoss.toLocaleString()}`);
    lines.push(`  DEF total loss: ${d.totalDefLoss.toLocaleString()}`);
    lines.push(`  Estimated C: ${d.estimatedC?.toFixed(6) ?? 'N/A'}`);
    lines.push(`  Notes: ${d.notes}`);
  }

  lines.push('\n--- Casualty Analysis ---');
  lines.push(result.casualtyAnalysis.analysis);

  lines.push('\n--- Observed Dead Rates ---');
  for (const rate of result.casualtyAnalysis.observedDeadRates) {
    lines.push(`  ${rate.reportId}: deadRate=${(rate.deadRate * 100).toFixed(1)}%`);
    lines.push(`    ${rate.notes}`);
  }

  return lines.join('\n');
}
