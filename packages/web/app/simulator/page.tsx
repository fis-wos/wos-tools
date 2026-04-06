'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HEROES,
  type Hero,
  type TroopType,
  type Rarity,
  type GearSkill,
} from '@/lib/engine/heroes';
import { GS, EK, EH } from '@/lib/engine/constants';
import { TROOP_SKILLS, type TroopSkill, type TroopTier } from '@/lib/engine/troop-skills';
import {
  type TroopStats,
  type HeroConfig,
  calcHeroStats,
} from '@/lib/engine/hero-stats';
import {
  type SimResult,
  type SimAggregateResult,
  type TroopCount,
  runSimulation,
} from '@/lib/engine/battle-engine';
import {
  CHIEF_GEAR_TIERS,
  GEM_LEVELS,
  calcChiefGearStats,
  calcGemStats,
  calcGemsTotalByType,
} from '@/lib/engine/chief-gear';
import {
  HERO_GEAR_LEVELS,
  calcHeroGearStats,
} from '@/lib/engine/hero-gear';
import { supabase } from '@/lib/supabase';

// ── Constants ──

const TROOP_LABELS: Record<TroopType, string> = {
  shield: '盾',
  spear: '槍',
  bow: '弓',
};

const TROOP_COLORS: Record<TroopType, string> = {
  shield: 'border-shield-blue bg-shield-blue/10',
  spear: 'border-spear-orange bg-spear-orange/10',
  bow: 'border-bow-green bg-bow-green/10',
};

const TROOP_TEXT_COLORS: Record<TroopType, string> = {
  shield: 'text-shield-blue',
  spear: 'text-spear-orange',
  bow: 'text-bow-green',
};

const TROOP_BG_COLORS: Record<TroopType, string> = {
  shield: 'bg-shield-blue/20',
  spear: 'bg-spear-orange/20',
  bow: 'bg-bow-green/20',
};

type Side = 'atk' | 'def';
type RarityFilter = 'all' | 'SSR' | 'SR';

const RATIO_KEYS = ['shieldRatio', 'spearRatio', 'bowRatio'] as const;
type RatioKey = (typeof RATIO_KEYS)[number];

const TROOP_TIERS: { label: string; value: TroopTier }[] = [
  { label: 'T9', value: 9 },
  { label: 'T10', value: 10 },
  { label: 'T11', value: 11 },
];

const TROOP_EMOJI: Record<TroopType, string> = {
  shield: '\u{1F6E1}',
  spear: '\u{1F531}',
  bow: '\u{1F3F9}',
};

const EFF_LABELS: Record<string, string> = {
  atk: 'ATK',
  def: 'DEF',
  leth: '\u6bba\u50b7\u529b',
  hp: 'HP',
};

/** 追加ステータス（バトルレポートの値を直接入力） */
interface ExtraStats {
  shieldATK: number; shieldDEF: number; shieldLeth: number; shieldHP: number;
  spearATK: number; spearDEF: number; spearLeth: number; spearHP: number;
  bowATK: number; bowDEF: number; bowLeth: number; bowHP: number;
}

interface SideFormation {
  leaders: (Hero | null)[]; // [shield, spear, bow]
  riders: Hero[];
  totalTroops: number;
  shieldRatio: number;
  spearRatio: number;
  bowRatio: number;
  troopTier: TroopTier;
  chiefGearTier: string;
  gemLevel: number;
  gems: number[][]; // 6 gear pieces x 3 gem slots [shieldLv, spearLv, bowLv]
  heroGearLevel: string;
  petAtk: number;         // 部隊攻撃力
  petDef: number;         // 部隊防御力
  petShieldLeth: number;  // 盾兵殺傷力
  petShieldHp: number;    // 盾兵HP
  petSpearLeth: number;   // 槍兵殺傷力
  petSpearHp: number;     // 槍兵HP
  petBowLeth: number;     // 弓兵殺傷力
  petBowHp: number;       // 弓兵HP
  extraStats: ExtraStats;
  extraStatsEnabled: boolean;
}

const RATIO_PRESETS: { label: string; shield: number; spear: number; bow: number }[] = [
  { label: '5:0:5', shield: 5, spear: 0, bow: 5 },
  { label: '5:2:3', shield: 5, spear: 2, bow: 3 },
  { label: '6:4:0', shield: 6, spear: 4, bow: 0 },
  { label: '3:4:3', shield: 3, spear: 4, bow: 3 },
  { label: '均等', shield: 1, spear: 1, bow: 1 },
];

const DEFAULT_EXTRA_STATS: ExtraStats = {
  shieldATK: 0, shieldDEF: 0, shieldLeth: 0, shieldHP: 0,
  spearATK: 0, spearDEF: 0, spearLeth: 0, spearHP: 0,
  bowATK: 0, bowDEF: 0, bowLeth: 0, bowHP: 0,
};

const DEFAULT_PET = {
  atk: 333.5, def: 333.5,
  shieldLeth: 475.96, shieldHp: 475.96,
  spearLeth: 475.96, spearHp: 475.96,
  bowLeth: 475.96, bowHp: 475.96,
};

function emptyFormation(): SideFormation {
  return {
    leaders: [null, null, null],
    riders: [],
    totalTroops: 1800000,
    chiefGearTier: 'myth_t4_s3',
    gemLevel: 16,
    gems: Array.from({ length: 6 }, () => [16, 16, 16]),
    heroGearLevel: 'gold_max',
    petAtk: DEFAULT_PET.atk,
    petDef: DEFAULT_PET.def,
    petShieldLeth: DEFAULT_PET.shieldLeth,
    petShieldHp: DEFAULT_PET.shieldHp,
    petSpearLeth: DEFAULT_PET.spearLeth,
    petSpearHp: DEFAULT_PET.spearHp,
    petBowLeth: DEFAULT_PET.bowLeth,
    petBowHp: DEFAULT_PET.bowHp,
    shieldRatio: 5,
    spearRatio: 0,
    bowRatio: 5,
    troopTier: 11 as TroopTier,
    extraStats: { ...DEFAULT_EXTRA_STATS },
    extraStatsEnabled: false,
  };
}

function defaultHeroConfig(): HeroConfig {
  return {
    heroLv: 80,
    gearLv: 30,
    refine: { goggle: 5, glove: 5, belt: 5, boots: 5 },
    charm: { goggle: 10, glove: 10, belt: 10, boots: 10 },
  };
}

function formationToTroopCount(f: SideFormation): TroopCount {
  const total = f.totalTroops;
  const ratioSum = f.shieldRatio + f.spearRatio + f.bowRatio;
  if (ratioSum === 0) return { shield: 0, spear: 0, bow: 0 };
  return {
    shield: Math.round((total * f.shieldRatio) / ratioSum),
    spear: Math.round((total * f.spearRatio) / ratioSum),
    bow: Math.round((total * f.bowRatio) / ratioSum),
  };
}

function formationToHeroStats(f: SideFormation, isAtk: boolean): TroopStats[] {
  // 手動入力モードでも英雄ステータスは計算する（デバッグ表示用）
  // 実際のバトル計算ではextraStatsが優先される
  const config = defaultHeroConfig();
  const leaderEntries = f.leaders
    .filter((h): h is Hero => h !== null)
    .map((hero) => ({ hero, config }));
  if (leaderEntries.length === 0) {
    return [
      { atk: 500, def: 500, leth: 100, hp: 100 },
      { atk: 500, def: 500, leth: 100, hp: 100 },
      { atk: 500, def: 500, leth: 100, hp: 100 },
    ];
  }
  return calcHeroStats(leaderEntries, isAtk);
}

/** Convert ExtraStats to the SimConfig format */
function extraStatsToSimFormat(es: ExtraStats): {
  shield: { atk: number; def: number; leth: number; hp: number };
  spear: { atk: number; def: number; leth: number; hp: number };
  bow: { atk: number; def: number; leth: number; hp: number };
} {
  return {
    shield: { atk: es.shieldATK, def: es.shieldDEF, leth: es.shieldLeth, hp: es.shieldHP },
    spear: { atk: es.spearATK, def: es.spearDEF, leth: es.spearLeth, hp: es.spearHP },
    bow: { atk: es.bowATK, def: es.bowDEF, leth: es.bowLeth, hp: es.bowHP },
  };
}

/** Compute normalized percentage for display */
function normalizeRatio(f: SideFormation): { shield: number; spear: number; bow: number } {
  const sum = f.shieldRatio + f.spearRatio + f.bowRatio;
  if (sum === 0) return { shield: 0, spear: 0, bow: 0 };
  return {
    shield: Math.round((f.shieldRatio / sum) * 100),
    spear: Math.round((f.spearRatio / sum) * 100),
    bow: Math.round((f.bowRatio / sum) * 100),
  };
}

// ── Hero Image with Fallback ──

function HeroAvatar({
  hero,
  size = 'md',
}: {
  hero: Hero;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-12 w-12 sm:h-14 sm:w-14';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const borderClass = hero.r === 'SR' ? 'border-purple-400/60' : 'border-gold/40';
  return (
    <span className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.img}
        alt={hero.n}
        className={`${dim} rounded-full object-cover border-2 ${borderClass}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = 'flex';
        }}
      />
      <div
        style={{ display: 'none' }}
        className={`${dim} rounded-full flex items-center justify-center ${TROOP_BG_COLORS[hero.t]}`}
      >
        <span className={`${textSize} font-bold ${TROOP_TEXT_COLORS[hero.t]}`}>
          {hero.n.slice(0, 2)}
        </span>
      </div>
    </span>
  );
}

// ── Hero Card ──

function HeroMiniCard({
  hero,
  selected,
  onClick,
}: {
  hero: Hero;
  selected: boolean;
  onClick: () => void;
}) {
  const glowClass = hero.r === 'SR' ? 'card-glow-sr' : 'card-glow-ssr';
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-lg border-2 p-1.5 transition-all duration-200 ${
        selected
          ? `${glowClass} sparkle-selected bg-gold/10`
          : `${TROOP_COLORS[hero.t]} ${glowClass} hover:border-gold-dark/50`
      }`}
    >
      <span className="absolute top-0.5 right-0.5 text-[9px] text-text-muted">
        {hero.r === 'SR' ? 'SR' : `G${hero.g}`}
      </span>
      <div className="my-0.5">
        <HeroAvatar hero={hero} />
      </div>
      <span className="mt-0.5 text-[10px] font-medium leading-tight text-text-primary">
        {hero.n}
      </span>
      <span className={`text-[9px] ${TROOP_TEXT_COLORS[hero.t]}`}>
        {TROOP_LABELS[hero.t]}
      </span>
    </button>
  );
}

// ── Leader Slot ──

function LeaderSlot({
  troopType,
  hero,
  onRemove,
}: {
  troopType: TroopType;
  hero: Hero | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-bold ${TROOP_TEXT_COLORS[troopType]}`}>
        {TROOP_LABELS[troopType]}リーダー
      </span>
      <div
        className={`leader-slot-gold flex h-16 w-16 items-center justify-center rounded-lg transition-all duration-200 ${
          hero
            ? 'has-hero cursor-pointer hover:scale-105'
            : 'border-dashed !border-wos-border !bg-wos-dark !shadow-none'
        }`}
        onClick={hero ? onRemove : undefined}
      >
        {hero ? (
          <HeroAvatar hero={hero} size="sm" />
        ) : (
          <span className="text-lg text-text-muted">+</span>
        )}
      </div>
      {hero && (
        <span className="max-w-[64px] truncate text-[10px] font-medium text-text-secondary">
          {hero.n}
        </span>
      )}
    </div>
  );
}

// ── Result Display ──

function ResultDisplay({
  result,
  atkLeaders,
  defLeaders,
  debugInfo,
  atkExtraStatsEnabled,
  defExtraStatsEnabled,
}: {
  result: SimAggregateResult;
  atkLeaders: (Hero | null)[];
  defLeaders: (Hero | null)[];
  debugInfo?: {
    atkHeroStats: TroopStats[];
    defHeroStats: TroopStats[];
    atkTroops: TroopCount;
    defTroops: TroopCount;
  } | null;
  atkExtraStatsEnabled?: boolean;
  defExtraStatsEnabled?: boolean;
}) {
  const latestRun = result.results[result.results.length - 1];
  const atkWinRate = ((result.atkWins / result.runs) * 100).toFixed(1);
  const defWinRate = ((result.defWins / result.runs) * 100).toFixed(1);
  const drawRate = ((result.draws / result.runs) * 100).toFixed(1);

  const atkHeroes = atkLeaders.filter((h): h is Hero => h !== null);
  const defHeroes = defLeaders.filter((h): h is Hero => h !== null);

  return (
    <div className="space-y-4">
      {/* バフ合計値（デバッグ情報） */}
      {debugInfo && (
        <details className="rounded-lg border border-wos-border bg-white/40 p-2">
          <summary className="cursor-pointer text-xs font-bold text-text-secondary">
            📊 参照バフ合計値（クリックで展開）
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded border border-atk-red/20 bg-atk-red/5 p-2">
              <div className="font-bold text-atk-red mb-1">攻撃側 {atkExtraStatsEnabled ? '(手動)' : ''}</div>
              {(['shield','spear','bow'] as const).map((tt, i) => {
                const emoji = tt === 'shield' ? '🛡' : tt === 'spear' ? '🔱' : '🏹';
                const label = tt === 'shield' ? '盾' : tt === 'spear' ? '槍' : '弓';
                const s = debugInfo.atkHeroStats[i];
                return s ? (
                  <div key={tt} className="flex gap-1 py-0.5 border-b border-wos-border/30 last:border-0">
                    <span className="w-5 shrink-0">{emoji}</span>
                    <span className="w-4 shrink-0 font-bold">{label}</span>
                    <span className="text-atk-red">A+{s.atk.toFixed(0)}</span>
                    <span className="text-def-blue">D+{s.def.toFixed(0)}</span>
                    <span className="text-bow-green">L+{s.leth.toFixed(0)}</span>
                    <span className="text-spear-orange">H+{s.hp.toFixed(0)}</span>
                  </div>
                ) : null;
              })}
              <div className="mt-1 pt-1 border-t border-wos-border text-text-muted">
                兵: 盾{debugInfo.atkTroops.shield.toLocaleString()} / 槍{debugInfo.atkTroops.spear.toLocaleString()} / 弓{debugInfo.atkTroops.bow.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-def-blue/20 bg-def-blue/5 p-2">
              <div className="font-bold text-def-blue mb-1">防御側 {defExtraStatsEnabled ? '(手動)' : ''}</div>
              {(['shield','spear','bow'] as const).map((tt, i) => {
                const emoji = tt === 'shield' ? '🛡' : tt === 'spear' ? '🔱' : '🏹';
                const label = tt === 'shield' ? '盾' : tt === 'spear' ? '槍' : '弓';
                const s = debugInfo.defHeroStats[i];
                return s ? (
                  <div key={tt} className="flex gap-1 py-0.5 border-b border-wos-border/30 last:border-0">
                    <span className="w-5 shrink-0">{emoji}</span>
                    <span className="w-4 shrink-0 font-bold">{label}</span>
                    <span className="text-atk-red">A+{s.atk.toFixed(0)}</span>
                    <span className="text-def-blue">D+{s.def.toFixed(0)}</span>
                    <span className="text-bow-green">L+{s.leth.toFixed(0)}</span>
                    <span className="text-spear-orange">H+{s.hp.toFixed(0)}</span>
                  </div>
                ) : null;
              })}
              <div className="mt-1 pt-1 border-t border-wos-border text-text-muted">
                兵: 盾{debugInfo.defTroops.shield.toLocaleString()} / 槍{debugInfo.defTroops.spear.toLocaleString()} / 弓{debugInfo.defTroops.bow.toLocaleString()}
              </div>
            </div>
          </div>
        </details>
      )}

      {/* VS Header with hero images */}
      <div className="flex items-center justify-center gap-4 py-3">
        <div className="flex -space-x-2">
          {atkHeroes.map((h) => (
            <span key={h.id} className="inline-block">
              <HeroAvatar hero={h} size="lg" />
            </span>
          ))}
          {atkHeroes.length === 0 && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-atk-red/10 text-xs text-atk-red">ATK</span>
          )}
        </div>
        <span className="vs-text text-3xl font-black">VS</span>
        <div className="flex -space-x-2">
          {defHeroes.map((h) => (
            <span key={h.id} className="inline-block">
              <HeroAvatar hero={h} size="lg" />
            </span>
          ))}
          {defHeroes.length === 0 && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-def-blue/10 text-xs text-def-blue">DEF</span>
          )}
        </div>
      </div>
      <div className="gold-divider" />

      {/* Win rates */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-atk-red/30 bg-atk-red/10 p-3 text-center">
          <div className="text-xs text-text-secondary">攻撃勝利</div>
          <div className="text-2xl font-bold text-atk-red">{atkWinRate}%</div>
          <div className="text-xs text-text-muted">{result.atkWins}/{result.runs}</div>
        </div>
        <div className="rounded-lg border border-wos-border bg-white/60 p-3 text-center">
          <div className="text-xs text-text-secondary">引き分け</div>
          <div className="text-2xl font-bold text-text-primary">{drawRate}%</div>
          <div className="text-xs text-text-muted">{result.draws}/{result.runs}</div>
        </div>
        <div className="rounded-lg border border-def-blue/30 bg-def-blue/10 p-3 text-center">
          <div className="text-xs text-text-secondary">防御勝利</div>
          <div className="text-2xl font-bold text-def-blue">{defWinRate}%</div>
          <div className="text-xs text-text-muted">{result.defWins}/{result.runs}</div>
        </div>
      </div>

      {/* Average stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-wos-border bg-white/60 p-3">
          <div className="mb-1 text-xs font-bold text-text-secondary">平均ターン数</div>
          <div className="text-lg font-bold text-gold-dark">{result.avgTurns.toFixed(1)}</div>
        </div>
        <div className="rounded-lg border border-wos-border bg-white/60 p-3">
          <div className="mb-1 text-xs font-bold text-text-secondary">平均損失率</div>
          <div className="flex gap-4">
            <div>
              <span className="text-[10px] text-atk-red">攻撃</span>
              <div className="text-sm font-bold text-atk-red">
                {(result.avgAtkLossRate * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-[10px] text-def-blue">防御</span>
              <div className="text-sm font-bold text-def-blue">
                {(result.avgDefLossRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latest run details */}
      {latestRun && (
        <div className="rounded-lg border border-wos-border bg-white/60 p-3">
          <div className="mb-2 text-xs font-bold text-text-secondary">最終実行詳細</div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="mb-1 font-bold text-atk-red">攻撃側残存</div>
              <div className="space-y-0.5 text-text-primary">
                <div>盾: {latestRun.aTroopsLeft.shield.toLocaleString()}</div>
                <div>槍: {latestRun.aTroopsLeft.spear.toLocaleString()}</div>
                <div>弓: {latestRun.aTroopsLeft.bow.toLocaleString()}</div>
              </div>
              <div className="mt-1 border-t border-wos-border pt-1">
                <div className="text-text-secondary">死亡: {latestRun.aCasualty.dead.toLocaleString()}</div>
                <div className="text-text-secondary">重傷: {latestRun.aCasualty.severeWound.toLocaleString()}</div>
                <div className="text-text-secondary">軽傷: {latestRun.aCasualty.lightWound.toLocaleString()}</div>
              </div>
            </div>
            <div>
              <div className="mb-1 font-bold text-def-blue">防御側残存</div>
              <div className="space-y-0.5 text-text-primary">
                <div>盾: {latestRun.dTroopsLeft.shield.toLocaleString()}</div>
                <div>槍: {latestRun.dTroopsLeft.spear.toLocaleString()}</div>
                <div>弓: {latestRun.dTroopsLeft.bow.toLocaleString()}</div>
              </div>
              <div className="mt-1 border-t border-wos-border pt-1">
                <div className="text-text-secondary">死亡: {latestRun.dCasualty.dead.toLocaleString()}</div>
                <div className="text-text-secondary">重傷: {latestRun.dCasualty.severeWound.toLocaleString()}</div>
                <div className="text-text-secondary">軽傷: {latestRun.dCasualty.lightWound.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-text-muted">
            {latestRun.turns}ターンで
            {latestRun.winner === 'atk' ? '攻撃勝利' : latestRun.winner === 'def' ? '防御勝利' : '引き分け'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grouped Hero Grid ──

function GroupedHeroGrid({
  heroes,
  isHeroSelected,
  onHeroClick,
}: {
  heroes: Hero[];
  isHeroSelected: (hero: Hero) => boolean;
  onHeroClick: (hero: Hero) => void;
}) {
  // Group by generation (SSR) and SR
  const groups = useMemo(() => {
    const genMap = new Map<string, Hero[]>();
    for (const h of heroes) {
      const key = h.r === 'SR' ? 'SR' : `G${h.g}`;
      const arr = genMap.get(key) ?? [];
      arr.push(h);
      genMap.set(key, arr);
    }
    // Sort: G12..G1 then SR
    const sorted: { label: string; heroes: Hero[] }[] = [];
    for (let g = 12; g >= 1; g--) {
      const key = `G${g}`;
      if (genMap.has(key)) sorted.push({ label: key, heroes: genMap.get(key)! });
    }
    if (genMap.has('SR')) sorted.push({ label: 'SR', heroes: genMap.get('SR')! });
    return sorted;
  }, [heroes]);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-1 text-xs font-bold text-text-muted">{group.label}</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {group.heroes.map((hero) => (
              <HeroMiniCard
                key={hero.id}
                hero={hero}
                selected={isHeroSelected(hero)}
                onClick={() => onHeroClick(hero)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gear & Gem Detail Modal ──

const GEM_LV_OPTIONS = Array.from({ length: 17 }, (_, i) => i); // 0-16
const GEAR_PIECE_LABELS = ['装備1', '装備2', '装備3', '装備4', '装備5', '装備6'];
const GEM_TYPE_HEADERS = [
  { label: '🛡盾', color: 'text-shield-blue' },
  { label: '🔱槍', color: 'text-spear-orange' },
  { label: '🏹弓', color: 'text-bow-green' },
];

function GearGemModal({
  formation,
  onApply,
  onClose,
}: {
  formation: SideFormation;
  onApply: (gearTier: string, gems: number[][]) => void;
  onClose: () => void;
}) {
  const [gearTier, setGearTier] = useState(formation.chiefGearTier);
  const [gems, setGems] = useState<number[][]>(
    formation.gems.map((row) => [...row])
  );

  const setAllGems = useCallback((lv: number) => {
    setGems(Array.from({ length: 6 }, () => [lv, lv, lv]));
  }, []);

  const updateGem = useCallback((pieceIdx: number, gemIdx: number, lv: number) => {
    setGems((prev) => {
      const next = prev.map((row) => [...row]);
      next[pieceIdx][gemIdx] = lv;
      return next;
    });
  }, []);

  const gemTotals = useMemo(() => calcGemsTotalByType(gems), [gems]);
  const gearStats = useMemo(() => calcChiefGearStats(gearTier), [gearTier]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-wos-card border border-wos-border rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl mx-4">
        <h2 className="text-base font-bold text-text-primary mb-4">
          領主装備・宝石 詳細設定
        </h2>

        {/* Gear Tier */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-text-muted">領主装備ティア</label>
          <select
            value={gearTier}
            onChange={(e) => setGearTier(e.target.value)}
            className="w-full rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-text-primary outline-none focus:border-sky-500/50"
          >
            {CHIEF_GEAR_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
          {gearStats.atk > 0 && (
            <div className="mt-1 text-[10px] text-text-muted">
              ATK+{gearStats.atk.toFixed(0)}% DEF+{gearStats.def.toFixed(0)}%
            </div>
          )}
        </div>

        {/* Gem Table */}
        <div className="mb-3">
          <label className="mb-2 block text-xs text-text-muted">宝石 (6部位 x 3個 = 18個)</label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-wos-border/50">
                  <th className="py-1 text-left text-text-muted font-normal w-16">部位</th>
                  {GEM_TYPE_HEADERS.map((h) => (
                    <th key={h.label} className={`py-1 text-center font-normal ${h.color}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gems.map((row, i) => (
                  <tr key={i} className="border-b border-wos-border/20">
                    <td className="py-1 text-text-muted">{GEAR_PIECE_LABELS[i]}</td>
                    {row.map((lv, j) => (
                      <td key={j} className="py-1 text-center">
                        <select
                          value={lv}
                          onChange={(e) => updateGem(i, j, Number(e.target.value))}
                          className="w-[62px] rounded border border-wos-border/50 bg-wos-dark px-1 py-0.5 text-[11px] text-text-primary outline-none focus:border-sky-500/50"
                        >
                          {GEM_LV_OPTIONS.map((l) => (
                            <option key={l} value={l}>Lv{l}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAllGems(16)} className="rounded-md bg-sky-600/20 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-600/30 transition-colors">全部MAX</button>
          <button type="button" onClick={() => setAllGems(10)} className="rounded-md bg-sky-600/20 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-600/30 transition-colors">全部Lv10</button>
          <button type="button" onClick={() => setAllGems(5)} className="rounded-md bg-sky-600/20 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-600/30 transition-colors">全部Lv5</button>
          <button type="button" onClick={() => setAllGems(0)} className="rounded-md bg-red-600/20 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-600/30 transition-colors">リセット</button>
        </div>

        {/* Totals */}
        <div className="mb-5 rounded-lg border border-wos-border/50 bg-wos-dark/50 p-3 space-y-3">
          <div className="text-[10px] text-text-muted mb-1">総合ステータス</div>

          {/* Chief Gear */}
          {gearStats.atk > 0 && (
            <div>
              <div className="text-[10px] text-text-muted mb-0.5">領主装備:</div>
              <div className="text-xs text-text-primary pl-2">
                ATK+{gearStats.atk.toFixed(0)}% DEF+{gearStats.def.toFixed(0)}%
              </div>
            </div>
          )}

          {/* Gem totals */}
          <div>
            <div className="text-[10px] text-text-muted mb-1">宝石合計:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-shield-blue font-medium">🛡盾</div>
                <div className="text-text-muted">殺傷 <span className="text-text-primary">+{gemTotals.shield.leth}%</span></div>
                <div className="text-text-muted">HP <span className="text-text-primary">+{gemTotals.shield.hp}%</span></div>
              </div>
              <div className="text-center">
                <div className="text-spear-orange font-medium">🔱槍</div>
                <div className="text-text-muted">殺傷 <span className="text-text-primary">+{gemTotals.spear.leth}%</span></div>
                <div className="text-text-muted">HP <span className="text-text-primary">+{gemTotals.spear.hp}%</span></div>
              </div>
              <div className="text-center">
                <div className="text-bow-green font-medium">🏹弓</div>
                <div className="text-text-muted">殺傷 <span className="text-text-primary">+{gemTotals.bow.leth}%</span></div>
                <div className="text-text-muted">HP <span className="text-text-primary">+{gemTotals.bow.hp}%</span></div>
              </div>
            </div>
          </div>

          {/* Combined totals */}
          <div>
            <div className="text-[10px] text-text-muted mb-1">装備+宝石 合計:</div>
            <div className="text-xs pl-2 mb-1 text-text-primary">
              ATK+{gearStats.atk.toFixed(0)}% DEF+{gearStats.def.toFixed(0)}%
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-shield-blue text-text-muted">盾殺 <span className="text-text-primary">+{gemTotals.shield.leth}%</span></div>
                <div className="text-shield-blue text-text-muted">盾HP <span className="text-text-primary">+{gemTotals.shield.hp}%</span></div>
              </div>
              <div className="text-center">
                <div className="text-spear-orange text-text-muted">槍殺 <span className="text-text-primary">+{gemTotals.spear.leth}%</span></div>
                <div className="text-spear-orange text-text-muted">槍HP <span className="text-text-primary">+{gemTotals.spear.hp}%</span></div>
              </div>
              <div className="text-center">
                <div className="text-bow-green text-text-muted">弓殺 <span className="text-text-primary">+{gemTotals.bow.leth}%</span></div>
                <div className="text-bow-green text-text-muted">弓HP <span className="text-text-primary">+{gemTotals.bow.hp}%</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onApply(gearTier, gems)}
            className="flex-1 rounded-lg bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors"
          >
            適用
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-wos-border bg-wos-dark py-2 text-sm text-text-muted hover:bg-wos-border/30 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function SimulatorPage() {
  const [activeSide, setActiveSide] = useState<Side>('atk');
  const [formations, setFormations] = useState<Record<Side, SideFormation>>({
    atk: emptyFormation(),
    def: emptyFormation(),
  });
  const [filterType, setFilterType] = useState<TroopType | 'all'>('all');
  const [filterRarity, setFilterRarity] = useState<RarityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'atk' | 'def' | 'atkDmg' | 'defBuf' | 'leth'>('default');
  const [simResult, setSimResult] = useState<SimAggregateResult | null>(null);
  const [simDebugInfo, setSimDebugInfo] = useState<{
    atkHeroStats: TroopStats[];
    defHeroStats: TroopStats[];
    atkTroops: TroopCount;
    defTroops: TroopCount;
  } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [gearGemModalSide, setGearGemModalSide] = useState<Side | null>(null);

  // おすすめ編成 state
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendProgress, setRecommendProgress] = useState<{ current: number; total: number } | null>(null);
  const [recommendations, setRecommendations] = useState<{
    shield: Hero;
    spear: Hero;
    bow: Hero;
    winRate: number;
    avgTurns: number;
    riders: Hero[];
  }[]>([]);

  // カウンターページからのプリセット読み込み
  useEffect(() => {
    try {
      const preset = localStorage.getItem('wos_sim_preset');
      if (!preset) return;
      localStorage.removeItem('wos_sim_preset'); // 一度読んだら消す
      const data = JSON.parse(preset);

      const loadSide = (sideData: Record<string, unknown>, side: 'atk' | 'def') => {
        const leaders = (sideData.leaders as (string | null)[]) || [];
        const riderIds = (sideData.riders as string[]) || [];
        const heroLeaders: (Hero | null)[] = [
          leaders[0] ? HEROES.find(h => h.id === leaders[0]) || null : null,
          leaders[1] ? HEROES.find(h => h.id === leaders[1]) || null : null,
          leaders[2] ? HEROES.find(h => h.id === leaders[2]) || null : null,
        ];
        const heroRiders = riderIds.map(id => HEROES.find(h => h.id === id)).filter(Boolean) as Hero[];
        setFormations(prev => ({
          ...prev,
          [side]: {
            ...prev[side],
            leaders: heroLeaders,
            riders: heroRiders,
            shieldRatio: (sideData.shieldRatio as number) || prev[side].shieldRatio,
            spearRatio: (sideData.spearRatio as number) || prev[side].spearRatio,
            bowRatio: (sideData.bowRatio as number) || prev[side].bowRatio,
            totalTroops: (sideData.totalTroops as number) || prev[side].totalTroops,
          },
        }));
      };

      if (data.atk) loadSide(data.atk, 'atk');
      if (data.def) loadSide(data.def, 'def');
    } catch (e) {
      console.error('Failed to load preset:', e);
    }
  }, []);

  const currentFormation = formations[activeSide];

  // スキルの合計値を計算するヘルパー
  const getSkillSum = useCallback((hero: Hero, field: string): number => {
    let sum = 0;
    for (const sk of [hero.s1, hero.s2, hero.s3]) {
      if (sk && field in sk) {
        const val = (sk as unknown as Record<string, unknown>)[field];
        if (typeof val === 'number') sum += val;
      }
    }
    return sum;
  }, []);

  const filteredHeroes = useMemo(() => {
    let list = HEROES;
    if (filterRarity !== 'all') {
      list = list.filter((h) => h.r === filterRarity);
    }
    if (filterType !== 'all') {
      list = list.filter((h) => h.t === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((h) => h.n.toLowerCase().includes(q) || h.id.toLowerCase().includes(q));
    }
    // ソート
    if (sortBy !== 'default') {
      list = [...list].sort((a, b) => {
        switch (sortBy) {
          case 'atk': return getSkillSum(b, 'atkBuf') + getSkillSum(b, 'atkDmgBuf') - getSkillSum(a, 'atkBuf') - getSkillSum(a, 'atkDmgBuf');
          case 'def': return getSkillSum(b, 'defBuf') + getSkillSum(b, 'hpBuf') - getSkillSum(a, 'defBuf') - getSkillSum(a, 'hpBuf');
          case 'atkDmg': return getSkillSum(b, 'atkDmgBuf') + getSkillSum(b, 'extraAtk') - getSkillSum(a, 'atkDmgBuf') - getSkillSum(a, 'extraAtk');
          case 'defBuf': return getSkillSum(b, 'defBuf') + getSkillSum(b, 'defStatBuf') - getSkillSum(a, 'defBuf') - getSkillSum(a, 'defStatBuf');
          case 'leth': return getSkillSum(b, 'lethBuf') - getSkillSum(a, 'lethBuf');
          default: return 0;
        }
      });
    }
    return list;
  }, [filterType, filterRarity, searchQuery, sortBy, getSkillSum]);

  // Check if hero is a leader on current side
  const isLeader = useCallback(
    (heroId: string) => {
      return currentFormation.leaders.some((h) => h?.id === heroId);
    },
    [currentFormation.leaders]
  );

  // Check if hero is selected (leader or rider) - for visual highlight
  const isHeroSelected = useCallback(
    (hero: Hero) => {
      return (
        currentFormation.leaders.some((h) => h?.id === hero.id) ||
        currentFormation.riders.some((h) => h.id === hero.id)
      );
    },
    [currentFormation.leaders, currentFormation.riders]
  );

  const handleHeroClick = useCallback(
    (hero: Hero) => {
      setFormations((prev) => {
        const f = { ...prev[activeSide] };
        const troopTypeIdx =
          hero.t === 'shield' ? 0 : hero.t === 'spear' ? 1 : 2;

        // SR heroes can only be riders
        if (hero.r === 'SR') {
          if (f.riders.length < 4) {
            return {
              ...prev,
              [activeSide]: { ...f, riders: [...f.riders, hero] },
            };
          }
          return prev;
        }

        // SSR: if leader slot for this troop type is empty, assign as leader
        if (f.leaders[troopTypeIdx] === null) {
          const newLeaders = [...f.leaders];
          newLeaders[troopTypeIdx] = hero;
          return { ...prev, [activeSide]: { ...f, leaders: newLeaders } };
        }

        // Leader slot is filled — always add as rider (max 4)
        // This allows the SAME hero as leader to also be a rider (different joiner)
        if (f.riders.length < 4) {
          return {
            ...prev,
            [activeSide]: { ...f, riders: [...f.riders, hero] },
          };
        }

        return prev;
      });
    },
    [activeSide]
  );

  const removeLeader = useCallback(
    (idx: number) => {
      setFormations((prev) => {
        const f = { ...prev[activeSide] };
        const newLeaders = [...f.leaders];
        newLeaders[idx] = null;
        return { ...prev, [activeSide]: { ...f, leaders: newLeaders } };
      });
    },
    [activeSide]
  );

  // Remove rider by index (supports duplicates)
  const removeRiderByIndex = useCallback(
    (riderIdx: number) => {
      setFormations((prev) => {
        const f = { ...prev[activeSide] };
        const newRiders = f.riders.filter((_, i) => i !== riderIdx);
        return {
          ...prev,
          [activeSide]: { ...f, riders: newRiders },
        };
      });
    },
    [activeSide]
  );

  // Update ratio directly (no lockTo100 needed)
  const updateRatio = useCallback(
    (key: RatioKey, value: number) => {
      const clamped = Math.max(0, Math.round(value));
      setFormations((prev) => ({
        ...prev,
        [activeSide]: { ...prev[activeSide], [key]: clamped },
      }));
    },
    [activeSide]
  );

  // Apply ratio preset
  const applyRatioPreset = useCallback(
    (preset: { shield: number; spear: number; bow: number }) => {
      setFormations((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          shieldRatio: preset.shield,
          spearRatio: preset.spear,
          bowRatio: preset.bow,
        },
      }));
    },
    [activeSide]
  );

  // ライダーおすすめ: リーダー以外のSSR英雄のS1スキルを評価してTop4
  const recommendRiders = useCallback((leaders: Hero[]): Hero[] => {
    const leaderIds = new Set(leaders.map(h => h.id));
    const candidates = HEROES.filter(h => !leaderIds.has(h.id) && h.s1);

    const scored = candidates.map(h => {
      const s = h.s1!;
      let score = 0;
      score += (s.atkDmgBuf || 0) * 100;
      score += (s.atkBuf || 0) * 100;
      score += (s.lethBuf || 0) * 80;
      score += (s.defBuf || 0) * 60;
      score += (s.hpBuf || 0) * 60;
      score += (s.atkDebuf || 0) * 80;
      score += (s.defDebuf || 0) * 80;
      score += (s.lethDebuf || 0) * 70;
      score += (s.atkStatDebuf || 0) * 70;
      return { hero: h, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map(s => s.hero);
  }, []);

  // おすすめ編成検索
  const findRecommendedFormation = useCallback(async () => {
    setIsRecommending(true);
    setRecommendations([]);
    setRecommendProgress(null);

    // setTimeoutでUI更新を先に行う
    await new Promise(r => setTimeout(r, 50));

    const myTroops = formationToTroopCount(currentFormation);

    // リーダーはステータスが全兵種に影響するためG10以上を優先
    // ただし兵比0の兵種はスキル目的で低世代も検討（例: 5:0:5でミアG3槍）
    const ratios = normalizeRatio(currentFormation);
    const topShield = HEROES.filter(h => h.r === 'SSR' && h.t === 'shield' && (h.g >= 10 || ratios.shield === 0));
    const topSpear = HEROES.filter(h => h.r === 'SSR' && h.t === 'spear' && (h.g >= 10 || ratios.spear === 0));
    const topBow = HEROES.filter(h => h.r === 'SSR' && h.t === 'bow' && (h.g >= 10 || ratios.bow === 0));

    // デフォルト敵 (G12ミラー)
    const defaultEnemyLeaders = [
      HEROES.find(h => h.id === 'hervil')!,
      HEROES.find(h => h.id === 'carol')!,
      HEROES.find(h => h.id === 'laizia')!,
    ];
    const dConfig = defaultHeroConfig();
    const dHeroStats = calcHeroStats(
      defaultEnemyLeaders.map(hero => ({ hero, config: dConfig })),
      activeSide !== 'atk'
    );

    const results: { shield: Hero; spear: Hero; bow: Hero; winRate: number; avgTurns: number }[] = [];
    const total = topShield.length * topSpear.length * topBow.length;
    let count = 0;

    for (const sh of topShield) {
      for (const sp of topSpear) {
        for (const bo of topBow) {
          count++;

          const config = defaultHeroConfig();
          const aHeroStats = calcHeroStats(
            [
              { hero: sh, config },
              { hero: sp, config },
              { hero: bo, config },
            ],
            activeSide === 'atk'
          );

          const sim = runSimulation({
            aTroops: myTroops,
            dTroops: myTroops,
            aHeroStats,
            dHeroStats,
            aLeaders: [sh, sp, bo],
            aRiders: [],
            dLeaders: defaultEnemyLeaders,
            dRiders: [],
            aTroopTier: currentFormation.troopTier,
            dTroopTier: currentFormation.troopTier,
            aChiefGearTier: currentFormation.chiefGearTier,
            dChiefGearTier: currentFormation.chiefGearTier,
            aGems: currentFormation.gems,
            dGems: currentFormation.gems,
            aHeroGearLevel: currentFormation.heroGearLevel,
            dHeroGearLevel: currentFormation.heroGearLevel,
            runs: 10,
          });

          const winRate = sim.atkWins / sim.runs;
          results.push({
            shield: sh,
            spear: sp,
            bow: bo,
            winRate,
            avgTurns: sim.avgTurns,
          });

          // UIフリーズ防止
          if (count % 20 === 0) {
            setRecommendProgress({ current: count, total });
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }
    }

    // 勝率でソート、Top5
    results.sort((a, b) => b.winRate - a.winRate || a.avgTurns - b.avgTurns);
    const top5 = results.slice(0, 5).map(r => ({
      ...r,
      riders: recommendRiders([r.shield, r.spear, r.bow]),
    }));

    setRecommendations(top5);
    setRecommendProgress(null);
    setIsRecommending(false);
  }, [currentFormation, activeSide, recommendRiders]);

  // おすすめ編成をセット
  const applyRecommendation = useCallback(
    (rec: { shield: Hero; spear: Hero; bow: Hero; riders: Hero[] }) => {
      setFormations((prev) => ({
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          leaders: [rec.shield, rec.spear, rec.bow],
          riders: rec.riders,
        },
      }));
      // 結果をクリア
      setRecommendations([]);
    },
    [activeSide]
  );

  const updateFormation = useCallback(
    (key: keyof SideFormation, value: number) => {
      setFormations((prev) => ({
        ...prev,
        [activeSide]: { ...prev[activeSide], [key]: value },
      }));
    },
    [activeSide]
  );

  const runSim = useCallback(
    (runs: number) => {
      setIsSimulating(true);

      // Use setTimeout to let UI update before heavy computation
      setTimeout(async () => {
        try {
          const atkF = formations.atk;
          const defF = formations.def;

          const aTroops = formationToTroopCount(atkF);
          const dTroops = formationToTroopCount(defF);
          const aHeroStats = formationToHeroStats(atkF, true);
          const dHeroStats = formationToHeroStats(defF, false);

          const aLeaders = atkF.leaders.filter((h): h is Hero => h !== null);
          const dLeaders = defF.leaders.filter((h): h is Hero => h !== null);

          const result = runSimulation({
            aTroops,
            dTroops,
            aHeroStats,
            dHeroStats,
            aLeaders,
            aRiders: atkF.riders,
            dLeaders,
            dRiders: defF.riders,
            aTroopTier: atkF.troopTier,
            dTroopTier: defF.troopTier,
            aChiefGearTier: atkF.chiefGearTier,
            dChiefGearTier: defF.chiefGearTier,
            aGemLevel: atkF.gemLevel,
            dGemLevel: defF.gemLevel,
            aGems: atkF.gems,
            dGems: defF.gems,
            aHeroGearLevel: atkF.heroGearLevel,
            dHeroGearLevel: defF.heroGearLevel,
            aPetStats: {
              atk: atkF.petAtk, def: atkF.petDef,
              shieldLeth: atkF.petShieldLeth, shieldHp: atkF.petShieldHp,
              spearLeth: atkF.petSpearLeth, spearHp: atkF.petSpearHp,
              bowLeth: atkF.petBowLeth, bowHp: atkF.petBowHp,
            },
            dPetStats: {
              atk: defF.petAtk, def: defF.petDef,
              shieldLeth: defF.petShieldLeth, shieldHp: defF.petShieldHp,
              spearLeth: defF.petSpearLeth, spearHp: defF.petSpearHp,
              bowLeth: defF.petBowLeth, bowHp: defF.petBowHp,
            },
            ...(atkF.extraStatsEnabled ? { aExtraStats: extraStatsToSimFormat(atkF.extraStats) } : {}),
            ...(defF.extraStatsEnabled ? { dExtraStats: extraStatsToSimFormat(defF.extraStats) } : {}),
            runs,
          });

          // デバッグ表示: 手動入力モードの場合はextraStatsの値を表示
          const debugAtkStats = atkF.extraStatsEnabled
            ? [
                { atk: atkF.extraStats.shieldATK, def: atkF.extraStats.shieldDEF, leth: atkF.extraStats.shieldLeth, hp: atkF.extraStats.shieldHP },
                { atk: atkF.extraStats.spearATK, def: atkF.extraStats.spearDEF, leth: atkF.extraStats.spearLeth, hp: atkF.extraStats.spearHP },
                { atk: atkF.extraStats.bowATK, def: atkF.extraStats.bowDEF, leth: atkF.extraStats.bowLeth, hp: atkF.extraStats.bowHP },
              ]
            : aHeroStats;
          const debugDefStats = defF.extraStatsEnabled
            ? [
                { atk: defF.extraStats.shieldATK, def: defF.extraStats.shieldDEF, leth: defF.extraStats.shieldLeth, hp: defF.extraStats.shieldHP },
                { atk: defF.extraStats.spearATK, def: defF.extraStats.spearDEF, leth: defF.extraStats.spearLeth, hp: defF.extraStats.spearHP },
                { atk: defF.extraStats.bowATK, def: defF.extraStats.bowDEF, leth: defF.extraStats.bowLeth, hp: defF.extraStats.bowHP },
              ]
            : dHeroStats;

          setSimResult(result);
          setSimDebugInfo({ atkHeroStats: debugAtkStats, defHeroStats: debugDefStats, atkTroops: aTroops, defTroops: dTroops });

          // Supabaseに保存
          try {
            const atkLeaderIds = atkF.leaders.filter(Boolean).map(h => h!.id);
            const defLeaderIds = defF.leaders.filter(Boolean).map(h => h!.id);
            const winner = result.atkWins > result.defWins ? 'a' : result.defWins > result.atkWins ? 'd' : 'draw';
            const lastRun = result.results[result.results.length - 1];

            const buildSideDetails = (f: SideFormation) => ({
              leaders: f.leaders.filter(Boolean).map(h => ({ id: h!.id, name: h!.n, type: h!.t })),
              riders: f.riders.map(h => ({ id: h.id, name: h.n, type: h.t })),
              troopRatio: { shield: f.shieldRatio, spear: f.spearRatio, bow: f.bowRatio },
              totalTroops: f.totalTroops,
              troopTier: f.troopTier,
              chiefGearTier: f.chiefGearTier,
              gemLevel: f.gemLevel,
              gems: f.gems,
              heroGearLevel: f.heroGearLevel,
              petStats: {
                atk: f.petAtk, def: f.petDef,
                shieldLeth: f.petShieldLeth, shieldHp: f.petShieldHp,
                spearLeth: f.petSpearLeth, spearHp: f.petSpearHp,
                bowLeth: f.petBowLeth, bowHp: f.petBowHp,
              },
              extraStatsEnabled: f.extraStatsEnabled,
              ...(f.extraStatsEnabled ? { extraStats: f.extraStats } : {}),
            });

            const details = {
              atkFormation: buildSideDetails(atkF),
              defFormation: buildSideDetails(defF),
              results: {
                atkWins: result.atkWins,
                defWins: result.defWins,
                draws: result.draws,
                avgTurns: Math.round(result.avgTurns * 10) / 10,
                lastRun: lastRun ? {
                  aTroopsLeft: lastRun.aTroopsLeft,
                  dTroopsLeft: lastRun.dTroopsLeft,
                  aCasualty: lastRun.aCasualty,
                  dCasualty: lastRun.dCasualty,
                } : null,
              },
            };

            const { error } = await supabase.from('sim_history').insert({
              times: runs,
              winner,
              a_wins: result.atkWins,
              d_wins: result.defWins,
              draws: result.draws,
              a_win_rate: Math.round((result.atkWins / runs) * 1000) / 10,
              avg_turns: Math.round(result.avgTurns * 10) / 10,
              a_troops: aTroops.shield + aTroops.spear + aTroops.bow,
              d_troops: dTroops.shield + dTroops.spear + dTroops.bow,
              a_leaders: atkLeaderIds,
              d_leaders: defLeaderIds,
              a_riders: atkF.riders.map(h => h.id),
              d_riders: defF.riders.map(h => h.id),
              a_atk: Math.round(aHeroStats[0]?.atk || 0),
              a_leth: Math.round(aHeroStats[0]?.leth || 0),
              d_atk: Math.round(dHeroStats[0]?.atk || 0),
              d_leth: Math.round(dHeroStats[0]?.leth || 0),
              a_residual: lastRun ? (lastRun.aTroopsLeft.shield + lastRun.aTroopsLeft.spear + lastRun.aTroopsLeft.bow) : 0,
              d_residual: lastRun ? (lastRun.dTroopsLeft.shield + lastRun.dTroopsLeft.spear + lastRun.dTroopsLeft.bow) : 0,
              details,
            });
            if (error) console.error('Supabase save error:', error.message, error.details);
          } catch (e) {
            console.error('Failed to save to Supabase:', e);
          }
        } finally {
          setIsSimulating(false);
        }
      }, 50);
    },
    [formations]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-xl text-ice-blue/50">&#10052;</span>
        <h2 className="text-gradient-gold text-2xl font-bold">
          集結シミュレーター
        </h2>
        <span className="text-xl text-ice-blue/50">&#10052;</span>
      </div>
      <div className="gold-divider mb-6" />

      {/* ATK/DEF Toggle */}
      <div className="mb-4 flex overflow-hidden rounded-lg border border-wos-border">
        <button
          onClick={() => setActiveSide('atk')}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            activeSide === 'atk'
              ? 'bg-atk-red text-white'
              : 'bg-white/60 text-text-secondary hover:text-text-primary'
          }`}
        >
          攻撃側
        </button>
        <button
          onClick={() => setActiveSide('def')}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            activeSide === 'def'
              ? 'bg-def-blue text-white'
              : 'bg-white/60 text-text-secondary hover:text-text-primary'
          }`}
        >
          防御側
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Formation Panel */}
        <div className="lg:col-span-1">
          <div className="card-corners panel-glow rounded-xl border border-wos-border bg-wos-panel p-4">
            <h3 className="mb-3 text-sm font-bold text-text-primary">
              {activeSide === 'atk' ? '攻撃' : '防御'}編成
            </h3>

            {/* Leader slots */}
            <div className="mb-4">
              <div className="mb-2 text-xs text-text-muted">
                リーダー (盾/槍/弓 各1体, SSRのみ)
              </div>
              <div className="flex justify-around">
                {(['shield', 'spear', 'bow'] as TroopType[]).map((tt, idx) => (
                  <LeaderSlot
                    key={tt}
                    troopType={tt}
                    hero={currentFormation.leaders[idx]}
                    onRemove={() => removeLeader(idx)}
                  />
                ))}
              </div>
            </div>

            {/* Rider slots */}
            <div className="mb-4">
              <div className="mb-2 text-xs text-text-muted">
                ライダー ({currentFormation.riders.length}/4)
                <span className="ml-1 text-text-muted">- S1のみ適用</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentFormation.riders.map((hero, idx) => (
                  <button
                    key={`rider-${idx}`}
                    onClick={() => removeRiderByIndex(idx)}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 ${TROOP_COLORS[hero.t]} text-xs`}
                  >
                    <HeroAvatar hero={hero} size="sm" />
                    <span className={TROOP_TEXT_COLORS[hero.t]}>{hero.n}</span>
                    <span className="text-text-muted">&times;</span>
                  </button>
                ))}
                {currentFormation.riders.length === 0 && (
                  <span className="text-xs text-text-muted">
                    英雄をクリックして追加
                  </span>
                )}
              </div>
            </div>

            {/* Troop count */}
            <div className="mb-4">
              <label className="mb-1 block text-xs text-text-muted">
                総兵士数
              </label>
              <input
                type="number"
                min={1000}
                max={5000000}
                step={10000}
                value={currentFormation.totalTroops}
                onChange={(e) =>
                  updateFormation('totalTroops', Number(e.target.value))
                }
                className="w-full rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-text-primary outline-none focus:border-def-blue/50"
              />
            </div>

            {/* FC Level selector */}
            <div className="mb-4">
              <label className="mb-1 block text-xs text-text-muted">
                兵士ティア
              </label>
              <div className="flex flex-wrap gap-1">
                {TROOP_TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    onClick={() =>
                      setFormations((prev) => ({
                        ...prev,
                        [activeSide]: { ...prev[activeSide], troopTier: tier.value },
                      }))
                    }
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentFormation.troopTier === tier.value
                        ? 'bg-ice-blue text-white shadow-sm'
                        : 'bg-white/60 text-text-secondary hover:bg-white/80'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra Stats Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentFormation.extraStatsEnabled}
                  onChange={(e) =>
                    setFormations((prev) => ({
                      ...prev,
                      [activeSide]: { ...prev[activeSide], extraStatsEnabled: e.target.checked },
                    }))
                  }
                  className="rounded border-wos-border"
                />
                <span className="text-xs font-bold text-text-primary">
                  追加ステータス（バトルレポートの値を直接入力）
                </span>
              </label>
              <div className="mt-0.5 text-[10px] text-text-muted">
                {currentFormation.extraStatsEnabled
                  ? 'ON: バトレポの追加ステータスを使用（装備/宝石/ペット設定は無視）'
                  : 'OFF: 装備・宝石・ペットから自動計算'}
              </div>
            </div>

            {currentFormation.extraStatsEnabled ? (
              /* Extra Stats Manual Input */
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="mb-2 text-xs font-bold text-amber-300">
                  追加ステータス入力
                </div>
                <div className="text-[10px] text-text-muted mb-2">
                  バトルレポートの「追加ステータス」をそのまま入力 (%)
                </div>
                {/* Header */}
                <div className="grid grid-cols-5 gap-1 mb-1 text-[10px]">
                  <span></span>
                  <span className="text-center font-bold text-text-muted">ATK</span>
                  <span className="text-center font-bold text-text-muted">DEF</span>
                  <span className="text-center font-bold text-text-muted">殺傷</span>
                  <span className="text-center font-bold text-text-muted">HP</span>
                </div>
                {/* Per troop type rows */}
                {([
                  { label: '盾', color: TROOP_TEXT_COLORS.shield, prefix: 'shield' as const },
                  { label: '槍', color: TROOP_TEXT_COLORS.spear, prefix: 'spear' as const },
                  { label: '弓', color: TROOP_TEXT_COLORS.bow, prefix: 'bow' as const },
                ]).map(({ label, color, prefix }) => (
                  <div key={prefix} className="grid grid-cols-5 gap-1 mb-1">
                    <span className={`text-[11px] font-bold ${color} self-center`}>{label}</span>
                    {(['ATK', 'DEF', 'Leth', 'HP'] as const).map((stat) => {
                      const key = `${prefix}${stat}` as keyof ExtraStats;
                      return (
                        <input
                          key={key}
                          type="number"
                          step="1"
                          value={currentFormation.extraStats[key]}
                          onChange={(e) =>
                            setFormations((prev) => ({
                              ...prev,
                              [activeSide]: {
                                ...prev[activeSide],
                                extraStats: {
                                  ...prev[activeSide].extraStats,
                                  [key]: parseFloat(e.target.value) || 0,
                                },
                              },
                            }))
                          }
                          className="rounded border border-wos-border bg-wos-dark px-1.5 py-0.5 text-[10px] text-text-primary outline-none text-center"
                        />
                      );
                    })}
                  </div>
                ))}
                <div className="mt-2 text-[9px] text-text-muted">
                  例: バトレポで「盾ATK+3665%」なら盾ATK欄に 3665 を入力
                </div>
              </div>
            ) : (
              <>
                {/* Chief Gear + Gem summary with detail button */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-muted">
                      領主装備・宝石
                    </label>
                    <button
                      type="button"
                      onClick={() => setGearGemModalSide(activeSide)}
                      className="rounded-md bg-sky-600/20 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-sky-600/30 transition-colors"
                    >
                      詳細設定 ⚙️
                    </button>
                  </div>
                  {(() => {
                    const gearStats = calcChiefGearStats(currentFormation.chiefGearTier);
                    const gemTotals = calcGemsTotalByType(currentFormation.gems);
                    const tierInfo = CHIEF_GEAR_TIERS.find(t => t.id === currentFormation.chiefGearTier);
                    return (
                      <div className="rounded-lg border border-wos-border bg-wos-dark/50 px-3 py-2 text-[10px] text-text-muted space-y-0.5">
                        <div>{tierInfo?.name ?? '?'} ATK+{gearStats.atk.toFixed(0)}% DEF+{gearStats.def.toFixed(0)}%</div>
                        <div className="flex flex-wrap gap-x-3">
                          <span className="text-shield-blue">🛡盾殺+{gemTotals.shield.leth}%</span>
                          <span className="text-spear-orange">🔱槍殺+{gemTotals.spear.leth}%</span>
                          <span className="text-bow-green">🏹弓殺+{gemTotals.bow.leth}%</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Hero Gear selector */}
                <div className="mb-4">
                  <label className="mb-1 block text-xs text-text-muted">
                    英雄装備
                  </label>
                  <select
                    value={currentFormation.heroGearLevel}
                    onChange={(e) =>
                      setFormations((prev) => ({
                        ...prev,
                        [activeSide]: { ...prev[activeSide], heroGearLevel: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-text-primary outline-none focus:border-def-blue/50"
                  >
                    {HERO_GEAR_LEVELS.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const hgStats = calcHeroGearStats(currentFormation.heroGearLevel);
                    return hgStats.leth > 0 ? (
                      <div className="mt-1 text-[10px] text-text-muted">
                        殺傷力+{hgStats.leth}%, HP+{hgStats.hp}%, ATK+{hgStats.atk}%, DEF+{hgStats.def}%
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Pet Stats - 兵種別 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-text-muted">🐾 ペット強化</label>
                <button
                  type="button"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-wos-border bg-wos-dark text-text-muted hover:text-text-primary"
                  onClick={() =>
                    setFormations((prev) => ({
                      ...prev,
                      [activeSide]: {
                        ...prev[activeSide],
                        ...DEFAULT_PET,
                        petAtk: DEFAULT_PET.atk,
                        petDef: DEFAULT_PET.def,
                        petShieldLeth: DEFAULT_PET.shieldLeth,
                        petShieldHp: DEFAULT_PET.shieldHp,
                        petSpearLeth: DEFAULT_PET.spearLeth,
                        petSpearHp: DEFAULT_PET.spearHp,
                        petBowLeth: DEFAULT_PET.bowLeth,
                        petBowHp: DEFAULT_PET.bowHp,
                      },
                    }))
                  }
                >MAX</button>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-text-muted">部隊ATK</span>
                  <span className="text-text-muted">部隊DEF</span>
                  <span></span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['petAtk', 'petDef'] as const).map((key) => (
                    <input key={key} type="number" step="0.01" value={currentFormation[key]}
                      onChange={(e) => setFormations((prev) => ({ ...prev, [activeSide]: { ...prev[activeSide], [key]: parseFloat(e.target.value) || 0 } }))}
                      className="rounded border border-wos-border bg-wos-dark px-1.5 py-0.5 text-[10px] text-text-primary outline-none" />
                  ))}
                  <span className="text-text-muted self-center">%</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  <span></span>
                  <span className={`text-center font-bold ${TROOP_TEXT_COLORS.shield}`}>🛡盾</span>
                  <span className={`text-center font-bold ${TROOP_TEXT_COLORS.spear}`}>🔱槍</span>
                  <span className={`text-center font-bold ${TROOP_TEXT_COLORS.bow}`}>🏹弓</span>
                </div>
                {(['Leth', 'Hp'] as const).map((stat) => (
                  <div key={stat} className="grid grid-cols-4 gap-1">
                    <span className="text-text-muted">{stat === 'Leth' ? '殺傷力' : 'HP'}</span>
                    {(['Shield', 'Spear', 'Bow'] as const).map((troop) => {
                      const key = `pet${troop}${stat}` as keyof SideFormation;
                      return (
                        <input key={key} type="number" step="0.01"
                          value={currentFormation[key] as number}
                          onChange={(e) => setFormations((prev) => ({ ...prev, [activeSide]: { ...prev[activeSide], [key]: parseFloat(e.target.value) || 0 } }))}
                          className="rounded border border-wos-border bg-wos-dark px-1.5 py-0.5 text-[10px] text-text-primary outline-none text-center" />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
              </>
            )}

            {/* Troop Skills Panel */}
            <div className="mb-4">
              <div className="mb-1 text-xs font-bold text-text-primary">
                {'\u{1F4CB}'} 発動中の殿堂スキル
              </div>
              <div className="rounded-lg border border-wos-border bg-white/60 p-2 space-y-2">
                {(['shield', 'spear', 'bow'] as TroopType[]).map((tt) => {
                  const allSkills = TROOP_SKILLS.filter((s) => s.troopType === tt);
                  return (
                    <div key={tt}>
                      <div className={`text-xs font-bold ${TROOP_TEXT_COLORS[tt]}`}>
                        {TROOP_EMOJI[tt]} {TROOP_LABELS[tt]}兵
                      </div>
                      <div className="ml-2 space-y-0.5">
                        {allSkills.map((skill) => {
                          const unlocked = skill.requiresTier <= currentFormation.troopTier;
                          return (
                            <div
                              key={skill.id}
                              className={`flex items-start gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                                unlocked
                                  ? 'bg-green-50 text-text-primary'
                                  : 'bg-gray-50 text-text-muted'
                              }`}
                            >
                              <span>{unlocked ? '\u2705' : '\u{1F512}'}</span>
                              <span>
                                {skill.nameJa}: {skill.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gear Skill (集結スキル) Panel */}
            <div className="mb-4">
              <div className="mb-1 text-xs font-bold text-text-primary">
                {'\u2694\uFE0F'} 集結スキル（専用武器）
              </div>
              <div className="rounded-lg border border-wos-border bg-white/60 p-2 space-y-1.5">
                {currentFormation.leaders.map((hero, idx) => {
                  const tt: TroopType = idx === 0 ? 'shield' : idx === 1 ? 'spear' : 'bow';
                  if (!hero) {
                    return (
                      <div key={`gs-${tt}`} className="text-[10px] text-text-muted px-1.5 py-0.5">
                        {TROOP_LABELS[tt]}リーダー: 未設定
                      </div>
                    );
                  }
                  const gs = hero.gs;
                  if (!gs) {
                    return (
                      <div key={`gs-${hero.id}`} className="text-[10px] text-text-muted px-1.5 py-0.5">
                        {hero.n}（{TROOP_LABELS[tt]}）: 専用武器スキルなし
                      </div>
                    );
                  }
                  const isActive =
                    (gs.timing === 'atk' && activeSide === 'atk') ||
                    (gs.timing === 'def' && activeSide === 'def');
                  const timingLabel = gs.timing === 'atk' ? '集結攻撃時' : '集結防御時';
                  const sideLabel = activeSide === 'atk' ? '攻撃編成' : '防御編成';
                  return (
                    <div
                      key={`gs-${hero.id}`}
                      className={`rounded px-1.5 py-1 text-[10px] ${
                        isActive ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="font-bold text-text-primary">
                        {hero.n}（{TROOP_LABELS[tt]}）
                      </div>
                      <div className="text-text-secondary">
                        {'\u2192'} {timingLabel}: 全兵種{EFF_LABELS[gs.eff]}+15%
                      </div>
                      <div className={isActive ? 'text-green-600' : 'text-text-muted'}>
                        状態: {isActive ? '\u2705 発動中' : '\u274C 未発動'}（{sideLabel}）
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hero Skills Display */}
            {(currentFormation.leaders.some(Boolean) || currentFormation.riders.length > 0) && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-bold text-text-primary">
                🎯 英雄スキル一覧
              </div>
              <div className="rounded-lg border border-wos-border bg-white/60 p-2 space-y-2 max-h-[300px] overflow-y-auto">
                {/* リーダースキル（全3スキル発動） */}
                {currentFormation.leaders.filter(Boolean).map((hero) => {
                  if (!hero) return null;
                  const skills = [hero.s1, hero.s2, hero.s3].filter(Boolean);
                  return (
                    <div key={`hsk-${hero.id}`} className="border-b border-wos-border/50 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <HeroAvatar hero={hero} size="sm" />
                        <span className={`text-[11px] font-bold ${TROOP_TEXT_COLORS[hero.t]}`}>{hero.n}</span>
                        <span className="text-[9px] bg-gold/10 text-gold-dark px-1.5 py-0.5 rounded font-bold">リーダー</span>
                        <span className="text-[9px] text-text-muted">S1〜S3全発動</span>
                      </div>
                      <div className="ml-7 space-y-0.5">
                        {skills.map((sk, i) => (
                          <div key={i} className="flex items-start gap-1 text-[10px]">
                            <span className="text-green-500 shrink-0">✅</span>
                            <span className="text-text-secondary">S{i+1}: {sk!.lbl}</span>
                          </div>
                        ))}
                        {skills.length === 0 && (
                          <div className="text-[10px] text-text-muted">スキルなし</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* ライダースキル（S1のみ発動） */}
                {currentFormation.riders.map((hero, idx) => (
                  <div key={`rsk-${idx}`} className="border-b border-wos-border/50 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <HeroAvatar hero={hero} size="sm" />
                      <span className={`text-[11px] font-bold ${TROOP_TEXT_COLORS[hero.t]}`}>{hero.n}</span>
                      <span className="text-[9px] bg-ice-blue/10 text-ice-blue px-1.5 py-0.5 rounded font-bold">ライダー</span>
                      <span className="text-[9px] text-text-muted">S1のみ</span>
                    </div>
                    <div className="ml-7 space-y-0.5">
                      {hero.s1 ? (
                        <div className="flex items-start gap-1 text-[10px]">
                          <span className="text-green-500 shrink-0">✅</span>
                          <span className="text-text-secondary">S1: {hero.s1.lbl}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-muted">S1なし</div>
                      )}
                      {hero.s2 && (
                        <div className="flex items-start gap-1 text-[10px] opacity-40">
                          <span className="shrink-0">🔒</span>
                          <span>S2: {hero.s2.lbl}</span>
                        </div>
                      )}
                      {hero.s3 && (
                        <div className="flex items-start gap-1 text-[10px] opacity-40">
                          <span className="shrink-0">🔒</span>
                          <span>S3: {hero.s3.lbl}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Troop ratios */}
            <div>
              <div className="mb-2 text-xs text-text-muted">兵種比率（数値入力 → 自動で%に正規化）</div>
              {(['shield', 'spear', 'bow'] as const).map((tt) => {
                const key: RatioKey =
                  tt === 'shield'
                    ? 'shieldRatio'
                    : tt === 'spear'
                      ? 'spearRatio'
                      : 'bowRatio';
                const pct = normalizeRatio(currentFormation);
                const pctVal = pct[tt];
                return (
                  <div key={tt} className="mb-1.5 flex items-center gap-2">
                    <span
                      className={`w-6 text-sm font-bold ${TROOP_TEXT_COLORS[tt]}`}
                    >
                      {TROOP_LABELS[tt]}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={currentFormation[key]}
                      onChange={(e) =>
                        updateRatio(key, Number(e.target.value))
                      }
                      className="w-16 rounded border border-wos-border bg-wos-dark px-2 py-1 text-center text-sm text-text-primary outline-none focus:border-def-blue/50"
                    />
                    <span className="text-xs text-text-muted">→</span>
                    <span className={`text-xs font-bold ${TROOP_TEXT_COLORS[tt]}`}>
                      {pctVal}%
                    </span>
                  </div>
                );
              })}
              <div className="mt-2">
                <div className="mb-1 text-[10px] text-text-muted">プリセット</div>
                <div className="flex flex-wrap gap-1">
                  {RATIO_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyRatioPreset(p)}
                      className="rounded-md border border-wos-border bg-white/60 px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-gold/10 hover:border-gold/40 hover:text-gold-dark"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* おすすめ編成ボタン */}
              <div className="mt-3">
                <button
                  onClick={findRecommendedFormation}
                  disabled={isRecommending}
                  className="w-full rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-3 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
                >
                  {isRecommending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      計算中...
                    </span>
                  ) : (
                    activeSide === 'atk' ? '⚔️ この兵比で攻撃おすすめ編成を検索' : '🛡️ この兵比で防衛おすすめ編成を検索'
                  )}
                </button>
                {isRecommending && recommendProgress && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-text-muted mb-1">
                      <span>進捗</span>
                      <span>{recommendProgress.current}/{recommendProgress.total}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-wos-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-200"
                        style={{ width: `${(recommendProgress.current / recommendProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* おすすめ編成結果 */}
              {recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-bold text-gold-dark">
                    おすすめ編成 Top5
                  </div>
                  {recommendations.map((rec, idx) => (
                    <div
                      key={`rec-${idx}`}
                      className={`rounded-lg border p-3 transition-colors ${
                        idx === 0
                          ? 'border-amber-400/60 bg-gradient-to-br from-amber-50 to-yellow-50'
                          : 'border-wos-border bg-white/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold ${idx === 0 ? 'text-amber-600' : 'text-text-primary'}`}>
                          {idx + 1}位 {idx === 0 ? '\u2B50' : ''} 勝率{Math.round(rec.winRate * 100)}%
                        </span>
                        <span className="text-[10px] text-text-muted">
                          平均{rec.avgTurns.toFixed(0)}T
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[9px] text-text-muted font-bold">Leader:</span>
                        <div className="flex items-center gap-1">
                          <HeroAvatar hero={rec.shield} size="sm" />
                          <span className={`text-[10px] ${TROOP_TEXT_COLORS.shield}`}>{rec.shield.n}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HeroAvatar hero={rec.spear} size="sm" />
                          <span className={`text-[10px] ${TROOP_TEXT_COLORS.spear}`}>{rec.spear.n}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <HeroAvatar hero={rec.bow} size="sm" />
                          <span className={`text-[10px] ${TROOP_TEXT_COLORS.bow}`}>{rec.bow.n}</span>
                        </div>
                      </div>
                      {rec.riders.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[9px] text-text-muted font-bold">Rider:</span>
                          {rec.riders.map((rider, ri) => (
                            <div key={ri} className="flex items-center gap-0.5">
                              <HeroAvatar hero={rider} size="sm" />
                              <span className={`text-[9px] ${TROOP_TEXT_COLORS[rider.t]}`}>{rider.n}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => applyRecommendation(rec)}
                        className="w-full rounded-md bg-sky-500/20 py-1.5 text-[11px] font-medium text-sky-600 transition-colors hover:bg-sky-500/30"
                      >
                        この編成をセット
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Simulation Run Buttons (in left panel) */}
          <div className="mt-4 card-corners panel-glow rounded-xl border border-wos-border bg-wos-panel p-4">
            <div className="flex flex-wrap gap-2">
              {[1, 10, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => runSim(n)}
                  disabled={isSimulating}
                  className="btn-gold-shine flex-1 rounded-lg bg-gradient-to-r from-gold to-gold-light px-3 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isSimulating ? '...' : `${n}回`}
                </button>
              ))}
            </div>
            {/* Compact formation summary */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded border border-atk-red/20 bg-atk-red/5 px-2 py-1">
                <span className="font-bold text-atk-red">攻撃</span>
                <span className="ml-1 text-text-secondary">
                  {formations.atk.leaders.filter(Boolean).map(h => h!.n.slice(0,3)).join('・') || '未設定'}
                </span>
              </div>
              <div className="rounded border border-def-blue/20 bg-def-blue/5 px-2 py-1">
                <span className="font-bold text-def-blue">防御</span>
                <span className="ml-1 text-text-secondary">
                  {formations.def.leaders.filter(Boolean).map(h => h!.n.slice(0,3)).join('・') || '未設定'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Hero Grid + Results */}
        <div className="lg:col-span-2">
          {/* Search + Filters */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-text-primary">英雄一覧</h3>
              <input
                type="text"
                placeholder="🔍 英雄名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-lg border border-wos-border bg-white/70 px-3 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
              />
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-text-muted mr-1">ソート:</span>
            {([
              { key: 'default' as const, label: '世代順' },
              { key: 'atk' as const, label: '攻撃系' },
              { key: 'def' as const, label: '防御系' },
              { key: 'atkDmg' as const, label: '与ダメ' },
              { key: 'leth' as const, label: '殺傷力' },
            ]).map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  sortBy === s.key
                    ? 'bg-ice-blue text-white'
                    : 'bg-white/50 text-text-secondary hover:bg-white/70'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {/* Rarity filter */}
              {(
                [
                  { key: 'all' as RarityFilter, label: '全て' },
                  { key: 'SSR' as RarityFilter, label: 'SSR' },
                  { key: 'SR' as RarityFilter, label: 'SR' },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterRarity(f.key)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    filterRarity === f.key
                      ? 'bg-gold text-white'
                      : 'bg-white/60 text-text-secondary hover:bg-white/80 hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="mx-1 text-wos-border">|</span>
              {/* Troop type filter */}
              {(
                [
                  { key: 'all' as const, label: '全兵種' },
                  { key: 'shield' as const, label: '盾' },
                  { key: 'spear' as const, label: '槍' },
                  { key: 'bow' as const, label: '弓' },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    filterType === f.key
                      ? 'bg-gold text-white'
                      : 'bg-white/60 text-text-secondary hover:bg-white/80 hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hero grid grouped by generation */}
          <div className="mb-6">
            <GroupedHeroGrid
              heroes={filteredHeroes}
              isHeroSelected={isHeroSelected}
              onHeroClick={handleHeroClick}
            />
          </div>

          {/* Results */}
          <div className="card-corners panel-glow rounded-xl border border-wos-border bg-wos-panel p-4">
            {simResult ? (
              <ResultDisplay
                result={simResult}
                atkLeaders={formations.atk.leaders}
                defLeaders={formations.def.leaders}
                debugInfo={simDebugInfo}
                atkExtraStatsEnabled={formations.atk.extraStatsEnabled}
                defExtraStatsEnabled={formations.def.extraStatsEnabled}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-wos-border p-6 text-center text-sm text-text-muted">
                ← 編成を設定して実行ボタンを押してください
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gear & Gem Modal */}
      {gearGemModalSide !== null && (
        <GearGemModal
          formation={formations[gearGemModalSide]}
          onApply={(gearTier, gems) => {
            setFormations((prev) => ({
              ...prev,
              [gearGemModalSide]: {
                ...prev[gearGemModalSide],
                chiefGearTier: gearTier,
                gems,
              },
            }));
            setGearGemModalSide(null);
          }}
          onClose={() => setGearGemModalSide(null)}
        />
      )}
    </div>
  );
}
