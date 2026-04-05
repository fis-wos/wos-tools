import type { TroopType } from './heroes';

/** Fire Crystal レベル */
export type FCLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 兵士殿堂スキル定義 */
export interface TroopSkill {
  id: string;
  name: string;
  nameJa: string;
  fcLevel: FCLevel;        // 解放されるFCレベル
  troopType: TroopType;    // 対象兵種
  description: string;

  // 効果
  effect: TroopSkillEffect;
}

export interface TroopSkillEffect {
  // 相性ボーナス
  typeAdvantage?: {
    against: TroopType;     // 有利な相手兵種
    dmgBonus: number;       // 与ダメ増加% (仮: 10%)
    dmgReduction?: number;  // 被ダメ軽減% (盾のFC5)
  };

  // Ambusher（槍FC5）
  ambusher?: {
    chance: number;          // 発動確率 (20%)
    targetLine: 'back';      // 後列ターゲット
    extraDmg?: number;       // 追加ダメージ%
  };

  // 連射（弓FC5）
  multiShot?: {
    chance: number;          // 発動確率
    extraAttacks: number;    // 追加攻撃回数
  };

  // FC8+の強化効果
  crystalEnhance?: {
    enhancePct: number;      // 殿堂スキル効果増強%
  };
}

/** 全兵士殿堂スキル定義 */
export const TROOP_SKILLS: TroopSkill[] = [
  // === 盾兵（烈日盾兵） ===
  {
    id: 'shield_fc3',
    name: 'Hall Spirit',
    nameJa: '殿堂闘魂',
    fcLevel: 3,
    troopType: 'shield',
    description: '対弓兵に与ダメージ増加',
    effect: {
      typeAdvantage: { against: 'bow', dmgBonus: 10 },
    },
  },
  {
    id: 'shield_fc5',
    name: 'Iron Guard',
    nameJa: '鋼鉄の守り',
    fcLevel: 5,
    troopType: 'shield',
    description: '対弓兵、受ダメージ軽減を獲得',
    effect: {
      typeAdvantage: { against: 'bow', dmgBonus: 0, dmgReduction: 10 },
    },
  },
  {
    id: 'shield_fc8',
    name: 'Crystal Shield',
    nameJa: '灼晶の盾',
    fcLevel: 8,
    troopType: 'shield',
    description: '盾兵が受けたエネルギーで攻撃、殿堂スキルが増強',
    effect: {
      crystalEnhance: { enhancePct: 25 }, // 仮値
    },
  },

  // === 槍兵（切り札槍兵） ===
  {
    id: 'spear_fc3',
    name: 'Charge',
    nameJa: '突撃',
    fcLevel: 3,
    troopType: 'spear',
    description: '対弓兵に与ダメージ増加',
    effect: {
      typeAdvantage: { against: 'bow', dmgBonus: 10 },
    },
  },
  {
    id: 'spear_fc5',
    name: 'Ambusher',
    nameJa: '奇襲',
    fcLevel: 5,
    troopType: 'spear',
    description: '攻撃時20%の確率で前列を飛び越えて1ラインに追加ダメージ',
    effect: {
      ambusher: { chance: 0.20, targetLine: 'back' },
    },
  },
  {
    id: 'spear_fc8',
    name: 'Crystal Axe',
    nameJa: '水晶の戦斧',
    fcLevel: 8,
    troopType: 'spear',
    description: '刃の鋭い水晶エネルギーで攻撃、殿堂スキルが増強',
    effect: {
      crystalEnhance: { enhancePct: 25 }, // 仮値
    },
  },

  // === 弓兵（烈日弓兵） ===
  {
    id: 'bow_fc3',
    name: 'Long Range Strike',
    nameJa: '遠距離打撃',
    fcLevel: 3,
    troopType: 'bow',
    description: '対盾兵に与ダメージ増加',
    effect: {
      typeAdvantage: { against: 'shield', dmgBonus: 10 },
    },
  },
  {
    id: 'bow_fc5',
    name: 'Rapid Fire',
    nameJa: '連射',
    fcLevel: 5,
    troopType: 'bow',
    description: '攻撃時、確率で敵に追加攻撃',
    effect: {
      multiShot: { chance: 0.20, extraAttacks: 1 }, // 仮値
    },
  },
  {
    id: 'bow_fc8',
    name: 'Crystal Arrow',
    nameJa: '燃晶の矢',
    fcLevel: 8,
    troopType: 'bow',
    description: '水晶から生み出されたエネルギーでスキルを増強',
    effect: {
      crystalEnhance: { enhancePct: 25 }, // 仮値
    },
  },
];

// ─── ヘルパー関数 ───

/** 指定兵種・FCレベル以下で解放済みの殿堂スキルを取得 */
export function getTroopSkills(troopType: TroopType, fcLevel: FCLevel): TroopSkill[] {
  return TROOP_SKILLS.filter(s => s.troopType === troopType && s.fcLevel <= fcLevel);
}

/**
 * 攻撃側→防御側の相性ボーナスを算出
 *
 * 三すくみ（殿堂スキルから確認済み）:
 *   盾 → 弓に強い
 *   槍 → 弓に強い
 *   弓 → 盾に強い
 * 槍に対して強い兵種は殿堂スキルでは定義されていない。
 */
export function getTypeAdvantage(
  attackerType: TroopType,
  defenderType: TroopType,
  fcLevel: FCLevel,
): { dmgBonus: number; dmgReduction: number } {
  const skills = getTroopSkills(attackerType, fcLevel);
  let dmgBonus = 0;
  let dmgReduction = 0;
  for (const skill of skills) {
    if (skill.effect.typeAdvantage?.against === defenderType) {
      dmgBonus += skill.effect.typeAdvantage.dmgBonus;
      dmgReduction += skill.effect.typeAdvantage.dmgReduction ?? 0;
    }
  }
  return { dmgBonus, dmgReduction };
}

/** 槍兵の奇襲（Ambusher）が有効かどうか */
export function hasAmbusher(fcLevel: FCLevel): boolean {
  return fcLevel >= 5;
}

/** 槍兵の奇襲発動確率を取得 */
export function getAmbusherChance(fcLevel: FCLevel): number {
  if (fcLevel < 5) return 0;
  return 0.20;
}
