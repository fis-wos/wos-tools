"use client";

import { useState } from "react";

interface Participant {
  id: number;
  name: string;
}

interface Reward {
  id: number;
  name: string;
  quantity: number;
}

interface LotteryResult {
  participant: string;
  reward: string;
}

export default function LotteryPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [newReward, setNewReward] = useState("");
  const [newRewardQty, setNewRewardQty] = useState(1);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const addParticipant = () => {
    const name = newParticipant.trim();
    if (!name) return;
    setParticipants((prev) => [
      ...prev,
      { id: Date.now(), name },
    ]);
    setNewParticipant("");
  };

  const addBulkParticipants = () => {
    const names = bulkInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const newOnes = names.map((name, i) => ({
      id: Date.now() + i,
      name,
    }));
    setParticipants((prev) => [...prev, ...newOnes]);
    setBulkInput("");
    setShowBulk(false);
  };

  const removeParticipant = (id: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const addReward = () => {
    const name = newReward.trim();
    if (!name) return;
    setRewards((prev) => [
      ...prev,
      { id: Date.now(), name, quantity: newRewardQty },
    ]);
    setNewReward("");
    setNewRewardQty(1);
  };

  const removeReward = (id: number) => {
    setRewards((prev) => prev.filter((r) => r.id !== id));
  };

  const runLottery = () => {
    if (participants.length === 0 || rewards.length === 0) return;

    setIsDrawing(true);

    // Expand rewards by quantity
    const expandedRewards: string[] = [];
    for (const r of rewards) {
      for (let i = 0; i < r.quantity; i++) {
        expandedRewards.push(r.name);
      }
    }

    // Shuffle participants
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Assign rewards
    const newResults: LotteryResult[] = [];
    for (let i = 0; i < Math.min(shuffled.length, expandedRewards.length); i++) {
      newResults.push({
        participant: shuffled[i].name,
        reward: expandedRewards[i],
      });
    }

    // Animate delay
    setTimeout(() => {
      setResults(newResults);
      setIsDrawing(false);
    }, 800);
  };

  const clearResults = () => setResults([]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h2 className="text-gradient-gold mb-6 text-2xl font-bold">
        SVS褒賞抽選
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Participants */}
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-3 text-sm font-bold text-ice-blue-light">
            参加者
            <span className="ml-2 text-xs text-gray-500">
              ({participants.length}名)
            </span>
          </h3>

          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addParticipant()}
              placeholder="名前を入力..."
              className="flex-1 rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-ice-blue/50"
            />
            <button
              onClick={addParticipant}
              className="rounded-lg bg-ice-blue/20 px-3 py-2 text-sm font-medium text-ice-blue transition-colors hover:bg-ice-blue/30"
            >
              追加
            </button>
          </div>

          <button
            onClick={() => setShowBulk(!showBulk)}
            className="mb-3 text-xs text-gray-500 hover:text-gray-300"
          >
            {showBulk ? "閉じる" : "一括入力..."}
          </button>

          {showBulk && (
            <div className="mb-3">
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="名前をカンマまたは改行で区切って入力..."
                className="mb-2 w-full rounded-lg border border-wos-border bg-wos-dark p-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-ice-blue/50"
                rows={4}
              />
              <button
                onClick={addBulkParticipants}
                className="w-full rounded-lg bg-ice-blue/20 py-2 text-xs font-medium text-ice-blue transition-colors hover:bg-ice-blue/30"
              >
                一括追加
              </button>
            </div>
          )}

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-wos-dark px-3 py-1.5"
              >
                <span className="text-sm text-gray-300">{p.name}</span>
                <button
                  onClick={() => removeParticipant(p.id)}
                  className="text-xs text-gray-600 hover:text-atk-red"
                >
                  &times;
                </button>
              </div>
            ))}
            {participants.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-600">
                参加者を追加してください
              </p>
            )}
          </div>
        </div>

        {/* Rewards */}
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <h3 className="mb-3 text-sm font-bold text-gold-light">
            報酬設定
            <span className="ml-2 text-xs text-gray-500">
              ({rewards.reduce((a, r) => a + r.quantity, 0)}個)
            </span>
          </h3>

          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newReward}
              onChange={(e) => setNewReward(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addReward()}
              placeholder="報酬名..."
              className="flex-1 rounded-lg border border-wos-border bg-wos-dark px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-gold/50"
            />
            <input
              type="number"
              min={1}
              max={99}
              value={newRewardQty}
              onChange={(e) => setNewRewardQty(Number(e.target.value))}
              className="w-14 rounded-lg border border-wos-border bg-wos-dark px-2 py-2 text-center text-sm text-gray-200 outline-none focus:border-gold/50"
            />
            <button
              onClick={addReward}
              className="rounded-lg bg-gold/20 px-3 py-2 text-sm font-medium text-gold-light transition-colors hover:bg-gold/30"
            >
              追加
            </button>
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {rewards.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-wos-dark px-3 py-1.5"
              >
                <span className="text-sm text-gray-300">
                  {r.name}
                  <span className="ml-2 text-xs text-gold-dark">
                    x{r.quantity}
                  </span>
                </span>
                <button
                  onClick={() => removeReward(r.id)}
                  className="text-xs text-gray-600 hover:text-atk-red"
                >
                  &times;
                </button>
              </div>
            ))}
            {rewards.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-600">
                報酬を追加してください
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Draw button */}
      <div className="my-8 flex justify-center">
        <button
          onClick={runLottery}
          disabled={
            participants.length === 0 || rewards.length === 0 || isDrawing
          }
          className="rounded-xl bg-gradient-to-r from-gold-dark to-gold-light px-10 py-3.5 text-base font-bold text-wos-dark shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {isDrawing ? "抽選中..." : "抽選実行"}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="panel-glow rounded-xl border border-wos-border bg-wos-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-gradient-gold text-lg font-bold">抽選結果</h3>
            <button
              onClick={clearResults}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              クリア
            </button>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-wos-dark px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold-light">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-200">
                    {r.participant}
                  </span>
                </div>
                <span className="rounded-md bg-gold/10 px-3 py-1 text-sm font-medium text-gold-light">
                  {r.reward}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
