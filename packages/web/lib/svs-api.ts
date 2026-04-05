import { supabase } from './supabase';
import type { Participant, RewardItem, LotteryResult, Winner } from './lottery/types';

// ---------------------------------------------------------------------------
// Types for Supabase rows
// ---------------------------------------------------------------------------

interface DbParticipant {
  id: string;
  name: string;
  alliance: string;
  created_at: string;
}

interface DbReward {
  id: string;
  name: string;
  tier: string;
  quantity: number;
  sort_order: number;
  created_at: string;
}

interface DbResult {
  id: string;
  participant_id: string;
  reward_id: string;
  participant_name: string;
  participant_alliance: string;
  reward_name: string;
  reward_tier: string;
  seed: string;
  probability: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function dbToParticipant(row: DbParticipant): Participant {
  return {
    id: row.id,
    name: row.name,
    alliance: row.alliance,
    registeredAt: new Date(row.created_at).getTime(),
    kills: 0,
    score: 0,
    daysActive: 1,
  };
}

function dbToReward(row: DbReward): RewardItem {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier as 'S' | 'A' | 'B',
    quantity: row.quantity,
  };
}

// ---------------------------------------------------------------------------
// Connection check
// ---------------------------------------------------------------------------

let _supabaseAvailable: boolean | null = null;

export async function isSupabaseAvailable(): Promise<boolean> {
  if (_supabaseAvailable !== null) return _supabaseAvailable;
  try {
    const { error } = await supabase.from('svs_participants').select('id').limit(1);
    _supabaseAvailable = !error;
    return _supabaseAvailable;
  } catch {
    _supabaseAvailable = false;
    return false;
  }
}

// Reset cache (useful for retry)
export function resetSupabaseCache() {
  _supabaseAvailable = null;
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function getParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('svs_participants')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch participants: ${error.message}`);
  return (data as DbParticipant[]).map(dbToParticipant);
}

export async function addParticipant(name: string, alliance: string): Promise<Participant> {
  const { data, error } = await supabase
    .from('svs_participants')
    .insert({ name, alliance })
    .select()
    .single();

  if (error) throw new Error(`Failed to add participant: ${error.message}`);
  return dbToParticipant(data as DbParticipant);
}

export async function deleteParticipant(id: string): Promise<void> {
  // First delete related results
  await supabase.from('svs_results').delete().eq('participant_id', id);
  const { error } = await supabase.from('svs_participants').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete participant: ${error.message}`);
}

export async function clearAllParticipants(): Promise<void> {
  // Delete all results first (foreign key constraint)
  await supabase.from('svs_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase
    .from('svs_participants')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Failed to clear participants: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export async function getRewards(): Promise<RewardItem[]> {
  const { data, error } = await supabase
    .from('svs_rewards')
    .select('*')
    .neq('name', DEADLINE_KEY)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch rewards: ${error.message}`);
  return (data as DbReward[]).map(dbToReward);
}

export async function addReward(name: string, tier: string, quantity: number): Promise<RewardItem> {
  // Get max sort_order
  const { data: existing } = await supabase
    .from('svs_rewards')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = existing && existing.length > 0 ? (existing[0] as DbReward).sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('svs_rewards')
    .insert({ name, tier, quantity, sort_order: sortOrder })
    .select()
    .single();

  if (error) throw new Error(`Failed to add reward: ${error.message}`);
  return dbToReward(data as DbReward);
}

export async function updateReward(id: string, updates: Partial<RewardItem>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;

  const { error } = await supabase.from('svs_rewards').update(dbUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update reward: ${error.message}`);
}

export async function deleteReward(id: string): Promise<void> {
  // Delete related results first
  await supabase.from('svs_results').delete().eq('reward_id', id);
  const { error } = await supabase.from('svs_rewards').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete reward: ${error.message}`);
}

export async function swapRewardOrder(idA: string, idB: string): Promise<void> {
  const { data } = await supabase
    .from('svs_rewards')
    .select('id, sort_order')
    .in('id', [idA, idB]);

  if (!data || data.length !== 2) return;

  const a = data.find((r) => r.id === idA) as DbReward | undefined;
  const b = data.find((r) => r.id === idB) as DbReward | undefined;
  if (!a || !b) return;

  await supabase.from('svs_rewards').update({ sort_order: b.sort_order }).eq('id', idA);
  await supabase.from('svs_rewards').update({ sort_order: a.sort_order }).eq('id', idB);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function getResults(): Promise<DbResult[]> {
  const { data, error } = await supabase
    .from('svs_results')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch results: ${error.message}`);
  return data as DbResult[];
}

export async function saveResults(lotteryResult: LotteryResult): Promise<void> {
  // Clear existing results first
  await clearResults();

  const rows = lotteryResult.winners.map((w: Winner) => ({
    participant_id: w.participant.id,
    reward_id: w.reward.id,
    participant_name: w.participant.name,
    participant_alliance: w.participant.alliance,
    reward_name: w.reward.name,
    reward_tier: w.reward.tier,
    seed: lotteryResult.seed,
    probability: w.probability,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('svs_results').insert(rows);
  if (error) throw new Error(`Failed to save results: ${error.message}`);
}

export async function clearResults(): Promise<void> {
  const { error } = await supabase
    .from('svs_results')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Failed to clear results: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Deadline (stored as a special reward row with name='__deadline__')
// ---------------------------------------------------------------------------

const DEADLINE_KEY = '__deadline__';

export async function getDeadline(): Promise<string | null> {
  const { data, error } = await supabase
    .from('svs_rewards')
    .select('tier')
    .eq('name', DEADLINE_KEY)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return (data[0] as { tier: string }).tier || null;
}

export async function setDeadline(isoDatetime: string): Promise<void> {
  // Check if the row already exists
  const { data } = await supabase
    .from('svs_rewards')
    .select('id')
    .eq('name', DEADLINE_KEY)
    .limit(1);

  if (data && data.length > 0) {
    // Update existing
    const { error } = await supabase
      .from('svs_rewards')
      .update({ tier: isoDatetime })
      .eq('name', DEADLINE_KEY);
    if (error) throw new Error(`Failed to set deadline: ${error.message}`);
  } else {
    // Insert new
    const { error } = await supabase
      .from('svs_rewards')
      .insert({ name: DEADLINE_KEY, tier: isoDatetime, quantity: 0, sort_order: -1 });
    if (error) throw new Error(`Failed to set deadline: ${error.message}`);
  }
}

export async function clearDeadline(): Promise<void> {
  const { error } = await supabase
    .from('svs_rewards')
    .delete()
    .eq('name', DEADLINE_KEY);
  if (error) throw new Error(`Failed to clear deadline: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Simulation History (for admin)
// ---------------------------------------------------------------------------

export interface SimHistoryRow {
  id: string;
  created_at: string;
  winner: string;
  trials: number;
  attacker_formation: string;
  defender_formation: string;
  details?: SimDetails | null;
  [key: string]: unknown;
}

export interface SimDetails {
  atkFormation: SimSideDetail;
  defFormation: SimSideDetail;
  results: {
    atkWins: number;
    defWins: number;
    draws: number;
    avgTurns: number;
    lastRun?: {
      aTroopsLeft: { shield: number; spear: number; bow: number };
      dTroopsLeft: { shield: number; spear: number; bow: number };
      aCasualty: { dead: number; severeWound: number; lightWound: number; survived?: number };
      dCasualty: { dead: number; severeWound: number; lightWound: number; survived?: number };
    } | null;
  };
}

export interface SimSideDetail {
  leaders: { id: string; name: string; type: string }[];
  riders: { id: string; name: string; type: string }[];
  troopRatio: { shield: number; spear: number; bow: number };
  totalTroops: number;
  troopTier: number;
}

export async function getSimHistory(): Promise<SimHistoryRow[]> {
  const { data, error } = await supabase
    .from('sim_history')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch sim history: ${error.message}`);
  return data as SimHistoryRow[];
}

export async function clearSimHistory(): Promise<void> {
  const { error } = await supabase
    .from('sim_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Failed to clear sim history: ${error.message}`);
}
