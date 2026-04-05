/**
 * WOS Battle Simulator - Hero Definitions
 *
 * All SSR heroes (G1-G12) plus SR heroes.
 * Skill data verified from: 119 in-game screenshots (2026-04-05)
 */

export type TroopType = 'shield' | 'spear' | 'bow';
export type Rarity = 'SSR' | 'SR';
export type SkillTrigger = 'always' | 'prob' | 'periodic';

export interface Skill {
  /** Trigger type: always active, probability-based, or periodic */
  tp: SkillTrigger;
  /** Trigger probability (1.0 = 100%; always=1, periodic=1) */
  prob: number;
  /** Periodic: every N attacks or turns */
  period?: number;
  /** Duration in turns */
  duration?: number;
  /** Effect target */
  target?: 'all' | 'shield' | 'spear' | 'bow' | 'enemy';
  /** Attack damage buff % (与ダメ増加) */
  atkDmgBuf?: number;
  /** Defense buff % (被ダメ軽減) */
  defBuf?: number;
  /** ATK stat buff % */
  atkBuf?: number;
  /** DEF stat buff % */
  defStatBuf?: number;
  /** HP buff % */
  hpBuf?: number;
  /** Lethality buff % (殺傷力増加) */
  lethBuf?: number;
  /** Enemy damage taken increase % (敵被ダメ増加) */
  atkDebuf?: number;
  /** Enemy defense reduction % */
  defDebuf?: number;
  /** Enemy ATK reduction % */
  atkStatDebuf?: number;
  /** Enemy lethality reduction % */
  lethDebuf?: number;
  /** Stun duration in turns */
  stun?: number;
  /** Damage-over-time multiplier */
  dotDmg?: number;
  /** Damage reflection buff multiplier */
  reflectBuf?: number;
  /** Critical rate % */
  critRate?: number;
  /** Extra attack % (追加攻撃) */
  extraAtk?: number;
  /** Dodge rate % (回避率) */
  dodge?: number;
  /** Shield amount % of ATK */
  shield?: number;
  /** Display label */
  lbl: string;
}

export interface GearSkill {
  /** Timing: applies when attacking or defending */
  timing: 'atk' | 'def';
  /** Effect type: atk buff, def buff, lethality, or hp */
  eff: 'atk' | 'def' | 'leth' | 'hp';
}

export interface Hero {
  /** Unique identifier */
  id: string;
  /** Display name */
  n: string;
  /** Generation (1-12) */
  g: number;
  /** Rarity */
  r: Rarity;
  /** Troop type */
  t: TroopType;
  /** Portrait image URL */
  img: string;
  /** Defense skill base multiplier */
  dS: number;
  /** Attack skill base multiplier */
  aS: number;
  /** Attack target troop type index (0=shield, 1=spear, 2=bow) */
  aT: number;
  /** Defense target troop type index */
  dT: number;
  /** Generation lethality/HP base (from GL_WPN lookup) */
  glg: number;
  /** Gear base value (from GL_GEAR lookup) */
  gearBase: number;
  /** Gear skill definition */
  gs?: GearSkill;
  /** Skill 1 (passive/always) */
  s1: Skill | null;
  /** Skill 2 */
  s2: Skill | null;
  /** Skill 3 */
  s3: Skill | null;
  /** Synergy defense hero IDs */
  sd: string[];
  /** Synergy attack hero IDs */
  sa: string[];
  /** Notes/special text */
  ns?: string;
}

const IMG_BASE = 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/';

export const HEROES: Hero[] = [
  // ===== Generation 1 (4 heroes) =====
  {
    id: 'jeronimo',
    n: 'ジェロニモ',
    g: 1,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/05/jeronimo.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '剣術指導: 常時ATK+25%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '決起集会: 常時与ダメ+25%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, atkDmgBuf: 0.30, lbl: '練達なる剣技: 4T毎与ダメ+30%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'natalia',
    n: 'ナタリア',
    g: 1,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/05/natalia.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '野性の守護: 40%:被ダメ-50%' },
    s2: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '獣群の王: 常時ATK+25%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '野獣召喚: 常時与ダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'jasmine',
    n: 'ジャスミン',
    g: 1,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/05/molly.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '雪霧の庇護: 40%:被ダメ-50%' },
    s2: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '氷結の領域: 50%:与ダメ+50%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '不機嫌少女: 常時与ダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'zinman',
    n: 'ジンマン',
    g: 1,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/05/zinman.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, defStatBuf: 0.10, hpBuf: 0.10, lbl: '堅固: 常時DEF+10%・HP+10%' },
    s2: null,
    s3: { tp: 'always', prob: 1.0, lethBuf: 0.25, lbl: '陣地戦の強者: 常時殺傷力+25%' },
    sd: [],
    sa: [],
    ns: 'S2「建築の芸術」は探検スキル（遠征スキルではない）',
  },

  // ===== Generation 2 =====
  {
    id: 'flint',
    n: 'フリント',
    g: 2,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/05/flint.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'shield', atkDmgBuf: 1.00, lbl: '野火: 常時盾兵与ダメ+100%' },
    s2: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '森林火災: 常時ATK+25%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: '灼熱の魂: 常時全部隊殺傷力+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'frender',
    n: 'フレンダー',
    g: 2,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/05/philly.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '強健の秘訣: 常時ATK+15%・DEF+10%' },
    s2: { tp: 'prob', prob: 0.25, extraAtk: 2.00, lbl: '強化薬剤: 25%:追加攻撃+200%' },
    s3: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '専心の神薬: 40%:被ダメ-50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'alonzo',
    n: 'アロンゾ',
    g: 2,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/05/alonso.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.40, lethBuf: 0.50, lbl: '波瀾万丈: 40%:殺傷力+50%' },
    s2: { tp: 'prob', prob: 0.20, duration: 2, defBuf: 0.50, lbl: '鋼鉄意志: 20%:敵与ダメ-50%(2T)' },
    s3: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '毒の銛: 50%:与ダメ+50%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 3 =====
  {
    id: 'lauren',
    n: 'ローガン',
    g: 3,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/05/logan.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.20, lbl: '怒れる獅子の威: 常時敵ATK-20%' },
    s2: { tp: 'always', prob: 1.0, defBuf: 0.20, lbl: '猛き獅子の威嚇: 常時被ダメ-20%' },
    s3: { tp: 'always', prob: 1.0, hpBuf: 0.25, lbl: 'リーダーの鼓舞: 常時HP+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'moa',
    n: 'ミア',
    g: 3,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/05/mia.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'prob', prob: 0.50, atkDebuf: 0.50, lbl: '不幸の連鎖: 50%:敵被ダメ+50%' },
    s2: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '幸運の加護: 50%:与ダメ+50%' },
    s3: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '秘儀の解読: 40%:被ダメ-50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'greg',
    n: 'グレッグ',
    g: 3,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/05/greg.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'prob', prob: 0.20, duration: 3, atkDmgBuf: 0.40, lbl: '正義の剣: 20%:与ダメ+40%(3T)' },
    s2: { tp: 'prob', prob: 0.20, duration: 2, defBuf: 0.50, lbl: '律令の脅威: 20%:敵与ダメ-50%(2T)' },
    s3: { tp: 'always', prob: 1.0, hpBuf: 0.25, lbl: '秩序の庇護: 常時HP+25%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 4 =====
  {
    id: 'aquas',
    n: 'アクモス',
    g: 4,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/09/ahmos.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, defBuf: 0.70, lbl: 'マムシ方陣: 4回毎:盾被ダメ-70%・槍弓被ダメ-30%(2T)' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', atkDmgBuf: 1.00, lbl: '火の祈願: 盾兵与ダメ+100%' },
    s3: { tp: 'periodic', prob: 1.0, period: 1, duration: 1, extraAtk: 0.60, atkDebuf: 0.25, lbl: '光鍛の刃: 攻撃毎+60%追加・敵被ダメ+25%(1T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'reina',
    n: 'レイナ',
    g: 4,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/09/1690429616516_7.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: '暗殺者の本能: 常時通常攻撃与ダメ+30%' },
    s2: { tp: 'prob', prob: 0.20, dodge: 1.00, lbl: '残像の足跡: 20%:回避' },
    s3: { tp: 'prob', prob: 0.25, target: 'spear', extraAtk: 2.00, lbl: '影刃: 25%:槍兵追加攻撃+200%' },
    sd: [],
    sa: [],
  },
  {
    id: 'lion',
    n: 'リオン',
    g: 4,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/09/1690429616507_5.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.40, atkDmgBuf: 0.50, lbl: '獅子の歌: 40%:与ダメ+50%' },
    s2: { tp: 'always', prob: 1.0, defBuf: 0.20, lbl: '悲しき音色: 常時敵与ダメ-20%' },
    s3: { tp: 'periodic', prob: 1.0, period: 3, target: 'bow', atkBuf: 0.05, lbl: 'オーナイのカデンツァ: 弓3回攻撃毎ATK+5%(累積)' },
    sd: [],
    sa: [],
  },

  // ===== Generation 5 =====
  {
    id: 'hector',
    n: 'ヘクトー',
    g: 5,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/09/1690429616489_3.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '生存本能: 40%:被ダメ-50%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', atkDmgBuf: 2.00, lbl: '雷の突撃: 盾与ダメ+200%・弓+100%(減衰85%/回,10回)' },
    s3: { tp: 'prob', prob: 0.25, extraAtk: 2.00, lbl: '疾風猛襲: 25%:与ダメ+200%' },
    sd: [],
    sa: [],
  },
  {
    id: 'nora',
    n: 'ノラ',
    g: 5,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/09/1690429616480_2.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, defBuf: 0.15, atkDmgBuf: 0.15, lbl: '多兵種戦術: 常時盾弓被ダメ-15%・与ダメ+15%' },
    s2: { tp: 'prob', prob: 0.20, target: 'enemy', extraAtk: 1.00, lbl: '急所突き: 20%:全敵追加攻撃+100%' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, duration: 2, target: 'all', atkDmgBuf: 0.25, defBuf: 0.25, lbl: '追撃攻勢: 槍5回毎:全部隊与ダメ+25%・被ダメ-25%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'gwen',
    n: 'グエン',
    g: 5,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/09/1690429616472_1.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, atkDebuf: 0.25, lbl: 'ホークアイ: 常時敵被ダメ+25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 5, extraAtk: 1.00, atkDebuf: 0.15, lbl: '空中制圧: 5回毎追加+100%・次回敵被ダメ+15%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, target: 'bow', extraAtk: 0.50, lbl: '小隊爆破: 弓4回毎全敵+50%追加ダメ' },
    sd: [],
    sa: [],
  },

  // ===== Generation 6 =====
  {
    id: 'nameless',
    n: '無名',
    g: 6,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2023/11/wuming.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, defBuf: 0.25, lbl: '避風補雨: 常時通常被ダメ-25%・スキル被ダメ-30%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.20, lbl: '半月飛翔: 常時与ダメ+20%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '四象明晰: 常時スキルダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'renee',
    n: 'レネ',
    g: 6,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2023/11/rene.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', extraAtk: 2.00, lbl: '夢の痕跡: 2T毎夢印→槍兵追加+200%' },
    s2: { tp: 'always', prob: 1.0, target: 'spear', atkDmgBuf: 1.50, lbl: 'ドリームイーター: 夢印対象に槍兵+150%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', atkDmgBuf: 0.75, lbl: '夢の欠片: 夢印対象に全部隊+75%' },
    sd: [],
    sa: [],
  },
  {
    id: 'wayne',
    n: 'ウェイン',
    g: 6,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2023/11/wayne.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'periodic', prob: 1.0, period: 4, target: 'all', extraAtk: 1.00, lbl: 'サンダーサプライズ: 4T毎全部隊追加+100%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', atkDmgBuf: 0.40, lbl: '迂回攻撃: 隔回:槍+40%・弓+20%' },
    s3: { tp: 'always', prob: 1.0, critRate: 0.25, lbl: '電光石火: 常時クリ率+25%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 7 =====
  {
    id: 'edith',
    n: 'エディス',
    g: 7,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/03/20240222_2.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'bow', defBuf: 0.20, lbl: '攻守両立: 常時弓被ダメ-20%・槍与ダメ+20%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.20, lbl: '銅頭鉄腕: 常時盾被ダメ-20%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', hpBuf: 0.25, lbl: '鋼甲護体: 常時全部隊HP+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'gordon',
    n: 'ゴードン',
    g: 7,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/03/20240222_1.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', extraAtk: 1.00, dotDmg: 0.20, lbl: '毒の刃: 2回毎:槍追加+100%・毒(敵与ダメ-20%)(1T)' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, duration: 1, target: 'spear', atkDmgBuf: 1.50, lbl: '毒の恐怖: 3T毎:槍+150%・敵与ダメ-30%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, atkDebuf: 0.30, lbl: '劇毒の霧: 4T毎:敵盾被ダメ+30%・敵弓与ダメ-30%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'bradley',
    n: 'ブラッドリー',
    g: 7,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/03/20240222_3.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '老兵の誇り: 常時ATK+25%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: '正面突破: 常時対槍+30%・対盾+25%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, target: 'all', atkDmgBuf: 0.30, lbl: '戦局洞察: 4T毎全部隊与ダメ+30%(2T)' },
    sd: [],
    sa: [],
  },

  // ===== Generation 8 =====
  {
    id: 'gato',
    n: 'ガト',
    g: 8,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/07/5.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.25, lbl: '王者の師: 常時敵ATK-25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defStatBuf: 0.30, lbl: '黄金の近衛: 常時盾DEF+30%' },
    s3: { tp: 'periodic', prob: 1.0, period: 1, duration: 1, shield: 0.30, lbl: '列王の恩恵: 攻撃毎シールド(ATK×30%)(1T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'sonya',
    n: 'ソニヤ',
    g: 8,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/07/6.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, target: 'all', atkDmgBuf: 0.20, lbl: 'トレジャーハンター: 常時全部隊与ダメ+20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'spear', extraAtk: 0.75, atkBuf: 0.25, lbl: '賞金の誘惑: 2回毎:槍+75%・全部隊ATK+25%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, target: 'spear', extraAtk: 2.50, stun: 1, lbl: '激流衝撃: 5T毎:槍+250%・スタン1T' },
    sd: [],
    sa: [],
  },
  {
    id: 'hendrick',
    n: 'ヘンドリック',
    g: 8,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/07/7.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, defDebuf: 0.25, lbl: '蟲虫のかみつき: 常時敵DEF-25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, target: 'all', defStatBuf: 0.30, lbl: 'フジツボの鎧: 4T毎全部隊DEF+30%(2T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 3, target: 'enemy', dotDmg: 0.40, lbl: 'ダゴンの後継者: 3T毎全敵40%ダメ' },
    sd: [],
    sa: [],
  },

  // ===== Generation 9 =====
  {
    id: 'magnus',
    n: 'マグナス',
    g: 9,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/08/magnus.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '怒りの波: 常時ATK+25%' },
    s2: { tp: 'prob', prob: 0.40, duration: 1, target: 'all', defStatBuf: 0.50, lbl: '鋼鉄陣形: 40%:全部隊DEF+50%(1T)' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.10, lbl: '氷海戦術: 常時盾被ダメ-10%・弓与ダメ+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'fred',
    n: 'フレッド',
    g: 9,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/08/fred.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, lethDebuf: 0.20, lbl: '放水砲制圧: 常時敵殺傷力-20%' },
    s2: { tp: 'always', prob: 1.0, target: 'enemy', atkDebuf: 0.20, lbl: '酸性溶液: 常時敵盾被ダメ+20%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, target: 'spear', extraAtk: 2.00, defBuf: 0.20, lbl: '猛烈な攻勢: 4回毎:槍追加+200%・敵与ダメ-20%(次T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'shura',
    n: 'シュラ',
    g: 9,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/08/xura.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', defBuf: 0.20, lbl: '霧の胞子: 常時全部隊被ダメ-20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, atkDebuf: 0.25, lbl: '貫通の矢: 2回毎:弓追加+100%・敵被ダメ+25%(1T)' },
    s3: { tp: 'always', prob: 1.0, target: 'bow', defBuf: 0.15, atkDmgBuf: 0.10, lbl: '変幻自在: 常時弓被ダメ-15%・弓与ダメ+10%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 10 =====
  {
    id: 'gregory',
    n: 'グレゴリー',
    g: 10,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/gregory350.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.20, lbl: '鋼鉄の防壁: 常時盾被ダメ-20%' },
    s2: { tp: 'always', prob: 1.0, critRate: 0.25, lbl: '制圧突撃: 常時クリ率25%' },
    s3: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '灼熱の軍団: 常時ATK+15%・DEF+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'freya',
    n: 'フレイヤ',
    g: 10,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/freya350.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.20, lbl: '夕暮れの霧: 常時敵ATK-20%' },
    s2: { tp: 'prob', prob: 0.50, extraAtk: 1.00, lbl: '新月の鎌: 50%:追加攻撃+100%' },
    s3: { tp: 'always', prob: 1.0, defBuf: 0.15, atkDmgBuf: 0.15, lbl: '疾風の一撃: 常時盾弓被ダメ-15%・与ダメ+15%' },
    sd: [],
    sa: [],
  },
  {
    id: 'blanche',
    n: 'ブランシュ',
    g: 10,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/blanchette350.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: '真紅の刃: 常時全部隊殺傷力+25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, target: 'bow', extraAtk: 0.75, lbl: '熾紅爆裂: 3T毎弓追加+75%' },
    s3: { tp: 'periodic', prob: 1.0, period: 2, atkDmgBuf: 0.40, lbl: 'S3(未撮影): 2回毎:対槍+40%・対弓+20%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 11 =====
  {
    id: 'elionora',
    n: 'エリオノーラ',
    g: 11,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2025/03/eleonora.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'all', hpBuf: 0.25, lbl: '烈日の威光: 常時全部隊HP+25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.10, lbl: 'ソラリス方陣: 常時盾被ダメ-10%・弓与ダメ+10%' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, duration: 2, target: 'all', atkDmgBuf: 0.25, defBuf: 0.25, lbl: '烈火の飛光: 盾5回毎:全部隊与ダメ+25%・被ダメ-25%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'lloyd',
    n: 'ロイド',
    g: 11,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2025/03/Lloyd.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, lethDebuf: 0.20, lbl: '群鳥の侵襲: 常時敵殺傷力-20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, duration: 1, target: 'spear', atkDmgBuf: 1.50, lethDebuf: 0.30, lbl: '氷霧爆弾: 3T毎:槍ダメ+150%・敵殺傷力-30%(1T)' },
    s3: { tp: 'prob', prob: 0.40, target: 'all', lethBuf: 0.50, lbl: '千変万化: 40%:全部隊殺傷力+50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'rufus',
    n: 'ルーファス',
    g: 11,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2025/03/rufus.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', atkBuf: 0.25, lbl: '火焔戦団: 常時全部隊ATK+25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 1, target: 'bow', extraAtk: 0.60, atkDebuf: 0.25, duration: 1, lbl: '砕鎧の一撃: 弓攻撃毎+60%追加・敵被ダメ+25%(1T)' },
    s3: { tp: 'prob', prob: 0.20, duration: 2, lethDebuf: 0.50, lbl: '苛烈震撼: 20%:敵殺傷力-50%(2T)' },
    sd: [],
    sa: [],
  },

  // ===== Generation 12 =====
  {
    id: 'hervil',
    n: 'ヘルヴィル',
    g: 12,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FHervor-1.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: 'ウォーラウド: 常時全部隊殺傷力+25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.25, lbl: '不滅の軍団: 常時盾通常被ダメ-25%・スキル被ダメ-30%' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.15, atkDmgBuf: 0.10, lbl: '戦火の意志: 常時盾被ダメ-15%・盾与ダメ+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'carol',
    n: 'カロール',
    g: 12,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8Fkarol-1.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, target: 'all', defBuf: 0.20, lbl: '守護の翼: 常時全部隊被ダメ-20%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: 'ブレイクスピア: 常時対槍+30%・対盾+25%' },
    s3: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '栄光の戦旗: 常時ATK+15%・DEF+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'laizia',
    n: 'ライジーア',
    g: 12,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2025/05/20250519%E8%8B%B1%E9%9B%84%E5%A4%B4%E5%83%8FLigeia-1.jpg',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, defDebuf: 0.25, lbl: 'スチールファング: 常時敵DEF-25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, atkDebuf: 0.25, lbl: '崩壊の毒: 2回毎:弓追加+100%・敵被ダメ+25%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, defBuf: 0.20, lbl: 'ポイズンファング: 2回毎:弓+100%・敵与ダメ-20%(1T)' },
    sd: [],
    sa: [],
  },

  // === SR Heroes ===
  {
    id: 'sergey', n: 'セルゲイ', g: 0, r: 'SR' as Rarity, t: 'shield' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/sergey.png',
    dS: 8, aS: 5, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, defBuf: 20, lbl: 'プロテクト: 被ダメ-20%' },
    s2: { tp: 'always' as SkillTrigger, prob: 1, atkStatDebuf: 20, lbl: '敵攻撃-20%' },
    s3: null, sd: [], sa: []
  },
  {
    id: 'patrick', n: 'パトリック', g: 0, r: 'SR' as Rarity, t: 'spear' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/patrick.png',
    dS: 7, aS: 7, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, hpBuf: 25, lbl: '幸せグルメ: HP+25%' },
    s2: { tp: 'always' as SkillTrigger, prob: 1, atkBuf: 25, lbl: '攻撃力+25%' },
    s3: null, sd: [], sa: []
  },
  {
    id: 'jessie', n: 'ジェシー', g: 0, r: 'SR' as Rarity, t: 'spear' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/jessie.png',
    dS: 6, aS: 9, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, atkDmgBuf: 25, lbl: '完全武装: 与ダメ+25%' },
    s2: { tp: 'always' as SkillTrigger, prob: 1, defBuf: 20, lbl: '被ダメ-20%' },
    s3: null, sd: [], sa: []
  },
  {
    id: 'bahiti', n: 'バスティ', g: 0, r: 'SR' as Rarity, t: 'bow' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/bahiti.png',
    dS: 5, aS: 7, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, defBuf: 20, lbl: '危険予知: 被ダメ-20%' },
    s2: { tp: 'prob' as SkillTrigger, prob: 0.50, atkDmgBuf: 50, lbl: '与ダメ+50%(50%)' },
    s3: null, sd: [], sa: []
  },
  {
    id: 'linsetsu', n: 'リンセツ', g: 0, r: 'SR' as Rarity, t: 'spear' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/12/%E5%87%9B%E9%9B%AA350.jpg',
    dS: 5, aS: 6, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, atkStatDebuf: 20, lbl: '威風八面: 敵攻撃-20%' },
    s2: null, s3: null, sd: [], sa: []
  },
  {
    id: 'jhaseru', n: 'ジャセル', g: 0, r: 'SR' as Rarity, t: 'bow' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/1.jpg',
    dS: 5, aS: 8, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, atkDmgBuf: 25, lbl: '戦術演習: 与ダメ+25%' },
    s2: null, s3: null, sd: [], sa: []
  },
  {
    id: 'soyun', n: 'ソユン', g: 0, r: 'SR' as Rarity, t: 'bow' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/2.jpg',
    dS: 4, aS: 7, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, atkBuf: 25, lbl: '征伐の陣太鼓: 攻撃力+25%' },
    s2: null, s3: null, sd: [], sa: []
  },
  {
    id: 'lumboogan', n: 'ルム・ボーガン', g: 0, r: 'SR' as Rarity, t: 'spear' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/3.png',
    dS: 5, aS: 5, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: { tp: 'always' as SkillTrigger, prob: 1, defBuf: 20, lbl: '誘惑戦術: 敵与ダメ-20%' },
    s2: null, s3: null, sd: [], sa: []
  },
  {
    id: 'gina', n: 'ジーナ', g: 0, r: 'SR' as Rarity, t: 'bow' as TroopType,
    img: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/Gina.png',
    dS: 3, aS: 3, aT: 0, dT: 0, glg: 0, gearBase: 0,
    gs: undefined,
    s1: null, s2: null, s3: null, sd: [], sa: []
  },
];

/** Helper: find hero by id */
export function getHeroById(id: string): Hero | undefined {
  return HEROES.find((h) => h.id === id);
}

/** Helper: get all heroes by troop type */
export function getHeroesByType(t: TroopType): Hero[] {
  return HEROES.filter((h) => h.t === t);
}

/** Helper: get all SSR heroes */
export function getSSRHeroes(): Hero[] {
  return HEROES.filter((h) => h.r === 'SSR');
}
