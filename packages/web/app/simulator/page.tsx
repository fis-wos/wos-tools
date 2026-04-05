'use client';

import { useState, useMemo, useCallback } from 'react';
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

interface SideFormation {
  leaders: (Hero | null)[]; // [shield, spear, bow]
  riders: Hero[];
  totalTroops: number;
  shieldRatio: number;
  spearRatio: number;
  bowRatio: number;
  troopTier: TroopTier;
}

function emptyFormation(): SideFormation {
  return {
    leaders: [null, null, null],
    riders: [],
    totalTroops: 1800000,
    shieldRatio: 34,
    spearRatio: 33,
    bowRatio: 33,
    troopTier: 11 as TroopTier,
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

/** Lock ratios to 100%: when one key changes, redistribute the rest proportionally. */
function lockTo100(
  formation: SideFormation,
  changedKey: RatioKey,
  newValue: number
): Partial<SideFormation> {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const otherKeys = RATIO_KEYS.filter((k) => k !== changedKey);
  const remain = 100 - clamped;
  const otherSum = otherKeys.reduce((s, k) => s + formation[k], 0);

  let vals: Record<string, number>;
  if (otherSum === 0) {
    // Equal split
    const half = Math.floor(remain / 2);
    vals = {
      [changedKey]: clamped,
      [otherKeys[0]]: half,
      [otherKeys[1]]: remain - half,
    };
  } else {
    const v0 = Math.round((formation[otherKeys[0]] / otherSum) * remain);
    vals = {
      [changedKey]: clamped,
      [otherKeys[0]]: v0,
      [otherKeys[1]]: remain - v0,
    };
  }
  return vals;
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
}: {
  result: SimAggregateResult;
  atkLeaders: (Hero | null)[];
  defLeaders: (Hero | null)[];
}) {
  const latestRun = result.results[result.results.length - 1];
  const atkWinRate = ((result.atkWins / result.runs) * 100).toFixed(1);
  const defWinRate = ((result.defWins / result.runs) * 100).toFixed(1);
  const drawRate = ((result.draws / result.runs) * 100).toFixed(1);

  const atkHeroes = atkLeaders.filter((h): h is Hero => h !== null);
  const defHeroes = defLeaders.filter((h): h is Hero => h !== null);

  return (
    <div className="space-y-4">
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
  const [isSimulating, setIsSimulating] = useState(false);

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

  // Update ratio with lockTo100
  const updateRatio = useCallback(
    (key: RatioKey, value: number) => {
      setFormations((prev) => {
        const f = prev[activeSide];
        const patch = lockTo100(f, key, value);
        return {
          ...prev,
          [activeSide]: { ...f, ...patch },
        };
      });
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
      setTimeout(() => {
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
            runs,
          });

          setSimResult(result);
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
              <div className="mb-2 text-xs text-text-muted">兵種比率</div>
              {(['shield', 'spear', 'bow'] as const).map((tt) => {
                const key: RatioKey =
                  tt === 'shield'
                    ? 'shieldRatio'
                    : tt === 'spear'
                      ? 'spearRatio'
                      : 'bowRatio';
                return (
                  <div key={tt} className="mb-1 flex items-center gap-2">
                    <span
                      className={`w-6 text-sm font-bold ${TROOP_TEXT_COLORS[tt]}`}
                    >
                      {TROOP_LABELS[tt]}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={currentFormation[key]}
                      onChange={(e) =>
                        updateRatio(key, Number(e.target.value))
                      }
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={currentFormation[key]}
                      onChange={(e) =>
                        updateRatio(key, Number(e.target.value))
                      }
                      className="w-12 rounded border border-wos-border bg-wos-dark px-1 py-0.5 text-right text-xs text-text-primary outline-none focus:border-def-blue/50"
                    />
                    <span className="text-xs text-text-muted">%</span>
                  </div>
                );
              })}
              <div className="text-right text-[10px] text-text-muted">
                合計:{' '}
                {currentFormation.shieldRatio +
                  currentFormation.spearRatio +
                  currentFormation.bowRatio}
                %
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

          {/* Simulation Controls */}
          <div className="card-corners panel-glow rounded-xl border border-wos-border bg-wos-panel p-4">
            <h3 className="mb-3 text-sm font-bold text-text-primary">
              シミュレーション実行
            </h3>

            {/* Formation summary */}
            <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-atk-red/30 bg-atk-red/5 p-2">
                <div className="mb-1 font-bold text-atk-red">攻撃側</div>
                <div className="text-text-secondary">
                  リーダー:{' '}
                  {formations.atk.leaders
                    .filter(Boolean)
                    .map((h) => h!.n)
                    .join(', ') || 'なし'}
                </div>
                <div className="text-text-secondary">
                  ライダー:{' '}
                  {formations.atk.riders.map((h) => h.n).join(', ') || 'なし'}
                </div>
                <div className="text-text-secondary">
                  兵数: {formations.atk.totalTroops.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-def-blue/30 bg-def-blue/5 p-2">
                <div className="mb-1 font-bold text-def-blue">防御側</div>
                <div className="text-text-secondary">
                  リーダー:{' '}
                  {formations.def.leaders
                    .filter(Boolean)
                    .map((h) => h!.n)
                    .join(', ') || 'なし'}
                </div>
                <div className="text-text-secondary">
                  ライダー:{' '}
                  {formations.def.riders.map((h) => h.n).join(', ') || 'なし'}
                </div>
                <div className="text-text-secondary">
                  兵数: {formations.def.totalTroops.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Run buttons */}
            <div className="mb-4 flex flex-wrap gap-2">
              {[1, 10, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => runSim(n)}
                  disabled={isSimulating}
                  className="btn-gold-shine rounded-lg bg-gradient-to-r from-gold to-gold-light px-5 py-2 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isSimulating ? '計算中...' : `${n}回実行`}
                </button>
              ))}
            </div>

            {/* Results */}
            {simResult ? (
              <ResultDisplay
                result={simResult}
                atkLeaders={formations.atk.leaders}
                defLeaders={formations.def.leaders}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-wos-border p-6 text-center text-sm text-text-muted">
                編成を設定してシミュレーションを実行してください
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
