'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  HEROES,
  type Hero,
  type TroopType,
} from '@/lib/engine/heroes';
import {
  type TroopCount,
} from '@/lib/engine/battle-engine';
import {
  analyzeFormationImage,
  hasGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey,
  type AnalyzedFormation,
} from '@/lib/gemini';
import {
  findCounterFormations,
  type CounterResult,
} from '@/lib/counter-engine';
import {
  saveAnalysis,
  type CounterResultRow,
} from '@/lib/counter-api';

// ── Constants ──

const TROOP_LABELS: Record<TroopType, string> = {
  shield: '盾',
  spear: '槍',
  bow: '弓',
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

const TROOP_BORDER_COLORS: Record<TroopType, string> = {
  shield: 'border-shield-blue',
  spear: 'border-spear-orange',
  bow: 'border-bow-green',
};

// ── Hero Avatar ──

function HeroAvatar({
  hero,
  size = 'md',
}: {
  hero: Hero;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
        ? 'h-14 w-14'
        : 'h-12 w-12';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const borderClass =
    hero.r === 'SR' ? 'border-purple-400/60' : 'border-gold/40';
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
        <span
          className={`${textSize} font-bold ${TROOP_TEXT_COLORS[hero.t]}`}
        >
          {hero.n.slice(0, 2)}
        </span>
      </div>
    </span>
  );
}

// ── Hero Selector Mini Card ──

function HeroMiniCard({
  hero,
  selected,
  onClick,
}: {
  hero: Hero;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center rounded-lg border-2 p-1.5 transition-all duration-200 ${
        selected
          ? 'border-gold bg-gold/10 ring-1 ring-gold/30'
          : `${TROOP_BORDER_COLORS[hero.t]} bg-white/50 hover:border-gold-dark/50`
      }`}
    >
      <div className="my-0.5">
        <HeroAvatar hero={hero} size="sm" />
      </div>
      <span className="mt-0.5 text-[10px] font-medium leading-tight text-text-primary">
        {hero.n}
      </span>
      <span className={`text-[9px] ${TROOP_TEXT_COLORS[hero.t]}`}>
        {TROOP_LABELS[hero.t]}
      </span>
      {selected && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] text-white">
          ✓
        </span>
      )}
    </button>
  );
}

// ── Find hero by Japanese name (fuzzy) ──

function findHeroByName(name: string): Hero | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  // Exact match first
  const exact = HEROES.find(
    (h) => h.n === name || h.n.toLowerCase() === lower
  );
  if (exact) return exact;
  // Partial match
  const partial = HEROES.find(
    (h) =>
      h.n.includes(name) ||
      name.includes(h.n) ||
      h.n.toLowerCase().includes(lower)
  );
  return partial || null;
}

// ── Main Page ──

export default function CounterPage() {
  // Mode: 'upload' (Gemini) or 'manual'
  const [mode, setMode] = useState<'upload' | 'manual'>(
    hasGeminiApiKey() ? 'upload' : 'manual'
  );

  // API Key
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);

  // Image upload (multiple)
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<AnalyzedFormation | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep backward compat
  const imagePreview = imagePreviews.length > 0 ? imagePreviews[0] : null;

  // Enemy formation (manual or from analysis)
  const [enemyShieldLeader, setEnemyShieldLeader] = useState<Hero | null>(
    null
  );
  const [enemySpearLeader, setEnemySpearLeader] = useState<Hero | null>(null);
  const [enemyBowLeader, setEnemyBowLeader] = useState<Hero | null>(null);
  const [enemyTroopShield, setEnemyTroopShield] = useState(34);
  const [enemyTroopSpear, setEnemyTroopSpear] = useState(33);
  const [enemyTroopBow, setEnemyTroopBow] = useState(33);
  const [enemyTotalTroops, setEnemyTotalTroops] = useState(1800000);

  // Available heroes (player's roster)
  const [selectedHeroIds, setSelectedHeroIds] = useState<Set<string>>(
    () => new Set(HEROES.filter((h) => h.r === 'SSR').map((h) => h.id))
  );
  const [showHeroSelector, setShowHeroSelector] = useState(false);
  const [heroFilterType, setHeroFilterType] = useState<TroopType | 'all'>(
    'all'
  );

  // Counter results
  const [counterResults, setCounterResults] = useState<CounterResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState({ current: 0, total: 0 });

  // Submitter info
  const [submittedBy, setSubmittedBy] = useState('');
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [savedToDb, setSavedToDb] = useState(false);

  // Manual hero selection for enemy
  const [showEnemyPicker, setShowEnemyPicker] = useState<TroopType | null>(
    null
  );

  // ── Handlers ──

  // Read file as base64 data URL
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleMultipleImages = useCallback(
    async (files: File[]) => {
      setAnalysisError(null);
      setAnalysisResult(null);

      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      // Preview all images
      const previews: string[] = [];
      for (const file of imageFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        previews.push(dataUrl);
      }
      setImagePreviews(prev => [...prev, ...previews]);

      // Analyze all images and merge results
      setIsAnalyzing(true);
      try {
        let merged: AnalyzedFormation = {
          leaders: { shield: null, spear: null, bow: null },
          riders: [],
          troops: { shield: 34, spear: 33, bow: 33 },
          totalTroops: null,
          stats: null,
          analyzedBy: 'gemini',
        };

        for (let i = 0; i < imageFiles.length; i++) {
          setAnalyzeProgress(`画像 ${i + 1}/${imageFiles.length} を解析中...`);
          try {
            const dataUrl = previews[i];
            const base64Data = dataUrl.split(',')[1];
            const mimeType = imageFiles[i].type || 'image/jpeg';
            const result = await analyzeFormationImage(base64Data, mimeType);

            // Merge: fill in missing data from each image
            if (result.leaders.shield && !merged.leaders.shield) merged.leaders.shield = result.leaders.shield;
            if (result.leaders.spear && !merged.leaders.spear) merged.leaders.spear = result.leaders.spear;
            if (result.leaders.bow && !merged.leaders.bow) merged.leaders.bow = result.leaders.bow;
            if (result.riders.length > 0) merged.riders = [...new Set([...merged.riders, ...result.riders])];
            if (result.troops) merged.troops = result.troops;
            if (result.totalTroops) merged.totalTroops = result.totalTroops;
            if (result.stats) merged.stats = result.stats;
            if (result.analyzedBy) merged.analyzedBy = result.analyzedBy;
          } catch (err) {
            console.error(`Image ${i + 1} analysis failed:`, err);
          }
        }

        setAnalysisResult(merged);
        setAnalyzeProgress('');

        // Auto-set enemy formation from merged analysis
        if (merged.leaders.shield) {
          const hero = findHeroByName(merged.leaders.shield);
          if (hero) setEnemyShieldLeader(hero);
        }
        if (merged.leaders.spear) {
          const hero = findHeroByName(merged.leaders.spear);
          if (hero) setEnemySpearLeader(hero);
        }
        if (merged.leaders.bow) {
          const hero = findHeroByName(merged.leaders.bow);
          if (hero) setEnemyBowLeader(hero);
        }
        if (merged.troops) {
          setEnemyTroopShield(merged.troops.shield);
          setEnemyTroopSpear(merged.troops.spear);
          setEnemyTroopBow(merged.troops.bow);
        }
        if (merged.totalTroops) {
          setEnemyTotalTroops(merged.totalTroops);
        }
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : '解析に失敗しました'
        );
      } finally {
        setIsAnalyzing(false);
        setAnalyzeProgress('');
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleMultipleImages(files);
      }
    },
    [handleMultipleImages]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        handleMultipleImages(files);
      }
    },
    [handleMultipleImages]
  );

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim()) {
      saveGeminiApiKey(apiKeyInput.trim());
      setShowApiKeyForm(false);
      setMode('upload');
    }
  }, [apiKeyInput]);

  const handleCalculateCounter = useCallback(async () => {
    setIsCalculating(true);
    setCounterResults([]);
    setCalcProgress({ current: 0, total: 0 });
    setSavedToDb(false);

    try {
      const enemyLeaders = [
        enemyShieldLeader,
        enemySpearLeader,
        enemyBowLeader,
      ].filter((h): h is Hero => h !== null);

      const ratioSum = enemyTroopShield + enemyTroopSpear + enemyTroopBow;
      const enemyTroops: TroopCount = {
        shield: Math.round(
          (enemyTotalTroops * enemyTroopShield) / (ratioSum || 1)
        ),
        spear: Math.round(
          (enemyTotalTroops * enemyTroopSpear) / (ratioSum || 1)
        ),
        bow: Math.round(
          (enemyTotalTroops * enemyTroopBow) / (ratioSum || 1)
        ),
      };

      const availableHeroes = HEROES.filter((h) =>
        selectedHeroIds.has(h.id)
      );

      const results = await findCounterFormations(
        enemyLeaders,
        [], // riders
        enemyTroops,
        availableHeroes,
        enemyTotalTroops,
        30,
        (current, total) => {
          setCalcProgress({ current, total });
        }
      );

      setCounterResults(results);

      // Auto-save to Supabase
      if (results.length > 0) {
        const analyzedBy = analysisResult ? 'gemini' : 'manual';
        const counterResultRows: CounterResultRow[] = results.map((r) => ({
          rank: r.rank,
          leaders: {
            shield: r.leaders.shield?.n,
            spear: r.leaders.spear?.n,
            bow: r.leaders.bow?.n,
          },
          riders: r.riders.map((rd) => rd.n),
          troopRatio: r.troopRatio,
          winRate: r.winRate,
          avgTurns: r.avgTurns,
          avgLossRate: r.avgLossRate,
        }));

        await saveAnalysis({
          analyzed_by: analyzedBy,
          enemy_shield_hero: enemyShieldLeader?.n || null,
          enemy_spear_hero: enemySpearLeader?.n || null,
          enemy_bow_hero: enemyBowLeader?.n || null,
          enemy_riders: [],
          enemy_troops_shield: enemyTroopShield,
          enemy_troops_spear: enemyTroopSpear,
          enemy_troops_bow: enemyTroopBow,
          enemy_total_troops: enemyTotalTroops,
          enemy_stats: null,
          counter_results: counterResultRows,
          best_win_rate: results[0].winRate,
          submitted_by: submittedBy.trim() || null,
          notes: analysisNotes.trim() || null,
        });
        setSavedToDb(true);
      }
    } catch (err) {
      console.error('Counter calculation failed:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [
    enemyShieldLeader,
    enemySpearLeader,
    enemyBowLeader,
    enemyTroopShield,
    enemyTroopSpear,
    enemyTroopBow,
    enemyTotalTroops,
    selectedHeroIds,
    analysisResult,
    submittedBy,
    analysisNotes,
  ]);

  const toggleHero = useCallback((heroId: string) => {
    setSelectedHeroIds((prev) => {
      const next = new Set(prev);
      if (next.has(heroId)) {
        next.delete(heroId);
      } else {
        next.add(heroId);
      }
      return next;
    });
  }, []);

  const selectAllHeroes = useCallback(() => {
    setSelectedHeroIds(
      new Set(HEROES.filter((h) => h.r === 'SSR').map((h) => h.id))
    );
  }, []);

  const deselectAllHeroes = useCallback(() => {
    setSelectedHeroIds(new Set());
  }, []);

  // Filtered heroes for enemy picker
  const enemyPickerHeroes = useMemo(() => {
    if (!showEnemyPicker) return [];
    return HEROES.filter(
      (h) => h.r === 'SSR' && h.t === showEnemyPicker
    ).sort((a, b) => b.g - a.g);
  }, [showEnemyPicker]);

  // Filtered heroes for roster selector
  const rosterHeroes = useMemo(() => {
    let list = HEROES.filter((h) => h.r === 'SSR');
    if (heroFilterType !== 'all') {
      list = list.filter((h) => h.t === heroFilterType);
    }
    return list.sort((a, b) => b.g - a.g);
  }, [heroFilterType]);

  const hasEnemyFormation =
    enemyShieldLeader || enemySpearLeader || enemyBowLeader;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Page Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-text-primary sm:text-3xl">
          <span className="mr-2">🎯</span>
          カウンター編成提案
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          敵のバトルレポートから最適なカウンター編成をAIが提案
        </p>
      </div>

      {/* Mode Selector */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setMode('upload')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            mode === 'upload'
              ? 'bg-ice-blue text-white shadow-md'
              : 'bg-white/60 text-text-secondary hover:bg-white/80'
          }`}
        >
          📷 画像解析モード
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            mode === 'manual'
              ? 'bg-ice-blue text-white shadow-md'
              : 'bg-white/60 text-text-secondary hover:bg-white/80'
          }`}
        >
          ✏️ 手入力モード
        </button>

      </div>

      {/* Step 1: Image Upload or Manual Input */}
      <div className="mb-6 rounded-xl border border-wos-border bg-wos-panel p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-text-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ice-blue text-xs font-bold text-white">
            1
          </span>
          敵の編成を入力
        </h2>

        {mode === 'upload' && (
          <>
            {/* Screenshot Guide */}
            {!imagePreview && (
              <div className="mb-4 rounded-xl border border-ice-blue/30 bg-ice-blue/5 p-4">
                <div className="mb-2 text-sm font-bold text-ice-blue">
                  送信するスクショについて
                </div>
                <div className="space-y-2 text-xs text-text-secondary">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-bow-green/20 text-[10px] font-bold text-bow-green">
                      !
                    </span>
                    <div>
                      <span className="font-bold text-text-primary">
                        必須: バトルレポートの概要画面
                      </span>
                      <br />
                      英雄アイコン・兵数・勝敗が見える画面
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-def-blue/20 text-[10px] font-bold text-def-blue">
                      +
                    </span>
                    <div>
                      <span className="font-bold text-text-primary">
                        推奨: 追加ステータス画面
                      </span>
                      <br />
                      ATK%/DEF%/殺傷力%/HP%
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gold/20 text-[10px] font-bold text-gold-dark">
                      ?
                    </span>
                    <div>
                      <span className="font-bold text-text-primary">
                        任意: 戦闘詳細画面
                      </span>
                      <br />
                      兵種別の損害内訳
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Drop Zone */}
            {!imagePreview && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ice-blue/40 bg-ice-blue/5 px-6 py-12 transition-all hover:border-ice-blue/60 hover:bg-ice-blue/10"
              >
                <div className="mb-3 text-4xl">📸</div>
                <p className="text-sm font-bold text-text-primary">
                  バトルレポートのスクショをドロップ
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  またはクリックしてファイルを選択
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Image Previews (multiple) + Analysis */}
            {imagePreviews.length > 0 && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Screenshot ${idx + 1}`}
                        className="h-32 w-auto rounded-lg object-contain border border-wos-border"
                      />
                      <button
                        onClick={() => {
                          setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                          if (imagePreviews.length <= 1) {
                            setAnalysisResult(null);
                            setAnalysisError(null);
                          }
                        }}
                        className="absolute top-1 right-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white hover:bg-black/70"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* 追加ボタン */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-32 w-24 items-center justify-center rounded-lg border-2 border-dashed border-wos-border text-text-muted hover:border-ice-blue hover:text-ice-blue transition-colors"
                  >
                    <span className="text-2xl">+</span>
                  </button>
                </div>
                <div className="text-xs text-text-muted">{imagePreviews.length}枚のスクショ {analyzeProgress && `— ${analyzeProgress}`}</div>

                {isAnalyzing && (
                  <div className="flex items-center justify-center gap-3 rounded-lg bg-ice-blue/10 p-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-ice-blue border-t-transparent" />
                    <span className="text-sm font-bold text-ice-blue">
                      Gemini AIで解析中...
                    </span>
                  </div>
                )}

                {analysisError && (
                  <div className="rounded-lg border border-atk-red/30 bg-atk-red/10 p-3 text-sm text-atk-red">
                    ⚠ {analysisError}
                  </div>
                )}

                {analysisResult && (
                  <div className="rounded-lg border border-bow-green/30 bg-bow-green/10 p-3">
                    <p className="mb-2 text-xs font-bold text-bow-green">
                      ✓ 解析完了
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted">盾リーダー:</span>{' '}
                        <span className="font-bold">
                          {analysisResult.leaders.shield || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">槍リーダー:</span>{' '}
                        <span className="font-bold">
                          {analysisResult.leaders.spear || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">弓リーダー:</span>{' '}
                        <span className="font-bold">
                          {analysisResult.leaders.bow || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      兵比: 盾{analysisResult.troops.shield}% / 槍
                      {analysisResult.troops.spear}% / 弓
                      {analysisResult.troops.bow}%
                      {analysisResult.totalTroops &&
                        ` / 総兵数: ${analysisResult.totalTroops.toLocaleString()}`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasGeminiApiKey() && !imagePreview && (
              <p className="mt-3 text-center text-xs text-text-muted">
                ※ Gemini
                APIキーが未設定です。<a href="/admin" className="text-def-blue underline">管理画面</a>のAPI設定から設定するか、手入力モードをお使いください。
              </p>
            )}
          </>
        )}

        {/* Manual Enemy Formation Input (always visible as fallback or in manual mode) */}
        {(mode === 'manual' || analysisResult) && (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-bold text-text-secondary">
              {mode === 'upload' ? '解析結果を確認・修正' : '敵の編成'}
            </h3>

            {/* Enemy Leaders */}
            <div className="grid grid-cols-3 gap-3">
              {(['shield', 'spear', 'bow'] as TroopType[]).map((type) => {
                const leader =
                  type === 'shield'
                    ? enemyShieldLeader
                    : type === 'spear'
                      ? enemySpearLeader
                      : enemyBowLeader;
                const setLeader =
                  type === 'shield'
                    ? setEnemyShieldLeader
                    : type === 'spear'
                      ? setEnemySpearLeader
                      : setEnemyBowLeader;

                return (
                  <div key={type} className="flex flex-col items-center gap-1">
                    <span
                      className={`text-[10px] font-bold ${TROOP_TEXT_COLORS[type]}`}
                    >
                      {TROOP_LABELS[type]}リーダー
                    </span>
                    <button
                      onClick={() =>
                        setShowEnemyPicker(
                          showEnemyPicker === type ? null : type
                        )
                      }
                      className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 transition-all ${
                        leader
                          ? `${TROOP_BORDER_COLORS[type]} bg-white/60`
                          : 'border-dashed border-wos-border bg-wos-dark'
                      }`}
                    >
                      {leader ? (
                        <HeroAvatar hero={leader} size="sm" />
                      ) : (
                        <span className="text-lg text-text-muted">+</span>
                      )}
                    </button>
                    {leader && (
                      <span className="max-w-[64px] truncate text-[10px] font-medium text-text-secondary">
                        {leader.n}
                      </span>
                    )}
                    {leader && (
                      <button
                        onClick={() => setLeader(null)}
                        className="text-[9px] text-atk-red hover:underline"
                      >
                        解除
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Enemy Hero Picker Popup */}
            {showEnemyPicker && (
              <div className="rounded-lg border border-wos-border bg-white/90 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary">
                    {TROOP_LABELS[showEnemyPicker]}英雄を選択
                  </span>
                  <button
                    onClick={() => setShowEnemyPicker(null)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                  {enemyPickerHeroes.map((hero) => (
                    <button
                      key={hero.id}
                      onClick={() => {
                        if (showEnemyPicker === 'shield')
                          setEnemyShieldLeader(hero);
                        else if (showEnemyPicker === 'spear')
                          setEnemySpearLeader(hero);
                        else setEnemyBowLeader(hero);
                        setShowEnemyPicker(null);
                      }}
                      className="flex flex-col items-center rounded-lg border border-wos-border bg-white/60 p-1 hover:border-gold/50"
                    >
                      <HeroAvatar hero={hero} size="sm" />
                      <span className="mt-0.5 text-[9px] leading-tight">
                        {hero.n}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Troop Ratios */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-secondary">
                兵士比率
              </span>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['shield', enemyTroopShield, setEnemyTroopShield],
                    ['spear', enemyTroopSpear, setEnemyTroopSpear],
                    ['bow', enemyTroopBow, setEnemyTroopBow],
                  ] as [TroopType, number, (v: number) => void][]
                ).map(([type, value, setter]) => (
                  <div key={type}>
                    <label
                      className={`mb-1 block text-[10px] font-bold ${TROOP_TEXT_COLORS[type]}`}
                    >
                      {TROOP_LABELS[type]} {value}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={value}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
              <div className="text-right text-[10px] text-text-muted">
                合計:{' '}
                {enemyTroopShield + enemyTroopSpear + enemyTroopBow}%
              </div>
            </div>

            {/* Total Troops */}
            <div>
              <label className="mb-1 block text-xs font-bold text-text-secondary">
                総兵士数
              </label>
              <input
                type="number"
                value={enemyTotalTroops}
                onChange={(e) =>
                  setEnemyTotalTroops(Math.max(0, Number(e.target.value)))
                }
                className="w-full rounded-lg border border-wos-border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Select Available Heroes */}
      <div className="mb-6 rounded-xl border border-wos-border bg-wos-panel p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ice-blue text-xs font-bold text-white">
              2
            </span>
            持っている英雄を選択
          </h2>
          <button
            onClick={() => setShowHeroSelector(!showHeroSelector)}
            className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-white/80"
          >
            {showHeroSelector ? '閉じる' : '変更する'}
          </button>
        </div>

        <p className="mt-1 text-xs text-text-muted">
          選択中: {selectedHeroIds.size}体のSSR英雄
        </p>

        {showHeroSelector && (
          <div className="mt-3 space-y-3">
            {/* Filter + Select All */}
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'shield', 'spear', 'bow'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setHeroFilterType(type)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    heroFilterType === type
                      ? 'bg-ice-blue text-white'
                      : 'bg-white/60 text-text-secondary hover:bg-white/80'
                  }`}
                >
                  {type === 'all' ? '全て' : TROOP_LABELS[type]}
                </button>
              ))}
              <div className="ml-auto flex gap-1">
                <button
                  onClick={selectAllHeroes}
                  className="rounded-lg bg-bow-green/20 px-2 py-1 text-[10px] font-bold text-bow-green hover:bg-bow-green/30"
                >
                  全選択
                </button>
                <button
                  onClick={deselectAllHeroes}
                  className="rounded-lg bg-atk-red/20 px-2 py-1 text-[10px] font-bold text-atk-red hover:bg-atk-red/30"
                >
                  全解除
                </button>
              </div>
            </div>

            {/* Hero Grid */}
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {rosterHeroes.map((hero) => (
                <HeroMiniCard
                  key={hero.id}
                  hero={hero}
                  selected={selectedHeroIds.has(hero.id)}
                  onClick={() => toggleHero(hero.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submitter Info */}
      <div className="mb-6 rounded-xl border border-wos-border bg-wos-panel p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-secondary">
          投稿者情報（任意）
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              投稿者名
            </label>
            <input
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              placeholder="例: プレイヤー名"
              className="w-full rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ice-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-text-secondary">
              メモ
            </label>
            <input
              type="text"
              value={analysisNotes}
              onChange={(e) => setAnalysisNotes(e.target.value)}
              placeholder="例: SVS戦で遭遇した編成"
              className="w-full rounded-lg border border-wos-border bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ice-blue"
            />
          </div>
        </div>
      </div>

      {/* Step 3: Calculate Counter */}
      <div className="mb-6 text-center">
        <button
          onClick={handleCalculateCounter}
          disabled={isCalculating || !hasEnemyFormation}
          className={`rounded-xl px-8 py-3 text-lg font-black shadow-lg transition-all ${
            isCalculating || !hasEnemyFormation
              ? 'cursor-not-allowed bg-gray-300 text-gray-500'
              : 'bg-gradient-to-r from-gold-dark via-gold to-gold-light text-white hover:scale-105 hover:shadow-xl'
          }`}
        >
          {isCalculating ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              計算中... ({calcProgress.current}/{calcProgress.total})
            </span>
          ) : (
            '🎯 カウンター編成を計算'
          )}
        </button>
        {!hasEnemyFormation && (
          <p className="mt-2 text-xs text-text-muted">
            ※ まず敵の編成を入力してください
          </p>
        )}
      </div>

      {/* Step 4: Results */}
      {counterResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                ★
              </span>
              カウンター編成 Top {counterResults.length}
            </h2>
            {savedToDb && (
              <span className="rounded-lg bg-bow-green/10 px-3 py-1 text-xs font-bold text-bow-green">
                DB保存済み
              </span>
            )}
          </div>
          {/* Submitter + notes display */}
          {(submittedBy.trim() || analysisNotes.trim()) && (
            <div className="rounded-lg border border-ice-blue/20 bg-ice-blue/5 px-3 py-2 text-xs text-text-secondary">
              {submittedBy.trim() && (
                <span className="mr-3">
                  投稿者: <span className="font-bold text-text-primary">{submittedBy.trim()}</span>
                </span>
              )}
              {analysisNotes.trim() && (
                <span>
                  メモ: <span className="text-text-primary">{analysisNotes.trim()}</span>
                </span>
              )}
            </div>
          )}

          {counterResults.map((result) => (
            <div
              key={result.rank}
              className={`rounded-xl border-2 p-4 shadow-sm transition-all ${
                result.rank === 1
                  ? 'border-gold/50 bg-gradient-to-br from-gold/5 to-gold-light/5'
                  : 'border-wos-border bg-wos-panel'
              }`}
            >
              {/* Rank + Win Rate */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                      result.rank === 1
                        ? 'bg-gold text-white'
                        : result.rank === 2
                          ? 'bg-gray-300 text-gray-700'
                          : 'bg-wos-border text-text-secondary'
                    }`}
                  >
                    {result.rank}
                  </span>
                  <span className="text-sm font-bold text-text-primary">
                    勝率{' '}
                    <span
                      className={`text-xl ${
                        result.winRate >= 0.7
                          ? 'text-bow-green'
                          : result.winRate >= 0.4
                            ? 'text-gold-dark'
                            : 'text-atk-red'
                      }`}
                    >
                      {(result.winRate * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="text-right text-xs text-text-muted">
                  <div>平均{result.avgTurns.toFixed(0)}ターン</div>
                  <div>
                    損失率 {(result.avgLossRate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Leaders */}
              <div className="mb-3 grid grid-cols-3 gap-3">
                {(['shield', 'spear', 'bow'] as TroopType[]).map((type) => {
                  const hero = result.leaders[type];
                  if (!hero) return (
                    <div key={type} className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-bold ${TROOP_TEXT_COLORS[type]}`}>
                        {TROOP_LABELS[type]}
                      </span>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wos-dark text-text-muted">
                        -
                      </div>
                    </div>
                  );
                  return (
                    <div
                      key={type}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={`text-[10px] font-bold ${TROOP_TEXT_COLORS[type]}`}
                      >
                        {TROOP_LABELS[type]}
                      </span>
                      <HeroAvatar hero={hero} />
                      <span className="max-w-[80px] truncate text-[10px] font-medium text-text-secondary">
                        {hero.n}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Troop Ratio Bar */}
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-bold text-text-secondary">
                  推奨兵士比率
                </div>
                <div className="flex h-6 overflow-hidden rounded-full">
                  <div
                    className="flex items-center justify-center bg-shield-blue/70 text-[9px] font-bold text-white"
                    style={{
                      width: `${result.troopRatio.shield}%`,
                    }}
                  >
                    盾{result.troopRatio.shield}%
                  </div>
                  <div
                    className="flex items-center justify-center bg-spear-orange/70 text-[9px] font-bold text-white"
                    style={{
                      width: `${result.troopRatio.spear}%`,
                    }}
                  >
                    槍{result.troopRatio.spear}%
                  </div>
                  <div
                    className="flex items-center justify-center bg-bow-green/70 text-[9px] font-bold text-white"
                    style={{ width: `${result.troopRatio.bow}%` }}
                  >
                    弓{result.troopRatio.bow}%
                  </div>
                </div>
              </div>

              {/* Open in Simulator Button */}
              <button
                onClick={() => {
                  // Save formation to localStorage for simulator to pick up
                  const simData = {
                    atk: {
                      leaders: [
                        result.leaders.shield?.id || null,
                        result.leaders.spear?.id || null,
                        result.leaders.bow?.id || null,
                      ],
                      riders: result.riders?.map((r: Hero) => r.id) || [],
                      shieldRatio: result.troopRatio.shield,
                      spearRatio: result.troopRatio.spear,
                      bowRatio: result.troopRatio.bow,
                      totalTroops: 1800000,
                    },
                    def: {
                      leaders: [
                        enemyShieldLeader?.id || null,
                        enemySpearLeader?.id || null,
                        enemyBowLeader?.id || null,
                      ],
                      riders: [],
                      shieldRatio: enemyTroopShield,
                      spearRatio: enemyTroopSpear,
                      bowRatio: enemyTroopBow,
                      totalTroops: enemyTotalTroops,
                    },
                  };
                  localStorage.setItem('wos_sim_preset', JSON.stringify(simData));
                  window.location.href = '/simulator';
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-ice-blue/10 px-3 py-1.5 text-xs font-bold text-ice-blue hover:bg-ice-blue/20"
              >
                ⚔️ この編成でシミュレーターを開く
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after calculation with no results */}
      {counterResults.length === 0 && !isCalculating && hasEnemyFormation && calcProgress.total > 0 && (
        <div className="rounded-xl border border-wos-border bg-wos-panel p-8 text-center">
          <p className="text-sm text-text-muted">
            有効なカウンター編成が見つかりませんでした。
            持っている英雄の選択を確認してください。
          </p>
        </div>
      )}
    </div>
  );
}
