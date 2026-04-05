-- SVS応募者テーブル
CREATE TABLE IF NOT EXISTS svs_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  alliance TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SVS報酬設定テーブル
CREATE TABLE IF NOT EXISTS svs_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B')),
  quantity INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SVS抽選結果テーブル
CREATE TABLE IF NOT EXISTS svs_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES svs_participants(id),
  reward_id UUID REFERENCES svs_rewards(id),
  participant_name TEXT,
  participant_alliance TEXT,
  reward_name TEXT,
  reward_tier TEXT,
  seed TEXT,
  probability FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLSを有効化（公開ツールのため全許可ポリシー）
ALTER TABLE svs_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE svs_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE svs_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON svs_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON svs_rewards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON svs_results FOR ALL USING (true) WITH CHECK (true);

-- カウンター解析履歴テーブル
CREATE TABLE IF NOT EXISTS counter_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 解析元
  image_url TEXT,                    -- Supabase Storageの画像URL（将来用、今はnull）
  analyzed_by TEXT DEFAULT 'gemini', -- 'gemini' | 'claude' | 'manual'

  -- 敵編成データ
  enemy_shield_hero TEXT,
  enemy_spear_hero TEXT,
  enemy_bow_hero TEXT,
  enemy_riders JSONB DEFAULT '[]',
  enemy_troops_shield INT,
  enemy_troops_spear INT,
  enemy_troops_bow INT,
  enemy_total_troops INT,
  enemy_stats JSONB,               -- {"atk":2000,"def":1500,...}

  -- 提案結果
  counter_results JSONB,           -- [{rank,leaders,riders,troopRatio,winRate}]
  best_win_rate FLOAT,

  -- メタデータ
  submitted_by TEXT,               -- 投稿者名（任意）
  notes TEXT,                      -- メモ
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE counter_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON counter_analyses FOR ALL USING (true) WITH CHECK (true);

-- シミュレーション履歴にdetailsカラムを追加（編成・結果の詳細をJSONBで保存）
ALTER TABLE sim_history ADD COLUMN IF NOT EXISTS details JSONB;
