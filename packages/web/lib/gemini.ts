/**
 * AI Image Analysis Client for WOS Battle Report
 *
 * Two-tier strategy:
 * 1. Gemini 2.5 Flash (fast & cheap)
 * 2. Claude Sonnet fallback (high accuracy)
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface AnalyzedFormation {
  leaders: {
    shield?: string | null;
    spear?: string | null;
    bow?: string | null;
  };
  riders: string[];
  troops: {
    shield: number;
    spear: number;
    bow: number;
  };
  totalTroops?: number | null;
  stats?: {
    atk?: number | null;
    def?: number | null;
    leth?: number | null;
    hp?: number | null;
  } | null;
  analyzedBy?: 'gemini' | 'claude' | 'manual';
}

const ANALYSIS_PROMPT = `この画像はホワイトアウトサバイバル（WOS）のバトルレポートまたは集結編成画面のスクリーンショットです。
以下の情報をJSONで抽出してください：

1. 英雄の名前（盾/槍/弓のリーダーとライダー）
   - 英雄名は日本語で正確に読み取ってください
   - WOSの英雄例: マグナス、ヘルヴィル、カロール、ライジーア、エリオノーラ、ロイド、ルーファス、ブランシュ、グレゴリー、フレイヤ、フレッド、シュラ、ガト、ソニヤ、ヘンドリック、エディス、ゴードン、ブラッドリー等
2. 兵士の比率（盾兵/槍兵/弓兵のパーセンテージまたは兵数）
3. 総兵士数（分かれば）
4. 追加ステータス（ATK%, DEF%, 殺傷力%, HP%）（分かれば）

JSON形式のみで回答してください：
{
  "leaders": {"shield": "英雄名", "spear": "英雄名", "bow": "英雄名"},
  "riders": ["英雄名1", "英雄名2"],
  "troops": {"shield": 50, "spear": 20, "bow": 30},
  "totalTroops": 1800000,
  "stats": {"atk": 2000, "def": 1500, "leth": 800, "hp": 600}
}

分からない項目はnullにしてください。JSONのみ返してください。`;

// ── API Key Management ──

export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('wos_gemini_api_key');
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
}

export function getClaudeApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('wos_claude_api_key');
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_CLAUDE_API_KEY || '';
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wos_gemini_api_key', key);
  }
}

export function saveClaudeApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wos_claude_api_key', key);
  }
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

export function hasClaudeApiKey(): boolean {
  return getClaudeApiKey().length > 0;
}

export function hasAnyApiKey(): boolean {
  return hasGeminiApiKey() || hasClaudeApiKey();
}

// ── Gemini Analysis ──

async function analyzeWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<AnalyzedFormation> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini APIキーなし');

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: ANALYSIS_PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ...parseResult(text), analyzedBy: 'gemini' };
}

// ── Claude Analysis (Fallback) ──

async function analyzeWithClaude(
  imageBase64: string,
  mimeType: string
): Promise<AnalyzedFormation> {
  const apiKey = getClaudeApiKey();
  if (!apiKey) throw new Error('Claude APIキーなし');

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: ANALYSIS_PROMPT },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return { ...parseResult(text), analyzedBy: 'claude' };
}

// ── Parse JSON result ──

function parseResult(text: string): AnalyzedFormation {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('解析結果のJSONを取得できませんでした');

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    leaders: {
      shield: parsed.leaders?.shield || null,
      spear: parsed.leaders?.spear || null,
      bow: parsed.leaders?.bow || null,
    },
    riders: Array.isArray(parsed.riders)
      ? parsed.riders.filter((r: unknown) => r != null)
      : [],
    troops: {
      shield: parsed.troops?.shield ?? 34,
      spear: parsed.troops?.spear ?? 33,
      bow: parsed.troops?.bow ?? 33,
    },
    totalTroops: parsed.totalTroops || null,
    stats: parsed.stats || null,
  };
}

// ── Main Entry: Two-tier analysis ──

/**
 * Analyze formation image with two-tier strategy:
 * 1. Try Gemini 2.5 Flash (fast & cheap)
 * 2. If Gemini fails, fall back to Claude Sonnet (high accuracy)
 * 3. If both fail, throw error
 */
export async function analyzeFormationImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<AnalyzedFormation> {
  const errors: string[] = [];

  // Tier 1: Gemini
  if (hasGeminiApiKey()) {
    try {
      const result = await analyzeWithGemini(imageBase64, mimeType);
      // 簡易バリデーション: 英雄名が1つ以上読み取れたか
      const hasLeader = result.leaders.shield || result.leaders.spear || result.leaders.bow;
      if (hasLeader) return result;
      errors.push('Gemini: 英雄名を読み取れませんでした');
    } catch (e) {
      errors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Tier 2: Claude (fallback)
  if (hasClaudeApiKey()) {
    try {
      return await analyzeWithClaude(imageBase64, mimeType);
    } catch (e) {
      errors.push(`Claude: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Both failed
  if (errors.length === 0) {
    throw new Error('APIキーが設定されていません。Gemini または Claude のAPIキーを設定してください。');
  }
  throw new Error(`画像解析に失敗しました:\n${errors.join('\n')}`);
}
