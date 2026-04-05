import type { TroopType } from './heroes';

/** 兵士ティア: T1-T11 */
export type TroopTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** 兵士ティア名 */
export const TROOP_TIER_NAMES: Record<TroopType, Record<TroopTier, string>> = {
  shield: {1:'見習い盾兵',2:'熟練盾兵',3:'ベテラン盾兵',4:'百戦盾兵',5:'剛毅盾兵',6:'勇敢盾兵',7:'不敵盾兵',8:'精鋭盾兵',9:'名誉盾兵',10:'切り札盾兵',11:'烈日盾兵'},
  spear: {1:'見習い槍兵',2:'熟練槍兵',3:'ベテラン槍兵',4:'百戦槍兵',5:'剛毅槍兵',6:'勇敢槍兵',7:'不敵槍兵',8:'精鋭槍兵',9:'名誉槍兵',10:'切り札槍兵',11:'烈日槍兵'},
  bow: {1:'見習い弓兵',2:'熟練弓兵',3:'ベテラン弓兵',4:'百戦弓兵',5:'剛毅弓兵',6:'勇敢弓兵',7:'不敵弓兵',8:'精鋭弓兵',9:'名誉弓兵',10:'切り札弓兵',11:'烈日弓兵'},
};

/** 兵士基礎ステータス（スクショから実測） */
export const TROOP_BASE_STATS: Record<TroopType, Record<TroopTier, {atk:number,def:number,leth:number,hp:number,power:number}>> = {
  shield: {
    1:{atk:1,def:7,leth:1,hp:6,power:5},
    2:{atk:2,def:8,leth:2,hp:7,power:6},
    3:{atk:3,def:10,leth:3,hp:17,power:12},
    4:{atk:4,def:16,leth:4,hp:19,power:17},
    5:{atk:12,def:17,leth:11,hp:20,power:23},
    6:{atk:13,def:19,leth:12,hp:21,power:37},
    7:{atk:14,def:23,leth:13,hp:22,power:54},
    8:{atk:15,def:24,leth:14,hp:23,power:69},
    9:{atk:16,def:25,leth:15,hp:24,power:95},
    10:{atk:18,def:26,leth:16,hp:25,power:121},
    11:{atk:19,def:28,leth:18,hp:27,power:148},
  },
  spear: {
    1:{atk:8,def:1,leth:6,hp:1,power:5},
    2:{atk:10,def:2,leth:7,hp:2,power:6},
    3:{atk:11,def:3,leth:8,hp:3,power:12},
    4:{atk:12,def:4,leth:10,hp:4,power:17},
    5:{atk:18,def:12,leth:19,hp:11,power:23},
    6:{atk:19,def:14,leth:20,hp:13,power:37},
    7:{atk:23,def:15,leth:21,hp:14,power:54},
    8:{atk:24,def:16,leth:22,hp:15,power:69},
    9:{atk:25,def:17,leth:23,hp:16,power:95},
    10:{atk:26,def:19,leth:24,hp:17,power:121},
    11:{atk:28,def:21,leth:26,hp:20,power:148},
  },
  bow: {
    1:{atk:8,def:1,leth:6,hp:1,power:5},
    2:{atk:10,def:2,leth:7,hp:2,power:6},
    3:{atk:11,def:3,leth:9,hp:3,power:12},
    4:{atk:13,def:4,leth:11,hp:4,power:17},
    5:{atk:18,def:12,leth:19,hp:12,power:23},
    6:{atk:20,def:14,leth:21,hp:13,power:37},
    7:{atk:24,def:15,leth:22,hp:14,power:54},
    8:{atk:25,def:16,leth:23,hp:15,power:69},
    9:{atk:26,def:17,leth:24,hp:16,power:95},
    10:{atk:27,def:19,leth:25,hp:17,power:121},
    11:{atk:30,def:21,leth:27,hp:20,power:148},
  },
};

/** 殿堂スキル（T11で全解放、4スキル×3兵種） */
export interface TroopSkill {
  id: string;
  nameJa: string;
  troopType: TroopType;
  description: string;
  /** T11のみ解放 */
  requiresTier: TroopTier;
  // 効果パラメータ
  effect: TroopSkillEffect;
}

export interface TroopSkillEffect {
  typeAdvantage?: { against: TroopType; dmgBonus: number; defBonus?: number };
  ambusher?: { chance: number };
  multiShot?: { chance: number; attacks: number };
  critDmg?: { chance: number; multiplier: number };
  damageNegate?: { chance: number; negatePercent: number };
  conditionalDamageNegate?: { chance: number; negatePercent: number };
  conditionalDmgReduction?: { chance: number; reduction: number };
  conditionalExtraDmg?: { extraPercent: number };
  baseStatBonus?: { stat: 'atk' | 'def'; percent: number };
  extraDmg?: { chance: number; percent: number };
}

export const TROOP_SKILLS: TroopSkill[] = [
  // === 盾兵 ===
  // スキル1: T1から解放
  { id:'shield_1', nameJa:'密集戦陣', troopType:'shield', description:'対槍兵時、与ダメージが10%増加', requiresTier:1,
    effect: { typeAdvantage: { against:'spear', dmgBonus:10 } } },
  // スキル2: T7から解放
  { id:'shield_2', nameJa:'鋼鉄の守り', troopType:'shield', description:'対槍兵時、防御が10%増加', requiresTier:7,
    effect: { typeAdvantage: { against:'spear', dmgBonus:0, defBonus:10 } } },
  // スキル3: T10から解放（FC3相当）
  { id:'shield_3', nameJa:'烈晶の盾', troopType:'shield', description:'37.5%の確率で36%のダメージを相殺する', requiresTier:10,
    effect: { damageNegate: { chance:0.375, negatePercent:36 } } },
  // スキル4: T11から解放（FC8/10相当）
  { id:'shield_4', nameJa:'光鍛ボディ', troopType:'shield', description:'盾兵DEF+6%。烈晶の盾発動中に追加で15%相殺', requiresTier:11,
    effect: { baseStatBonus: { stat:'def', percent:6 }, conditionalDamageNegate: { chance:1.0, negatePercent:15 } } },

  // === 槍兵 ===
  { id:'spear_1', nameJa:'突撃', troopType:'spear', description:'対弓兵時、与ダメージが10%増加', requiresTier:1,
    effect: { typeAdvantage: { against:'bow', dmgBonus:10 } } },
  { id:'spear_2', nameJa:'奇襲', troopType:'spear', description:'攻撃時20%の確率で盾兵を迂回して弓兵に直接ダメージ', requiresTier:7,
    effect: { ambusher: { chance:0.20 } } },
  { id:'spear_3', nameJa:'炎晶の戦矛', troopType:'spear', description:'15%の確率で2倍ダメージを与える', requiresTier:10,
    effect: { critDmg: { chance:0.15, multiplier:2.0 } } },
  { id:'spear_4', nameJa:'熾烈な領域', troopType:'spear', description:'炎晶の戦矛発動中、15%の確率で被ダメージを半減する', requiresTier:11,
    effect: { conditionalDmgReduction: { chance:0.15, reduction:0.5 } } },

  // === 弓兵 ===
  { id:'bow_1', nameJa:'遠距離打撃', troopType:'bow', description:'対盾兵時、与ダメージが10%増加', requiresTier:1,
    effect: { typeAdvantage: { against:'shield', dmgBonus:10 } } },
  { id:'bow_2', nameJa:'連射', troopType:'bow', description:'攻撃時、10%の確率で続けて2回攻撃する', requiresTier:7,
    effect: { multiShot: { chance:0.10, attacks:2 } } },
  { id:'bow_3', nameJa:'燃晶の火薬', troopType:'bow', description:'30%の確率で50%の追加ダメージを与える', requiresTier:10,
    effect: { extraDmg: { chance:0.30, percent:50 } } },
  { id:'bow_4', nameJa:'フレイムバースト', troopType:'bow', description:'弓兵ATK+6%。燃晶の火薬発動中に追加で37.5%ダメージ', requiresTier:11,
    effect: { baseStatBonus: { stat:'atk', percent:6 }, conditionalExtraDmg: { extraPercent:37.5 } } },
];

/** 兵種の殿堂スキルを取得 */
export function getTroopSkillsByType(troopType: TroopType): TroopSkill[] {
  return TROOP_SKILLS.filter(s => s.troopType === troopType);
}

/** 指定兵種・ティアで解放済みの殿堂スキルを取得 */
export function getTroopSkills(troopType: TroopType, tier: TroopTier): TroopSkill[] {
  return TROOP_SKILLS.filter(s => s.troopType === troopType && s.requiresTier <= tier);
}

/** 三すくみの有利兵種マップ（実測確定: 盾>槍>弓>盾） */
export const TYPE_ADVANTAGE_MAP: Record<TroopType, TroopType> = {
  shield: 'spear',  // 盾は槍に強い
  spear: 'bow',     // 槍は弓に強い
  bow: 'shield',    // 弓は盾に強い
};
