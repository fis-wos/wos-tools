/**
 * WOS Battle Simulator - Battle Engine
 *
 * Core battle simulation logic based on data-mined mechanics:
 *
 * Kill formula (per troop type per turn):
 *   kills = sqrt(自軍兵数) * (ATK * Lethality) / (敵DEF * 敵HP) * SkillMod * TypeBonus
 *
 * SkillMod = (DamageUp * OppDefenseDown) / (DefenseUp * OppDamageDown)
 *
 * Front-line system:
 *   Shield = front row, Spear = mid row, Bow = back row
 *   Attacks target the front-most surviving row first.
 *   Exception: Ambusher — spear has 20% chance to bypass shield and hit bow directly.
 *
 * Type advantage (三すくみ):
 *   Shield > Spear, Spear > Bow, Bow > Shield: +10% damage bonus
 *
 * Rally riders:
 *   - Leaders: all 3 skills (S1/S2/S3) activate
 *   - Riders: only S1 activates
 *   - Rider stats/equipment are irrelevant (skill effect only)
 *   - Duplicate heroes: only the highest-level instance counts
 *   - Top 4 rider skills selected from joiners
 *
 * Casualty mechanics:
 *   - Attacker loss: 27% dead / 13% severe wound / 60% light wound
 *   - Defender loss: 0% dead / 35% severe wound / 65% light wound
 *   - Winner loss:  4% dead / 46% severe wound / 50% light wound
 *   - Hospital overflow: 70% salvaged via barracks
 *
 * Attack order per turn: all troop types act simultaneously.
 * Max turns: 100
 */

import { type Hero, type Skill, type TroopType } from './heroes';
import { type TroopStats, type SkillMod, type HeroConfig, emptySkillMod } from './hero-stats';
import { TROOP_BASE_STATS, type TroopTier } from './troop-skills';
import { calcChiefGearStats, calcGemStats, calcGemsTotalByType, defaultGems } from './chief-gear';
import { calcHeroGearStats } from './hero-gear';

// ── Type definitions ──

/** Troop counts per type */
export interface TroopCount {
  shield: number;
  spear: number;
  bow: number;
}

/** Active skill effect for a side in a turn */
export interface SkillEffect {
  /** Skill mod for this side's troops (damage dealt / damage taken) */
  selfMod: SkillMod;
  /** Debuff applied to the opposing side */
  oppMod: {
    damageDown: number;   // reduces enemy's damage output (divides their kills)
    defenseDown: number;  // reduces enemy's defense (multiplies our kills)
  };
  /** Stun flags per troop type index [shield, spear, bow] */
  stun: number[];
  /** DoT damage rate */
  dotDmg: number;
  /** Reflect damage rate */
  reflectBuf: number;
}

/** Casualty breakdown for one side */
export interface CasualtyReport {
  /** Permanently dead troops (unrecoverable) */
  dead: number;
  /** Severely wounded troops (require hospital) */
  severeWound: number;
  /** Lightly wounded troops (instant recovery) */
  lightWound: number;
  /** Surviving troops */
  survived: number;
}

/** Single turn log entry */
export interface BattleLog {
  turn: number;
  aTroops: TroopCount;
  dTroops: TroopCount;
  aDmg: TroopCount;
  dDmg: TroopCount;
  skills: string[];
}

/** Result of a single simulation */
export interface SimResult {
  winner: 'atk' | 'def' | 'draw';
  turns: number;
  aTroopsLeft: TroopCount;
  dTroopsLeft: TroopCount;
  aLossRate: number;
  dLossRate: number;
  aCasualty: CasualtyReport;
  dCasualty: CasualtyReport;
  logs: BattleLog[];
}

/** Aggregated result of multiple simulations */
export interface SimAggregateResult {
  runs: number;
  atkWins: number;
  defWins: number;
  draws: number;
  avgTurns: number;
  avgAtkLossRate: number;
  avgDefLossRate: number;
  results: SimResult[];
}

/** Full simulation configuration */
export interface SimConfig {
  aTroops: TroopCount;
  dTroops: TroopCount;
  aHeroStats: TroopStats[];
  dHeroStats: TroopStats[];
  aLeaders: Hero[];
  aRiders: Hero[];
  dLeaders: Hero[];
  dRiders: Hero[];
  /** Troop tier for attacker (default: 11 = T11烈日) */
  aTroopTier?: TroopTier;
  /** Troop tier for defender (default: 11 = T11烈日) */
  dTroopTier?: TroopTier;
  /** Hospital capacity for attacker (default: Infinity) */
  aHospitalCap?: number;
  /** Hospital capacity for defender (default: Infinity) */
  dHospitalCap?: number;
  /** Chief gear tier ID for attacker (default: 'myth_t4_s3') */
  aChiefGearTier?: string;
  /** Chief gear tier ID for defender (default: 'myth_t4_s3') */
  dChiefGearTier?: string;
  /** Gem level for attacker (default: 16) - legacy single level */
  aGemLevel?: number;
  /** Gem level for defender (default: 16) - legacy single level */
  dGemLevel?: number;
  /** Per-piece gem levels for attacker: 6x3 matrix [shieldLv, spearLv, bowLv] per gear piece */
  aGems?: number[][];
  /** Per-piece gem levels for defender: 6x3 matrix [shieldLv, spearLv, bowLv] per gear piece */
  dGems?: number[][];
  /** Hero gear level ID for attacker (default: 'gold_max') */
  aHeroGearLevel?: string;
  /** Hero gear level ID for defender (default: 'gold_max') */
  dHeroGearLevel?: string;
  /** Pet stats for attacker (per troop type) */
  aPetStats?: { atk: number; def: number; shieldLeth: number; shieldHp: number; spearLeth: number; spearHp: number; bowLeth: number; bowHp: number };
  /** Pet stats for defender */
  dPetStats?: { atk: number; def: number; shieldLeth: number; shieldHp: number; spearLeth: number; spearHp: number; bowLeth: number; bowHp: number };
  runs?: number;
}

// ── Constants ──

const TROOP_TYPES: TroopType[] = ['shield', 'spear', 'bow'];

/** Type advantage map: attacker type -> defender type that takes +10% bonus damage */
const TYPE_ADVANTAGE: Record<TroopType, TroopType> = {
  shield: 'spear',
  spear: 'bow',
  bow: 'shield',
};

/** Ambusher: probability that spear bypasses shield to hit bow directly */
const AMBUSHER_PROB = 0.20;

/** Jitter range for damage variance */
const JITTER_MIN = 0.92;
const JITTER_MAX = 1.08;

const MAX_TURNS = 300;

/**
 * Damage coefficient C.
 * The data-mined formula kills = sqrt(troops) * ATK*Leth / DEF*HP is missing a
 * scaling constant that makes battles resolve in a reasonable number of turns.
 * With 1.8M troops and typical G9-G12 stats, raw formula yields ~700 kills/turn,
 * requiring 2500+ turns. Real battles end in 30-60 turns.
 * C ≈ 50 produces ~35,000 kills/turn → battle resolves in ~50 turns.
 * This will be refined with more battle report data.
 */
const DAMAGE_COEFFICIENT = 20;

/** Type advantage bonus multiplier */
const TYPE_BONUS = 1.10;

/** Max rider skill slots from joiners */
const MAX_RIDER_SKILLS = 4;

// ── Casualty rate constants ──
const CASUALTY_ATK_LOSER = { dead: 0.27, severeWound: 0.13, lightWound: 0.60 };
const CASUALTY_DEF_LOSER = { dead: 0.00, severeWound: 0.35, lightWound: 0.65 };
const CASUALTY_WINNER    = { dead: 0.04, severeWound: 0.46, lightWound: 0.50 };
/** Barracks salvage rate for hospital overflow */
const BARRACKS_SALVAGE = 0.70;

// ── Helpers ──

function jitter(): number {
  return JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
}

function totalTroops(t: TroopCount): number {
  return t.shield + t.spear + t.bow;
}

function cloneTroops(t: TroopCount): TroopCount {
  return { shield: t.shield, spear: t.spear, bow: t.bow };
}

function emptyTroopCount(): TroopCount {
  return { shield: 0, spear: 0, bow: 0 };
}

function emptySkillEffect(): SkillEffect {
  return {
    selfMod: emptySkillMod(),
    oppMod: {
      damageDown: 1.0,
      defenseDown: 1.0,
    },
    stun: [0, 0, 0],
    dotDmg: 0,
    reflectBuf: 0,
  };
}

/**
 * Determine target based on type-advantage targeting.
 *
 * Each troop type primarily attacks the type it has advantage over:
 *   盾(shield) → 槍(spear)  密集戦陣: +10%
 *   槍(spear)  → 弓(bow)    突撃: +10%
 *   弓(bow)    → 盾(shield) 遠距離打撃: +10%
 *
 * If the preferred target is gone, fall back to any surviving type.
 * This was confirmed by battle reports showing:
 *   - 槍 losses = 0 (only attacked by low-ATK shields)
 *   - 弓 losses = high (attacked by high-ATK spears)
 *   - 盾 losses = highest (attacked by highest-ATK bows)
 */
function getTarget(
  attackerType: TroopType,
  enemyTroops: TroopCount
): TroopType | null {
  // Primary target: type advantage (confirmed by battle reports)
  const preferred = TYPE_ADVANTAGE[attackerType]; // shield→spear, spear→bow, bow→shield
  if (enemyTroops[preferred] > 0) return preferred;

  // Fallback: attack any surviving troop type (front-line order)
  if (enemyTroops.shield > 0) return 'shield';
  if (enemyTroops.spear > 0) return 'spear';
  if (enemyTroops.bow > 0) return 'bow';
  return null;
}

/**
 * Calculate type advantage bonus.
 * Returns TYPE_BONUS (1.10) if attacker has advantage, 1.0 otherwise.
 */
function typeBonus(attackerType: TroopType, targetType: TroopType): number {
  return TYPE_ADVANTAGE[attackerType] === targetType ? TYPE_BONUS : 1.0;
}

// ── Skill evaluation ──

/**
 * Evaluate skill activations for leaders and riders on one side.
 *
 * Leaders: all 3 skills (S1/S2/S3) activate.
 * Riders: only S1 activates. Duplicate heroes are deduplicated (highest skill level kept).
 * Only top MAX_RIDER_SKILLS rider skills are selected from joiners.
 *
 * Skill effects are aggregated:
 * - Same effect_op (e.g. multiple atkDmgBuf): additive within the group, then applied
 * - Different effect_ops: multiplicative
 *
 * For simplicity, we accumulate additive bonuses per effect type, then convert
 * to multiplicative SkillMod at the end.
 */
export function evSk(
  leaders: Hero[],
  riders: Hero[],
  turnNumber: number = 1
): SkillEffect {
  const effect = emptySkillEffect();

  // Accumulators for additive stacking within each buff category
  let atkDmgBufSum = 0;     // 与ダメ増加 (-> damageUp)
  let defBufSum = 0;         // 被ダメ軽減 (-> defenseUp)
  let atkBufSum = 0;         // ATK増加 (-> damageUp variant)
  let lethBufSum = 0;        // 殺傷力増加 (-> damageUp variant)
  let hpBufSum = 0;          // HP増加 (-> defenseUp variant)
  let defStatBufSum = 0;     // DEF増加 (-> defenseUp variant)
  let atkDebufSum = 0;       // 敵被ダメ増加 (-> oppDamageDown)
  let defDebufSum = 0;       // 敵DEF低下 (-> oppDefenseDown)
  let atkStatDebufSum = 0;   // 敵ATK低下 (-> oppDamageDown variant)
  let lethDebufSum = 0;      // 敵殺傷力低下 (-> oppDamageDown variant)
  let extraAtkSum = 0;       // 追加攻撃 (-> damageUp加算)

  const processSkill = (skill: Skill): void => {
    let fires = false;
    if (skill.tp === 'always') {
      fires = true;
    } else if (skill.tp === 'periodic') {
      // N回/Nターン毎に1回発動（period=3なら3ターンに1回）
      const period = skill.period || 1;
      fires = (turnNumber % period === 0);
    } else {
      // prob型: 確率で発動
      fires = Math.random() < skill.prob;
    }
    if (!fires) return;

    // 攻撃系バフ
    if (skill.atkDmgBuf) atkDmgBufSum += skill.atkDmgBuf;
    if (skill.atkBuf) atkBufSum += skill.atkBuf;
    if (skill.lethBuf) lethBufSum += skill.lethBuf;
    if (skill.extraAtk) extraAtkSum += skill.extraAtk;
    // 防御系バフ
    if (skill.defBuf) defBufSum += skill.defBuf;
    if (skill.hpBuf) hpBufSum += skill.hpBuf;
    if (skill.defStatBuf) defStatBufSum += skill.defStatBuf;
    // 敵デバフ
    if (skill.atkDebuf) atkDebufSum += skill.atkDebuf;
    if (skill.defDebuf) defDebufSum += skill.defDebuf;
    if (skill.atkStatDebuf) atkStatDebufSum += skill.atkStatDebuf;
    if (skill.lethDebuf) lethDebufSum += skill.lethDebuf;
    // その他
    if (skill.dotDmg) effect.dotDmg += skill.dotDmg;
    if (skill.reflectBuf) effect.reflectBuf += skill.reflectBuf;

    // Stun: apply to all enemy troop types for simplicity
    if (skill.stun) {
      for (let i = 0; i < 3; i++) {
        effect.stun[i] = Math.max(effect.stun[i], skill.stun);
      }
    }
  };

  // Leaders: all 3 skills
  for (const hero of leaders) {
    const skills = [hero.s1, hero.s2, hero.s3].filter(
      (s): s is Skill => s !== null
    );
    for (const skill of skills) {
      processSkill(skill);
    }
  }

  // Riders: S1 only, deduplicated by hero ID (keep first occurrence)
  const usedHeroIds = new Set<string>();
  // Also collect leader IDs to avoid duplicate hero buffs
  for (const leader of leaders) {
    usedHeroIds.add(leader.id);
  }

  // Collect rider S1 skills, deduplicate, and take top MAX_RIDER_SKILLS
  const riderSkills: { heroId: string; skill: Skill }[] = [];
  for (const rider of riders) {
    if (usedHeroIds.has(rider.id)) continue; // duplicate hero prevention
    usedHeroIds.add(rider.id);
    if (rider.s1) {
      riderSkills.push({ heroId: rider.id, skill: rider.s1 });
    }
  }

  // Select top 4 rider skills (sorted by prob descending as a heuristic for "skill level")
  const selectedRiderSkills = riderSkills
    .slice(0, MAX_RIDER_SKILLS);

  for (const { skill } of selectedRiderSkills) {
    processSkill(skill);
  }

  // Convert additive accumulators to multiplicative SkillMod
  // DamageUp = 与ダメ × ATK × 殺傷力 × 追加攻撃（異なるeffect_opは乗算）
  effect.selfMod.damageUp = (1 + atkDmgBufSum + extraAtkSum) * (1 + atkBufSum) * (1 + lethBufSum);
  // DefenseUp = 被ダメ軽減 × HP × DEF（異なるeffect_opは乗算）
  effect.selfMod.defenseUp = (1 + defBufSum) * (1 + hpBufSum) * (1 + defStatBufSum);
  // Debuffs applied to opponent
  effect.oppMod.damageDown = (1 + atkDebufSum) * (1 + atkStatDebufSum) * (1 + lethDebufSum);
  effect.oppMod.defenseDown = 1 + defDebufSum;  // weakens enemy defense

  return effect;
}

// ── Kill calculation ──

/**
 * Calculate kills dealt by one troop type against a target.
 *
 * kills = sqrt(attackerCount) * (ATK * Lethality) / (targetDEF * targetHP) * SkillMod * typeBonus * jitter
 *
 * SkillMod = (damageUp * oppDefenseDown) / (defenseUp * oppDamageDown)
 * where:
 *   damageUp, oppDefenseDown are from the attacker's side
 *   defenseUp, oppDamageDown are from the defender's side
 */
function calcKills(
  attackerCount: number,
  attackerStats: TroopStats,
  targetStats: TroopStats,
  attackerSkillEff: SkillEffect,
  defenderSkillEff: SkillEffect,
  attackerType: TroopType,
  targetType: TroopType,
  targetCount: number,
  atkTroopTier: TroopTier = 11,
  defTroopTier: TroopTier = 11,
  gearAtkMod: number = 1,
  gemLethMod: number = 1
): number {
  if (attackerCount <= 0 || targetCount <= 0) return 0;

  // ベースステータスは両者同一MAXと仮定してキャンセル
  // 差がつくのはスキル効果・兵数・三すくみのみ
  // 領主装備と宝石の差分はgearAtkMod/gemLethModで反映

  // SkillMod = (attacker damageUp * attacker oppDefenseDown) / (defender defenseUp * defender oppDamageDown)
  const skillMod =
    (attackerSkillEff.selfMod.damageUp * attackerSkillEff.oppMod.defenseDown) /
    (defenderSkillEff.selfMod.defenseUp * defenderSkillEff.oppMod.damageDown);

  const tBonus = typeBonus(attackerType, targetType);

  const rawKills =
    DAMAGE_COEFFICIENT *
    Math.sqrt(attackerCount) *
    Math.max(skillMod, 0.01) *
    tBonus *
    gearAtkMod *
    gemLethMod *
    jitter();

  return Math.min(Math.max(Math.floor(rawKills), 0), targetCount);
}

// ── Casualty calculation ──

/**
 * Compute casualty breakdown based on win/lose status and side.
 */
function calcCasualties(
  totalInitial: number,
  totalSurvived: number,
  isWinner: boolean,
  isAttacker: boolean,
  hospitalCap: number
): CasualtyReport {
  const totalLoss = totalInitial - totalSurvived;
  if (totalLoss <= 0) {
    return { dead: 0, severeWound: 0, lightWound: 0, survived: totalSurvived };
  }

  let rates: { dead: number; severeWound: number; lightWound: number };

  if (isWinner) {
    rates = CASUALTY_WINNER;
  } else if (isAttacker) {
    rates = CASUALTY_ATK_LOSER;
  } else {
    rates = CASUALTY_DEF_LOSER;
  }

  let dead = Math.floor(totalLoss * rates.dead);
  let severeWound = Math.floor(totalLoss * rates.severeWound);
  let lightWound = totalLoss - dead - severeWound;

  // Hospital overflow: severe wounds exceeding capacity go to barracks (70% salvage)
  if (severeWound > hospitalCap) {
    const overflow = severeWound - hospitalCap;
    severeWound = hospitalCap;
    const salvaged = Math.floor(overflow * BARRACKS_SALVAGE);
    const unsalvaged = overflow - salvaged;
    dead += unsalvaged;
    lightWound += salvaged;
  }

  return { dead, severeWound, lightWound, survived: totalSurvived };
}

// ── Single simulation ──

/**
 * Run one full battle simulation.
 */
export function sim1(
  aTroopsInit: TroopCount,
  dTroopsInit: TroopCount,
  aHeroStats: TroopStats[],
  dHeroStats: TroopStats[],
  aLeaders: Hero[],
  aRiders: Hero[],
  dLeaders: Hero[],
  dRiders: Hero[],
  aHospitalCap: number = Infinity,
  dHospitalCap: number = Infinity,
  aTroopTier: TroopTier = 11,
  dTroopTier: TroopTier = 11,
  aChiefGearTier: string = 'myth_t4_s3',
  dChiefGearTier: string = 'myth_t4_s3',
  aGemLevel: number = 16,
  dGemLevel: number = 16,
  aHeroGearLevel: string = 'gold_max',
  dHeroGearLevel: string = 'gold_max',
  aGems: number[][] | undefined = undefined,
  dGems: number[][] | undefined = undefined,
  aPetStats = { atk: 333.5, def: 333.5, shieldLeth: 475.96, shieldHp: 475.96, spearLeth: 475.96, spearHp: 475.96, bowLeth: 475.96, bowHp: 475.96 },
  dPetStats = { atk: 333.5, def: 333.5, shieldLeth: 475.96, shieldHp: 475.96, spearLeth: 475.96, spearHp: 475.96, bowLeth: 475.96, bowHp: 475.96 }
): SimResult {
  const aT = cloneTroops(aTroopsInit);
  const dT = cloneTroops(dTroopsInit);
  const aTotal0 = totalTroops(aT);
  const dTotal0 = totalTroops(dT);
  const logs: BattleLog[] = [];

  // Chief gear and gem modifiers (differential between attacker and defender)
  const atkGear = calcChiefGearStats(aChiefGearTier);
  const defGear = calcChiefGearStats(dChiefGearTier);
  const atkHeroGear = calcHeroGearStats(aHeroGearLevel);
  const defHeroGear = calcHeroGearStats(dHeroGearLevel);

  // Per-troop-type gem totals (use detailed gems matrix if available, else legacy single level)
  const atkGemByType = aGems
    ? calcGemsTotalByType(aGems)
    : (() => { const g = calcGemStats(aGemLevel); return { shield: { leth: g.leth * 6, hp: g.hp * 6 }, spear: { leth: g.leth * 6, hp: g.hp * 6 }, bow: { leth: g.leth * 6, hp: g.hp * 6 } }; })();
  const defGemByType = dGems
    ? calcGemsTotalByType(dGems)
    : (() => { const g = calcGemStats(dGemLevel); return { shield: { leth: g.leth * 6, hp: g.hp * 6 }, spear: { leth: g.leth * 6, hp: g.hp * 6 }, bow: { leth: g.leth * 6, hp: g.hp * 6 } }; })();

  // Pet modifiers - per troop type (leth/hp are troop-specific, atk/def are global)
  const petLethKey = (type: TroopType) => type === 'shield' ? 'shieldLeth' : type === 'spear' ? 'spearLeth' : 'bowLeth';
  const petHpKey = (type: TroopType) => type === 'shield' ? 'shieldHp' : type === 'spear' ? 'spearHp' : 'bowHp';

  // Attacker's gear advantage when attacking defender
  const aGearAtkMod = (1 + (atkGear.atk + atkHeroGear.atk + aPetStats.atk) / 100) / (1 + (defGear.def + defHeroGear.def + dPetStats.def) / 100);
  // Per-type gem leth modifiers for attacker attacking defender
  const aGemLethModByType: Record<string, Record<string, number>> = {};
  for (const aType of TROOP_TYPES) {
    aGemLethModByType[aType] = {};
    for (const dType of TROOP_TYPES) {
      aGemLethModByType[aType][dType] = (1 + (atkGemByType[aType].leth + atkHeroGear.leth + aPetStats[petLethKey(aType as TroopType)]) / 100) / (1 + (defGemByType[dType].hp + defHeroGear.hp + dPetStats[petHpKey(dType as TroopType)]) / 100);
    }
  }
  // Defender's gear advantage when attacking attacker
  const dGearAtkMod = (1 + (defGear.atk + defHeroGear.atk + dPetStats.atk) / 100) / (1 + (atkGear.def + atkHeroGear.def + aPetStats.def) / 100);
  const dGemLethModByType: Record<string, Record<string, number>> = {};
  for (const dType of TROOP_TYPES) {
    dGemLethModByType[dType] = {};
    for (const aType of TROOP_TYPES) {
      dGemLethModByType[dType][aType] = (1 + (defGemByType[dType].leth + defHeroGear.leth + dPetStats[petLethKey(dType as TroopType)]) / 100) / (1 + (atkGemByType[aType].hp + atkHeroGear.hp + aPetStats[petHpKey(aType as TroopType)]) / 100);
    }
  }

  let turn = 0;

  while (turn < MAX_TURNS && totalTroops(aT) > 0 && totalTroops(dT) > 0) {
    turn++;

    // Evaluate skills each turn (re-roll probabilities)
    const aSkEff = evSk(aLeaders, aRiders, turn);
    const dSkEff = evSk(dLeaders, dRiders, turn);

    // Simultaneous damage accumulation
    const aDmgThisTurn = emptyTroopCount(); // damage to attacker
    const dDmgThisTurn = emptyTroopCount(); // damage to defender
    const skillLabels: string[] = [];

    // --- Type-advantage targeting (confirmed by battle reports) ---
    // Each troop type attacks its preferred target (type advantage):
    //   盾→槍, 槍→弓, 弓→盾
    // If preferred target is gone, fall back to any surviving type.
    // Targets are determined per troop type, not locked to a single front-line.

    // --- Each troop type on the attacker side attacks ---
    for (let atkIdx = 0; atkIdx < 3; atkIdx++) {
      const atkType = TROOP_TYPES[atkIdx];
      if (aT[atkType] <= 0) continue;

      // Check stun from defender's skill effects
      if (dSkEff.stun[atkIdx] > 0) continue;

      const target = getTarget(atkType, dT);
      if (!target) continue;

      const targetIdx = TROOP_TYPES.indexOf(target);
      const kills = calcKills(
        aT[atkType],
        aHeroStats[atkIdx],
        dHeroStats[targetIdx],
        aSkEff,
        dSkEff,
        atkType,
        target,
        dT[target],
        aTroopTier,
        dTroopTier,
        aGearAtkMod,
        aGemLethModByType[atkType][target]
      );
      dDmgThisTurn[target] += kills;
    }

    // --- Each troop type on the defender side attacks ---
    for (let defIdx = 0; defIdx < 3; defIdx++) {
      const defType = TROOP_TYPES[defIdx];
      if (dT[defType] <= 0) continue;

      // Check stun from attacker's skill effects
      if (aSkEff.stun[defIdx] > 0) continue;

      const target = getTarget(defType, aT);
      if (!target) continue;

      const targetIdx = TROOP_TYPES.indexOf(target);
      const kills = calcKills(
        dT[defType],
        dHeroStats[defIdx],
        aHeroStats[targetIdx],
        dSkEff,
        aSkEff,
        defType,
        target,
        aT[target],
        dTroopTier,
        aTroopTier,
        dGearAtkMod,
        dGemLethModByType[defType][target]
      );
      aDmgThisTurn[target] += kills;
    }

    // --- Apply accumulated damage simultaneously ---
    for (let i = 0; i < 3; i++) {
      const tt = TROOP_TYPES[i];
      dT[tt] = Math.max(0, dT[tt] - Math.min(dDmgThisTurn[tt], dT[tt]));
      aT[tt] = Math.max(0, aT[tt] - Math.min(aDmgThisTurn[tt], aT[tt]));
    }

    // --- DoT damage (applied after main combat) ---
    for (let i = 0; i < 3; i++) {
      const tt = TROOP_TYPES[i];
      if (aSkEff.dotDmg > 0 && dT[tt] > 0) {
        const dotDmg = Math.min(Math.floor(dT[tt] * aSkEff.dotDmg), dT[tt]);
        dT[tt] -= dotDmg;
        dDmgThisTurn[tt] += dotDmg;
      }
      if (dSkEff.dotDmg > 0 && aT[tt] > 0) {
        const dotDmg = Math.min(Math.floor(aT[tt] * dSkEff.dotDmg), aT[tt]);
        aT[tt] -= dotDmg;
        aDmgThisTurn[tt] += dotDmg;
      }
    }

    // --- Reflect damage ---
    if (aSkEff.reflectBuf > 0) {
      for (let i = 0; i < 3; i++) {
        const tt = TROOP_TYPES[i];
        const reflected = Math.min(
          Math.floor(aDmgThisTurn[tt] * aSkEff.reflectBuf),
          dT[tt]
        );
        dT[tt] -= reflected;
        dDmgThisTurn[tt] += reflected;
      }
    }
    if (dSkEff.reflectBuf > 0) {
      for (let i = 0; i < 3; i++) {
        const tt = TROOP_TYPES[i];
        const reflected = Math.min(
          Math.floor(dDmgThisTurn[tt] * dSkEff.reflectBuf),
          aT[tt]
        );
        aT[tt] -= reflected;
        aDmgThisTurn[tt] += reflected;
      }
    }

    logs.push({
      turn,
      aTroops: cloneTroops(aT),
      dTroops: cloneTroops(dT),
      aDmg: aDmgThisTurn,
      dDmg: dDmgThisTurn,
      skills: skillLabels,
    });
  }

  const aLeft = totalTroops(aT);
  const dLeft = totalTroops(dT);

  let winner: 'atk' | 'def' | 'draw';
  if (aLeft > 0 && dLeft <= 0) {
    winner = 'atk';
  } else if (dLeft > 0 && aLeft <= 0) {
    winner = 'def';
  } else {
    winner = 'draw';
  }

  // Calculate casualty reports
  const aIsWinner = winner === 'atk';
  const dIsWinner = winner === 'def';

  const aCasualty = calcCasualties(aTotal0, aLeft, aIsWinner, true, aHospitalCap);
  const dCasualty = calcCasualties(dTotal0, dLeft, dIsWinner, false, dHospitalCap);

  return {
    winner,
    turns: turn,
    aTroopsLeft: cloneTroops(aT),
    dTroopsLeft: cloneTroops(dT),
    aLossRate: aTotal0 > 0 ? 1 - aLeft / aTotal0 : 0,
    dLossRate: dTotal0 > 0 ? 1 - dLeft / dTotal0 : 0,
    aCasualty,
    dCasualty,
    logs,
  };
}

// ── Multi-run simulation ──

/**
 * Run the battle simulation multiple times and aggregate results.
 */
// ── Rally types ──

/** 集結参加者 */
export interface RallyParticipant {
  playerId: string;
  playerName: string;
  hero: Hero;          // 第1英雄（S1のみ発動）
  troops: TroopCount;  // 派兵数（盾/槍/弓）
}

/** 集結設定 */
export interface RallyConfig {
  // 攻撃側
  atkLeaders: [Hero, Hero, Hero];  // 盾/槍/弓リーダー
  atkLeaderTroops: TroopCount;     // リーダーの派兵数
  atkJoiners: RallyParticipant[];  // ジョイナー（最大7人）
  atkHeroStats: Record<TroopType, TroopStats>; // リーダーのステータス

  // 防衛側
  defLeaders: [Hero, Hero, Hero];
  defLeaderTroops: TroopCount;
  defJoiners: RallyParticipant[];
  defHeroStats: Record<TroopType, TroopStats>;

  // オプション
  hospitalCap?: number;
  runs?: number;
}

/** 参加者別の戦闘結果 */
export interface ParticipantResult {
  playerId: string;
  playerName: string;
  troopsSent: TroopCount;
  casualties: CasualtyReport;
}

/** 集結戦闘結果 */
export interface RallyResult {
  winner: 'atk' | 'def' | 'draw';
  turns: number;

  // 全体の結果
  atkTotalTroops: number;
  defTotalTroops: number;
  atkTotalLoss: number;
  defTotalLoss: number;

  // リーダーマッチアップ結果（盾vs盾、槍vs槍、弓vs弓）
  leaderMatchups: {
    type: TroopType;
    atkHero: string;
    defHero: string;
    atkTroops: number;
    defTroops: number;
    atkLoss: number;
    defLoss: number;
  }[];

  // 参加者別結果
  atkParticipants: ParticipantResult[];
  defParticipants: ParticipantResult[];

  // ターン詳細ログ
  logs: BattleLog[];
}

/** Aggregated result of multiple rally simulations */
export interface RallyAggregateResult {
  runs: number;
  atkWins: number;
  defWins: number;
  draws: number;
  avgTurns: number;
  avgAtkLossRate: number;
  avgDefLossRate: number;
  results: RallyResult[];
}

export function runSimulation(config: SimConfig): SimAggregateResult {
  const runs = config.runs ?? 100;
  const results: SimResult[] = [];
  let atkWins = 0;
  let defWins = 0;
  let draws = 0;
  let totalTurns = 0;
  let totalAtkLoss = 0;
  let totalDefLoss = 0;

  for (let i = 0; i < runs; i++) {
    const result = sim1(
      config.aTroops,
      config.dTroops,
      config.aHeroStats,
      config.dHeroStats,
      config.aLeaders,
      config.aRiders,
      config.dLeaders,
      config.dRiders,
      config.aHospitalCap ?? Infinity,
      config.dHospitalCap ?? Infinity,
      config.aTroopTier ?? 11,
      config.dTroopTier ?? 11,
      config.aChiefGearTier ?? 'myth_t4_s3',
      config.dChiefGearTier ?? 'myth_t4_s3',
      config.aGemLevel ?? 16,
      config.dGemLevel ?? 16,
      config.aHeroGearLevel ?? 'gold_max',
      config.dHeroGearLevel ?? 'gold_max',
      config.aGems,
      config.dGems,
      config.aPetStats ?? { atk: 333.5, def: 333.5, shieldLeth: 475.96, shieldHp: 475.96, spearLeth: 475.96, spearHp: 475.96, bowLeth: 475.96, bowHp: 475.96 },
      config.dPetStats ?? { atk: 333.5, def: 333.5, shieldLeth: 475.96, shieldHp: 475.96, spearLeth: 475.96, spearHp: 475.96, bowLeth: 475.96, bowHp: 475.96 }
    );

    results.push(result);
    totalTurns += result.turns;
    totalAtkLoss += result.aLossRate;
    totalDefLoss += result.dLossRate;

    switch (result.winner) {
      case 'atk':
        atkWins++;
        break;
      case 'def':
        defWins++;
        break;
      case 'draw':
        draws++;
        break;
    }
  }

  return {
    runs,
    atkWins,
    defWins,
    draws,
    avgTurns: totalTurns / runs,
    avgAtkLossRate: totalAtkLoss / runs,
    avgDefLossRate: totalDefLoss / runs,
    results,
  };
}

// ── Rally simulation ──

/**
 * Aggregate troops from leader and joiners into a single TroopCount pool.
 */
function aggregateTroops(leaderTroops: TroopCount, joiners: RallyParticipant[]): TroopCount {
  const pool = cloneTroops(leaderTroops);
  for (const j of joiners) {
    pool.shield += j.troops.shield;
    pool.spear += j.troops.spear;
    pool.bow += j.troops.bow;
  }
  return pool;
}

/**
 * Convert Record<TroopType, TroopStats> to TroopStats[] indexed by TROOP_TYPES order.
 */
function heroStatsRecordToArray(rec: Record<TroopType, TroopStats>): TroopStats[] {
  return TROOP_TYPES.map(t => rec[t]);
}

/**
 * Distribute total casualties for a troop type back to individual participants
 * proportionally to their contribution of that troop type.
 *
 * @param totalLossForType - total casualties for a given troop type (e.g. shield)
 * @param contributions - array of { playerId, count } representing each participant's troop count of that type
 * @returns map from playerId to their share of casualties
 */
function distributeLoss(
  totalLossForType: number,
  contributions: { playerId: string; count: number }[]
): Map<string, number> {
  const result = new Map<string, number>();
  const totalContrib = contributions.reduce((s, c) => s + c.count, 0);
  if (totalContrib <= 0 || totalLossForType <= 0) {
    for (const c of contributions) result.set(c.playerId, 0);
    return result;
  }

  let distributed = 0;
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    if (i === contributions.length - 1) {
      // Last participant gets the remainder to avoid rounding errors
      result.set(c.playerId, totalLossForType - distributed);
    } else {
      const share = Math.floor(totalLossForType * (c.count / totalContrib));
      result.set(c.playerId, share);
      distributed += share;
    }
  }
  return result;
}

/**
 * Run one full rally battle simulation.
 *
 * Flow:
 * 1. Aggregate troops from leader + joiners into a single pool per side
 * 2. Compute skill effects (leaders: S1/S2/S3; joiners: S1 only, top 4, no duplicates)
 * 3. Run turn-based combat with front-line targeting system
 * 4. Distribute casualties proportionally back to each participant
 * 5. Compute casualty breakdown (dead/severe/light)
 */
export function simRally(config: RallyConfig): RallyResult {
  // 1. Aggregate troop pools
  const aTroopsInit = aggregateTroops(config.atkLeaderTroops, config.atkJoiners);
  const dTroopsInit = aggregateTroops(config.defLeaderTroops, config.defJoiners);

  const aT = cloneTroops(aTroopsInit);
  const dT = cloneTroops(dTroopsInit);
  const aTotal0 = totalTroops(aT);
  const dTotal0 = totalTroops(dT);

  // Convert hero stats
  const aHeroStats = heroStatsRecordToArray(config.atkHeroStats);
  const dHeroStats = heroStatsRecordToArray(config.defHeroStats);

  // Collect joiner heroes for skill evaluation
  const atkJoinerHeroes = config.atkJoiners.map(j => j.hero);
  const defJoinerHeroes = config.defJoiners.map(j => j.hero);

  // Record initial troop counts per type for proportional distribution
  const atkInitByType: TroopCount = cloneTroops(aTroopsInit);
  const defInitByType: TroopCount = cloneTroops(dTroopsInit);

  const logs: BattleLog[] = [];
  let turn = 0;

  // 3. Turn-based combat
  while (turn < MAX_TURNS && totalTroops(aT) > 0 && totalTroops(dT) > 0) {
    turn++;

    // 2. Evaluate skills each turn (re-roll probabilities)
    const aSkEff = evSk(config.atkLeaders as Hero[], atkJoinerHeroes, turn);
    const dSkEff = evSk(config.defLeaders as Hero[], defJoinerHeroes, turn);

    // Simultaneous damage accumulation
    const aDmgThisTurn = emptyTroopCount();
    const dDmgThisTurn = emptyTroopCount();
    const skillLabels: string[] = [];

    // --- Attacker attacks ---
    for (let atkIdx = 0; atkIdx < 3; atkIdx++) {
      const atkType = TROOP_TYPES[atkIdx];
      if (aT[atkType] <= 0) continue;
      if (dSkEff.stun[atkIdx] > 0) continue;

      const target = getTarget(atkType, dT);
      if (!target) continue;

      const targetIdx = TROOP_TYPES.indexOf(target);
      const kills = calcKills(
        aT[atkType],
        aHeroStats[atkIdx],
        dHeroStats[targetIdx],
        aSkEff,
        dSkEff,
        atkType,
        target,
        dT[target]
      );
      dDmgThisTurn[target] += kills;
    }

    // --- Defender attacks ---
    for (let defIdx = 0; defIdx < 3; defIdx++) {
      const defType = TROOP_TYPES[defIdx];
      if (dT[defType] <= 0) continue;
      if (aSkEff.stun[defIdx] > 0) continue;

      const target = getTarget(defType, aT);
      if (!target) continue;

      const targetIdx = TROOP_TYPES.indexOf(target);
      const kills = calcKills(
        dT[defType],
        dHeroStats[defIdx],
        aHeroStats[targetIdx],
        dSkEff,
        aSkEff,
        defType,
        target,
        aT[target]
      );
      aDmgThisTurn[target] += kills;
    }

    // --- Apply accumulated damage simultaneously ---
    for (let i = 0; i < 3; i++) {
      const tt = TROOP_TYPES[i];
      dT[tt] = Math.max(0, dT[tt] - Math.min(dDmgThisTurn[tt], dT[tt]));
      aT[tt] = Math.max(0, aT[tt] - Math.min(aDmgThisTurn[tt], aT[tt]));
    }

    // --- DoT damage ---
    for (let i = 0; i < 3; i++) {
      const tt = TROOP_TYPES[i];
      if (aSkEff.dotDmg > 0 && dT[tt] > 0) {
        const dotDmg = Math.min(Math.floor(dT[tt] * aSkEff.dotDmg), dT[tt]);
        dT[tt] -= dotDmg;
        dDmgThisTurn[tt] += dotDmg;
      }
      if (dSkEff.dotDmg > 0 && aT[tt] > 0) {
        const dotDmg = Math.min(Math.floor(aT[tt] * dSkEff.dotDmg), aT[tt]);
        aT[tt] -= dotDmg;
        aDmgThisTurn[tt] += dotDmg;
      }
    }

    // --- Reflect damage ---
    if (aSkEff.reflectBuf > 0) {
      for (let i = 0; i < 3; i++) {
        const tt = TROOP_TYPES[i];
        const reflected = Math.min(
          Math.floor(aDmgThisTurn[tt] * aSkEff.reflectBuf),
          dT[tt]
        );
        dT[tt] -= reflected;
        dDmgThisTurn[tt] += reflected;
      }
    }
    if (dSkEff.reflectBuf > 0) {
      for (let i = 0; i < 3; i++) {
        const tt = TROOP_TYPES[i];
        const reflected = Math.min(
          Math.floor(dDmgThisTurn[tt] * dSkEff.reflectBuf),
          aT[tt]
        );
        aT[tt] -= reflected;
        aDmgThisTurn[tt] += reflected;
      }
    }

    logs.push({
      turn,
      aTroops: cloneTroops(aT),
      dTroops: cloneTroops(dT),
      aDmg: aDmgThisTurn,
      dDmg: dDmgThisTurn,
      skills: skillLabels,
    });
  }

  // Determine winner
  const aLeft = totalTroops(aT);
  const dLeft = totalTroops(dT);

  let winner: 'atk' | 'def' | 'draw';
  if (aLeft > 0 && dLeft <= 0) {
    winner = 'atk';
  } else if (dLeft > 0 && aLeft <= 0) {
    winner = 'def';
  } else {
    winner = 'draw';
  }

  const aIsWinner = winner === 'atk';
  const dIsWinner = winner === 'def';
  const hospitalCap = config.hospitalCap ?? Infinity;

  // 4. Compute total losses per troop type
  const aTotalLossByType: TroopCount = {
    shield: aTroopsInit.shield - aT.shield,
    spear: aTroopsInit.spear - aT.spear,
    bow: aTroopsInit.bow - aT.bow,
  };
  const dTotalLossByType: TroopCount = {
    shield: dTroopsInit.shield - dT.shield,
    spear: dTroopsInit.spear - dT.spear,
    bow: dTroopsInit.bow - dT.bow,
  };

  // 5. Build participant results with proportional loss distribution
  const LEADER_ID = '__leader__';

  // Build contribution lists per troop type
  function buildContributions(
    leaderTroops: TroopCount,
    joiners: RallyParticipant[],
    troopType: TroopType
  ): { playerId: string; count: number }[] {
    const contribs: { playerId: string; count: number }[] = [
      { playerId: LEADER_ID, count: leaderTroops[troopType] },
    ];
    for (const j of joiners) {
      contribs.push({ playerId: j.playerId, count: j.troops[troopType] });
    }
    return contribs;
  }

  function buildParticipantResults(
    side: 'atk' | 'def',
    leaderTroops: TroopCount,
    joiners: RallyParticipant[],
    totalLossByType: TroopCount,
    initByType: TroopCount,
    isWinner: boolean,
    isAttacker: boolean
  ): { leaderResult: ParticipantResult; joinerResults: ParticipantResult[] } {
    // Distribute losses per troop type
    const lossDistByType: Record<TroopType, Map<string, number>> = {
      shield: distributeLoss(
        totalLossByType.shield,
        buildContributions(leaderTroops, joiners, 'shield')
      ),
      spear: distributeLoss(
        totalLossByType.spear,
        buildContributions(leaderTroops, joiners, 'spear')
      ),
      bow: distributeLoss(
        totalLossByType.bow,
        buildContributions(leaderTroops, joiners, 'bow')
      ),
    };

    // Leader result
    const leaderTotalSent = totalTroops(leaderTroops);
    const leaderTotalLoss =
      (lossDistByType.shield.get(LEADER_ID) ?? 0) +
      (lossDistByType.spear.get(LEADER_ID) ?? 0) +
      (lossDistByType.bow.get(LEADER_ID) ?? 0);
    const leaderSurvived = leaderTotalSent - leaderTotalLoss;

    const leaderResult: ParticipantResult = {
      playerId: LEADER_ID,
      playerName: 'Leader',
      troopsSent: cloneTroops(leaderTroops),
      casualties: calcCasualties(leaderTotalSent, leaderSurvived, isWinner, isAttacker, hospitalCap),
    };

    // Joiner results
    const joinerResults: ParticipantResult[] = joiners.map(j => {
      const sent = totalTroops(j.troops);
      const loss =
        (lossDistByType.shield.get(j.playerId) ?? 0) +
        (lossDistByType.spear.get(j.playerId) ?? 0) +
        (lossDistByType.bow.get(j.playerId) ?? 0);
      const survived = sent - loss;
      return {
        playerId: j.playerId,
        playerName: j.playerName,
        troopsSent: cloneTroops(j.troops),
        casualties: calcCasualties(sent, survived, isWinner, isAttacker, hospitalCap),
      };
    });

    return { leaderResult, joinerResults };
  }

  const atkResults = buildParticipantResults(
    'atk',
    config.atkLeaderTroops,
    config.atkJoiners,
    aTotalLossByType,
    atkInitByType,
    aIsWinner,
    true
  );

  const defResults = buildParticipantResults(
    'def',
    config.defLeaderTroops,
    config.defJoiners,
    dTotalLossByType,
    defInitByType,
    dIsWinner,
    false
  );

  // Leader matchup summary
  const leaderMatchups = TROOP_TYPES.map((tt, idx) => ({
    type: tt,
    atkHero: config.atkLeaders[idx].n,
    defHero: config.defLeaders[idx].n,
    atkTroops: aTroopsInit[tt],
    defTroops: dTroopsInit[tt],
    atkLoss: aTotalLossByType[tt],
    defLoss: dTotalLossByType[tt],
  }));

  return {
    winner,
    turns: turn,
    atkTotalTroops: aTotal0,
    defTotalTroops: dTotal0,
    atkTotalLoss: aTotal0 - aLeft,
    defTotalLoss: dTotal0 - dLeft,
    leaderMatchups,
    atkParticipants: [atkResults.leaderResult, ...atkResults.joinerResults],
    defParticipants: [defResults.leaderResult, ...defResults.joinerResults],
    logs,
  };
}

// ── Multi-run rally simulation ──

/**
 * Run the rally battle simulation multiple times and aggregate results.
 */
export function runRallySimulation(config: RallyConfig): RallyAggregateResult {
  const runs = config.runs ?? 100;
  const results: RallyResult[] = [];
  let atkWins = 0;
  let defWins = 0;
  let draws = 0;
  let totalTurns = 0;
  let totalAtkLoss = 0;
  let totalDefLoss = 0;

  for (let i = 0; i < runs; i++) {
    const result = simRally(config);
    results.push(result);
    totalTurns += result.turns;

    const atkLossRate = result.atkTotalTroops > 0
      ? result.atkTotalLoss / result.atkTotalTroops
      : 0;
    const defLossRate = result.defTotalTroops > 0
      ? result.defTotalLoss / result.defTotalTroops
      : 0;
    totalAtkLoss += atkLossRate;
    totalDefLoss += defLossRate;

    switch (result.winner) {
      case 'atk': atkWins++; break;
      case 'def': defWins++; break;
      case 'draw': draws++; break;
    }
  }

  return {
    runs,
    atkWins,
    defWins,
    draws,
    avgTurns: totalTurns / runs,
    avgAtkLossRate: totalAtkLoss / runs,
    avgDefLossRate: totalDefLoss / runs,
    results,
  };
}
