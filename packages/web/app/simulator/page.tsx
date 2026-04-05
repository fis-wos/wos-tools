"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import HeroCard from "@/components/HeroCard";
import TroopSlider from "@/components/TroopSlider";
import { MOCK_HEROES } from "@/lib/mock-heroes";

const tabs = [
  { label: "編成", href: "/simulator" },
  { label: "戦闘シミュレーション", href: "/simulator/battle" },
];

type Side = "atk" | "def";

export default function SimulatorPage() {
  const [activeTab, setActiveTab] = useState<"formation" | "battle">(
    "formation"
  );
  const [activeSide, setActiveSide] = useState<Side>("atk");
  const [selectedHeroes, setSelectedHeroes] = useState<
    Record<Side, string[]>
  >({ atk: [], def: [] });
  const [troopRatios, setTroopRatios] = useState({
    shield: 34,
    spear: 33,
    bow: 33,
  });
  const [filterType, setFilterType] = useState<string>("all");

  const toggleHero = (heroId: string) => {
    setSelectedHeroes((prev) => {
      const current = prev[activeSide];
      if (current.includes(heroId)) {
        return {
          ...prev,
          [activeSide]: current.filter((id) => id !== heroId),
        };
      }
      if (current.length >= 5) return prev;
      return { ...prev, [activeSide]: [...current, heroId] };
    });
  };

  const filteredHeroes =
    filterType === "all"
      ? MOCK_HEROES
      : MOCK_HEROES.filter((h) => h.troopType === filterType);

  return (
    <div>
      {/* Sub-navigation */}
      <div className="border-b border-wos-border bg-wos-panel">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          <button
            onClick={() => setActiveTab("formation")}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "formation"
                ? "text-gold-light"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            編成
            {activeTab === "formation" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-light to-gold-dark" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("battle")}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "battle"
                ? "text-gold-light"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            戦闘シミュレーション
            {activeTab === "battle" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-light to-gold-dark" />
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {activeTab === "formation" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Side selector + selected heroes panel */}
            <div className="lg:col-span-1">
              {/* ATK / DEF toggle */}
              <div className="mb-4 flex overflow-hidden rounded-lg border border-wos-border">
                <button
                  onClick={() => setActiveSide("atk")}
                  className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                    activeSide === "atk"
                      ? "bg-atk-red text-white"
                      : "bg-wos-panel text-gray-400 hover:text-gray-200"
                  }`}
                >
                  攻撃
                </button>
                <button
                  onClick={() => setActiveSide("def")}
                  className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                    activeSide === "def"
                      ? "bg-def-blue text-white"
                      : "bg-wos-panel text-gray-400 hover:text-gray-200"
                  }`}
                >
                  防御
                </button>
              </div>

              {/* Selected heroes */}
              <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-300">
                  {activeSide === "atk" ? "攻撃" : "防御"}編成
                  <span className="ml-2 text-xs text-gray-500">
                    ({selectedHeroes[activeSide].length}/5)
                  </span>
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const heroId = selectedHeroes[activeSide][i];
                    const hero = heroId
                      ? MOCK_HEROES.find((h) => h.id === heroId)
                      : null;
                    return (
                      <div
                        key={i}
                        className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-wos-border bg-wos-dark text-xs text-gray-600"
                      >
                        {hero ? (
                          <button
                            onClick={() => toggleHero(hero.id)}
                            className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-wos-panel-light p-1"
                          >
                            <span className="text-[10px] text-gray-300 leading-tight">
                              {hero.name}
                            </span>
                          </button>
                        ) : (
                          <span>+</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Troop ratios */}
                <div className="mt-5">
                  <h4 className="mb-2 text-xs font-medium text-gray-400">
                    兵種比率
                  </h4>
                  <div className="space-y-2">
                    <TroopSlider
                      label="盾"
                      color="#4a90d9"
                      value={troopRatios.shield}
                      onChange={(v) =>
                        setTroopRatios((r) => ({ ...r, shield: v }))
                      }
                    />
                    <TroopSlider
                      label="槍"
                      color="#d94a4a"
                      value={troopRatios.spear}
                      onChange={(v) =>
                        setTroopRatios((r) => ({ ...r, spear: v }))
                      }
                    />
                    <TroopSlider
                      label="弓"
                      color="#4ad94a"
                      value={troopRatios.bow}
                      onChange={(v) =>
                        setTroopRatios((r) => ({ ...r, bow: v }))
                      }
                    />
                  </div>
                  <div className="mt-2 text-right text-[10px] text-gray-500">
                    合計:{" "}
                    {troopRatios.shield + troopRatios.spear + troopRatios.bow}%
                  </div>
                </div>
              </div>
            </div>

            {/* Hero selection grid */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-300">英雄一覧</h3>
                <div className="flex gap-1">
                  {[
                    { key: "all", label: "全て" },
                    { key: "shield", label: "盾" },
                    { key: "spear", label: "槍" },
                    { key: "bow", label: "弓" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilterType(f.key)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        filterType === f.key
                          ? "bg-gold-dark text-white"
                          : "bg-wos-panel text-gray-400 hover:bg-wos-panel-light hover:text-gray-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {filteredHeroes.map((hero) => (
                  <HeroCard
                    key={hero.id}
                    name={hero.name}
                    generation={hero.generation}
                    rarity={hero.rarity}
                    troopType={hero.troopType}
                    imageUrl={hero.imageUrl}
                    selected={selectedHeroes[activeSide].includes(hero.id)}
                    onClick={() => toggleHero(hero.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Battle simulation tab */
          <div className="flex flex-col items-center gap-6">
            <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
              {/* Attacker summary */}
              <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-atk-red-light">
                  <span className="h-2 w-2 rounded-full bg-atk-red" />
                  攻撃側
                </h3>
                <p className="text-xs text-gray-400">
                  英雄: {selectedHeroes.atk.length}/5
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedHeroes.atk.map((id) => {
                    const h = MOCK_HEROES.find((hero) => hero.id === id);
                    return (
                      <span
                        key={id}
                        className="rounded bg-atk-red/20 px-2 py-0.5 text-[10px] text-atk-red-light"
                      >
                        {h?.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Defender summary */}
              <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-def-blue-light">
                  <span className="h-2 w-2 rounded-full bg-def-blue" />
                  防御側
                </h3>
                <p className="text-xs text-gray-400">
                  英雄: {selectedHeroes.def.length}/5
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedHeroes.def.map((id) => {
                    const h = MOCK_HEROES.find((hero) => hero.id === id);
                    return (
                      <span
                        key={id}
                        className="rounded bg-def-blue/20 px-2 py-0.5 text-[10px] text-def-blue-light"
                      >
                        {h?.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Simulate button */}
            <button className="rounded-xl bg-gradient-to-r from-gold-dark to-gold-light px-8 py-3 text-sm font-bold text-wos-dark shadow-lg transition-transform hover:scale-105 active:scale-95">
              シミュレーション実行
            </button>

            {/* Result placeholder */}
            <div className="w-full max-w-2xl rounded-xl border border-dashed border-wos-border bg-wos-panel p-8 text-center text-sm text-gray-500">
              シミュレーション結果がここに表示されます
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
