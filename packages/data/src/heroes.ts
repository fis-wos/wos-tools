/**
 * WOS Battle Simulator - Hero Definitions
 *
 * All SSR heroes (G1-G12) plus SR heroes.
 * Skill data sourced from: whiteoutsurvival.app, altema.jp, whiteoutsurvival.wiki
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
    img: IMG_BASE + '2024/12/Jeronimo.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '常時与ダメ+25%' },
    s2: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '常時ATK+25%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, atkDmgBuf: 0.30, lbl: '4T毎与ダメ+30%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'natalia',
    n: 'ナタリア',
    g: 1,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/Natalia.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '40%:被ダメ-50%' },
    s2: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '常時ATK+25%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '常時与ダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'jasmine',
    n: 'ジャスミン',
    g: 1,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Jasmine.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '40%:被ダメ-50%' },
    s2: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '50%:与ダメ+50%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '常時与ダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'zinman',
    n: 'ジンマン',
    g: 1,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Zinman.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 50.04,
    gearBase: 21.6,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, defStatBuf: 0.10, hpBuf: 0.10, lbl: '常時DEF+10%・HP+10%' },
    s2: null,
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '常時与ダメ+25%' },
    sd: [],
    sa: [],
    ns: 'S2は開発スキル（未実装）',
  },

  // ===== Generation 2 =====
  {
    id: 'flint',
    n: 'フリント',
    g: 2,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/Flint.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'shield', atkDmgBuf: 1.00, lbl: '常時盾兵与ダメ+100%' },
    s2: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '常時ATK+25%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: '常時全部隊殺傷力+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'frender',
    n: 'フレンダー',
    g: 2,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Frender.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '常時ATK+15%・DEF+10%' },
    s2: { tp: 'prob', prob: 0.25, extraAtk: 2.00, lbl: '25%:追加攻撃+200%' },
    s3: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '40%:被ダメ-50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'alonzo',
    n: 'アロンゾ',
    g: 2,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Alonzo.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 60.05,
    gearBase: 25.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '50%:与ダメ+50%' },
    s2: { tp: 'prob', prob: 0.20, duration: 2, defBuf: 0.50, lbl: '20%:敵与ダメ-50%(2T)' },
    s3: { tp: 'prob', prob: 0.40, lethBuf: 0.50, lbl: '40%:殺傷力+50%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 3 =====
  {
    id: 'lauren',
    n: 'ローレン',
    g: 3,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/Lauren.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.20, lbl: '常時敵ATK-20%' },
    s2: { tp: 'always', prob: 1.0, defBuf: 0.20, lbl: '常時被ダメ-20%' },
    s3: { tp: 'always', prob: 1.0, hpBuf: 0.25, lbl: '常時HP+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'moa',
    n: 'モア',
    g: 3,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Moa.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'prob', prob: 0.50, atkDebuf: 0.50, lbl: '50%:敵被ダメ+50%' },
    s2: { tp: 'prob', prob: 0.50, atkDmgBuf: 0.50, lbl: '50%:与ダメ+50%' },
    s3: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '40%:被ダメ-50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'greg',
    n: 'グレッグ',
    g: 3,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Greg.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 72.56,
    gearBase: 31.3,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.20, duration: 3, atkDmgBuf: 0.40, lbl: '20%:与ダメ+40%(3T)' },
    s2: { tp: 'prob', prob: 0.20, duration: 2, defBuf: 0.50, lbl: '20%:敵与ダメ-50%(2T)' },
    s3: { tp: 'always', prob: 1.0, hpBuf: 0.25, lbl: '常時HP+25%' },
    sd: [],
    sa: [],
  },

  // ===== Generation 4 =====
  {
    id: 'aquas',
    n: 'アクアス',
    g: 4,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/Aquas.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, defBuf: 0.70, lbl: '4回毎:盾被ダメ-70%・槍弓被ダメ-30%(2T)' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', atkDmgBuf: 1.00, lbl: '盾兵与ダメ+100%' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', atkBuf: 0.60, atkDebuf: 0.25, duration: 1, lbl: '盾ATK+60%・敵被ダメ+25%(1T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'reina',
    n: 'レイナ',
    g: 4,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Reina.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: '常時通常攻撃与ダメ+30%' },
    s2: { tp: 'prob', prob: 0.20, dodge: 1.00, lbl: '20%:回避' },
    s3: { tp: 'prob', prob: 0.25, target: 'spear', extraAtk: 2.00, lbl: '25%:槍兵追加攻撃+200%' },
    sd: [],
    sa: [],
  },
  {
    id: 'lion',
    n: 'リオン',
    g: 4,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Lion.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 92.50,
    gearBase: 39.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'prob', prob: 0.40, atkDmgBuf: 0.50, lbl: '40%:与ダメ+50%' },
    s2: { tp: 'always', prob: 1.0, defBuf: 0.20, lbl: '常時敵与ダメ-20%' },
    s3: { tp: 'periodic', prob: 1.0, period: 3, target: 'bow', atkBuf: 0.05, lbl: '弓3回攻撃毎ATK+5%(累積)' },
    sd: [],
    sa: [],
  },

  // ===== Generation 5 =====
  {
    id: 'hector',
    n: 'ヘクター',
    g: 5,
    r: 'SSR',
    t: 'shield',
    img: IMG_BASE + '2024/12/Hector.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'prob', prob: 0.40, defBuf: 0.50, lbl: '40%:被ダメ-50%' },
    s2: { tp: 'prob', prob: 0.25, target: 'shield', extraAtk: 2.00, lbl: '25%:盾+200%・弓+100%' },
    s3: { tp: 'prob', prob: 0.25, extraAtk: 2.00, lbl: '25%:追加攻撃+200%' },
    sd: [],
    sa: [],
  },
  {
    id: 'nora',
    n: 'ノラ',
    g: 5,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Nora.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, defBuf: 0.15, atkDmgBuf: 0.15, lbl: '常時盾弓被ダメ-15%・与ダメ+15%' },
    s2: { tp: 'prob', prob: 0.20, target: 'enemy', extraAtk: 1.00, lbl: '20%:全敵追加攻撃+100%' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, duration: 2, target: 'all', atkDmgBuf: 0.25, defBuf: 0.25, lbl: '槍5回毎:全部隊与ダメ+25%・被ダメ-25%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'gwen',
    n: 'グエン',
    g: 5,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Gwen.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 111.09,
    gearBase: 47.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, atkDebuf: 0.25, lbl: '常時敵被ダメ+25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 5, extraAtk: 1.00, atkDebuf: 0.15, lbl: '5回毎追加+100%・次回敵被ダメ+15%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, target: 'enemy', atkDmgBuf: 0.50, lbl: '4回毎全敵+50%ダメ' },
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
    img: IMG_BASE + '2024/12/Nameless.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, defBuf: 0.25, lbl: '常時通常被ダメ-25%・スキル被ダメ-30%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.20, lbl: '常時与ダメ+20%' },
    s3: { tp: 'always', prob: 1.0, atkDmgBuf: 0.25, lbl: '常時スキルダメ+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'renee',
    n: 'レネ',
    g: 6,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Renee.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', extraAtk: 2.00, lbl: '2T毎夢印→槍兵追加+200%' },
    s2: { tp: 'always', prob: 1.0, target: 'spear', atkDmgBuf: 1.50, lbl: '夢印対象に槍兵+150%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', atkDmgBuf: 0.75, lbl: '夢印対象に全部隊+75%' },
    sd: [],
    sa: [],
  },
  {
    id: 'wayne',
    n: 'ウェイン',
    g: 6,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Wayne.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 133.50,
    gearBase: 57.5,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'periodic', prob: 1.0, period: 4, target: 'all', extraAtk: 1.00, lbl: '4T毎全部隊追加+100%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', atkDmgBuf: 0.40, lbl: '隔回:槍+40%・弓+20%' },
    s3: { tp: 'always', prob: 1.0, critRate: 0.25, lbl: '常時クリ率+25%' },
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
    img: IMG_BASE + '2024/12/Edith.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'bow', defBuf: 0.20, lbl: '常時弓被ダメ-20%・槍与ダメ+20%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.20, lbl: '常時盾被ダメ-20%' },
    s3: { tp: 'always', prob: 1.0, target: 'all', hpBuf: 0.25, lbl: '常時全部隊HP+25%' },
    sd: [],
    sa: [],
  },
  {
    id: 'gordon',
    n: 'ゴードン',
    g: 7,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Gordon.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'periodic', prob: 1.0, period: 2, target: 'spear', extraAtk: 1.00, lbl: '2回毎:槍追加+100%・毒(敵与ダメ-20%)' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, duration: 1, target: 'spear', atkDmgBuf: 1.50, lbl: '3T毎:槍+150%・敵与ダメ-30%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, atkDebuf: 0.30, lbl: '4T毎:敵盾被ダメ+30%・敵弓与ダメ-30%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'bradley',
    n: 'ブラッドリー',
    g: 7,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Bradley.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 160.50,
    gearBase: 70.1,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '常時ATK+25%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: '常時対槍+30%・対盾+25%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, target: 'all', atkDmgBuf: 0.30, lbl: '4T毎全部隊与ダメ+30%(2T)' },
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
    img: IMG_BASE + '2024/12/Gato.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.25, lbl: '常時敵ATK-25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defStatBuf: 0.30, lbl: '常時盾DEF+30%' },
    s3: { tp: 'periodic', prob: 1.0, period: 1, shield: 0.30, lbl: '攻撃毎シールド(ATK×30%)' },
    sd: [],
    sa: [],
  },
  {
    id: 'sonya',
    n: 'ソニヤ',
    g: 8,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Sonya.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, target: 'all', atkDmgBuf: 0.20, lbl: '常時全部隊与ダメ+20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'spear', extraAtk: 0.75, atkBuf: 0.25, lbl: '2回毎:槍+75%・全部隊ATK+25%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, target: 'spear', extraAtk: 2.50, stun: 1, lbl: '5T毎:槍+250%・スタン1T' },
    sd: [],
    sa: [],
  },
  {
    id: 'hendrick',
    n: 'ヘンドリック',
    g: 8,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Hendrick.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 193.00,
    gearBase: 84.1,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, defDebuf: 0.25, lbl: '常時敵DEF-25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 4, duration: 2, target: 'all', defStatBuf: 0.30, lbl: '4T毎全部隊DEF+30%(2T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 3, target: 'enemy', dotDmg: 0.40, lbl: '3T毎全敵40%ダメ' },
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
    img: IMG_BASE + '2024/12/Magnus.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.25, lbl: '常時ATK+25%' },
    s2: { tp: 'prob', prob: 0.40, duration: 1, target: 'shield', defStatBuf: 0.50, lbl: '40%:盾DEF+50%(1T)' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.10, lbl: '常時盾被ダメ-10%・弓与ダメ+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'fred',
    n: 'フレッド',
    g: 9,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Fred.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, lethDebuf: 0.20, lbl: '常時敵殺傷力-20%' },
    s2: { tp: 'always', prob: 1.0, target: 'enemy', atkDebuf: 0.20, lbl: '常時敵盾被ダメ+20%' },
    s3: { tp: 'periodic', prob: 1.0, period: 4, target: 'spear', extraAtk: 2.00, defBuf: 0.20, lbl: '4回毎:槍追加+200%・敵与ダメ-20%(次T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'shura',
    n: 'シュラ',
    g: 9,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Shura.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 232.00,
    gearBase: 100.0,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', defBuf: 0.20, lbl: '常時全部隊被ダメ-20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, atkDebuf: 0.25, lbl: '2回毎:弓追加+100%・敵被ダメ+25%(1T)' },
    s3: { tp: 'always', prob: 1.0, target: 'bow', defBuf: 0.15, atkDmgBuf: 0.10, lbl: '常時弓被ダメ-15%・弓与ダメ+10%' },
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
    img: IMG_BASE + '2024/12/Gregory.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '常時ATK+15%・DEF+10%' },
    s2: { tp: 'always', prob: 1.0, critRate: 0.25, lbl: '常時クリ率25%' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.20, lbl: '常時盾被ダメ-20%' },
    sd: [],
    sa: [],
  },
  {
    id: 'freya',
    n: 'フレイヤ',
    g: 10,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Freya.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, atkStatDebuf: 0.20, lbl: '常時敵ATK-20%' },
    s2: { tp: 'prob', prob: 0.50, extraAtk: 1.00, lbl: '50%:追加攻撃+100%' },
    s3: { tp: 'always', prob: 1.0, defBuf: 0.15, atkDmgBuf: 0.15, lbl: '常時盾弓被ダメ-15%・与ダメ+15%' },
    sd: [],
    sa: [],
  },
  {
    id: 'blanche',
    n: 'ブランシュ',
    g: 10,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Blanche.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 277.50,
    gearBase: 119.6,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: '常時全部隊殺傷力+25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, target: 'bow', extraAtk: 0.75, lbl: '3回毎弓追加+75%' },
    s3: { tp: 'periodic', prob: 1.0, period: 2, atkDmgBuf: 0.40, lbl: '2回毎:対槍+40%・対弓+20%' },
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
    img: IMG_BASE + '2024/12/Elionora.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'def', eff: 'def' },
    s1: { tp: 'always', prob: 1.0, target: 'all', hpBuf: 0.25, lbl: '常時全部隊HP+25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.10, lbl: '常時盾被ダメ-10%・弓与ダメ+10%' },
    s3: { tp: 'periodic', prob: 1.0, period: 5, duration: 2, target: 'all', atkDmgBuf: 0.25, defBuf: 0.25, lbl: '盾5回毎:全部隊与ダメ+25%・被ダメ-25%(2T)' },
    sd: [],
    sa: [],
  },
  {
    id: 'lloyd',
    n: 'ロイド',
    g: 11,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Lloyd.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, lethDebuf: 0.20, lbl: '常時敵殺傷力-20%' },
    s2: { tp: 'periodic', prob: 1.0, period: 3, duration: 1, target: 'spear', atkBuf: 1.50, lethDebuf: 0.30, lbl: '3T毎:槍ATK+150%・敵殺傷力-30%(1T)' },
    s3: { tp: 'prob', prob: 0.40, target: 'all', lethBuf: 0.50, lbl: '40%:全部隊殺傷力+50%' },
    sd: [],
    sa: [],
  },
  {
    id: 'rufus',
    n: 'ルーファス',
    g: 11,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Rufus.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 320.00,
    gearBase: 137.9,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, target: 'all', atkBuf: 0.25, lbl: '常時全部隊ATK+25%' },
    s2: { tp: 'always', prob: 1.0, target: 'bow', extraAtk: 0.60, atkDebuf: 0.25, duration: 1, lbl: '常時弓追加+60%・敵被ダメ+25%(1T)' },
    s3: { tp: 'prob', prob: 0.20, duration: 2, lethDebuf: 0.50, lbl: '20%:敵殺傷力-50%(2T)' },
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
    img: IMG_BASE + '2024/12/Hervil.png',
    dS: 1.0,
    aS: 1.0,
    aT: 0,
    dT: 0,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'def', eff: 'hp' },
    s1: { tp: 'always', prob: 1.0, target: 'all', lethBuf: 0.25, lbl: '常時全部隊殺傷力+25%' },
    s2: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.25, lbl: '常時盾通常被ダメ-25%・スキル被ダメ-30%' },
    s3: { tp: 'always', prob: 1.0, target: 'shield', defBuf: 0.15, atkDmgBuf: 0.10, lbl: '常時盾被ダメ-15%・盾与ダメ+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'carol',
    n: 'カロール',
    g: 12,
    r: 'SSR',
    t: 'spear',
    img: IMG_BASE + '2024/12/Carol.png',
    dS: 1.0,
    aS: 1.0,
    aT: 1,
    dT: 1,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'atk', eff: 'atk' },
    s1: { tp: 'always', prob: 1.0, target: 'all', defBuf: 0.20, lbl: '常時全部隊被ダメ-20%' },
    s2: { tp: 'always', prob: 1.0, atkDmgBuf: 0.30, lbl: '常時対槍+30%・対盾+25%' },
    s3: { tp: 'always', prob: 1.0, atkBuf: 0.15, defStatBuf: 0.10, lbl: '常時ATK+15%・DEF+10%' },
    sd: [],
    sa: [],
  },
  {
    id: 'laizia',
    n: 'ライジーア',
    g: 12,
    r: 'SSR',
    t: 'bow',
    img: IMG_BASE + '2024/12/Laizia.png',
    dS: 1.0,
    aS: 1.0,
    aT: 2,
    dT: 2,
    glg: 362.50,
    gearBase: 156.2,
    gs: { timing: 'atk', eff: 'leth' },
    s1: { tp: 'always', prob: 1.0, defDebuf: 0.25, lbl: '常時敵DEF-25%' },
    s2: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, atkDebuf: 0.25, lbl: '2回毎:弓追加+100%・敵被ダメ+25%(1T)' },
    s3: { tp: 'periodic', prob: 1.0, period: 2, duration: 1, target: 'bow', extraAtk: 1.00, defBuf: 0.20, lbl: '2回毎:弓+100%・敵与ダメ-20%(1T)' },
    sd: [],
    sa: [],
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
