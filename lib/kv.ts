import { kv } from "@vercel/kv";
import { RunRecord, CampaignRecord } from "./types";

// Key structure:
//   runs:all        → string[] of run IDs (ordered, newest first)
//   run:{id}        → RunRecord
//   campaigns:all   → CampaignRecord[] (full list, not just IDs)

const RUNS_INDEX_KEY = "runs:all";
const CAMPAIGNS_KEY = "campaigns:all";
const MAX_RUNS = 500; // cap stored runs to avoid unbounded growth

/** KV is only available when its env vars are present (Vercel-linked store, or
 *  values copied into .env.local). Locally without them, persistence is skipped. */
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// @vercel/kv auto-serialises objects on set and parses on get, but values can
// also come back as JSON strings if they were stored that way — normalise both.
function asArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

// ── Runs ──────────────────────────────────────────────────────

export async function saveRun(record: RunRecord): Promise<void> {
  if (!isKVConfigured()) {
    console.warn("Vercel KV not configured — skipping persistence");
    return;
  }
  try {
    await kv.set(`run:${record.id}`, record);
    const existingIds = asArray<string>(await kv.get(RUNS_INDEX_KEY));
    const updatedIds = [record.id, ...existingIds].slice(0, MAX_RUNS);
    await kv.set(RUNS_INDEX_KEY, updatedIds);
  } catch (err) {
    // Never let a KV write failure break the main flow.
    console.error("KV saveRun error:", err);
  }
}

export async function getAllRuns(): Promise<RunRecord[]> {
  if (!isKVConfigured()) {
    console.warn("Vercel KV not configured — skipping persistence");
    return [];
  }
  try {
    const ids = asArray<string>(await kv.get(RUNS_INDEX_KEY));
    if (ids.length === 0) return [];
    const records = await Promise.all(
      ids.map(async (id) => asObject<RunRecord>(await kv.get(`run:${id}`)))
    );
    return records.filter(Boolean) as RunRecord[];
  } catch (err) {
    console.error("KV getAllRuns error:", err);
    return [];
  }
}

// ── Campaigns ─────────────────────────────────────────────────

export async function getCampaigns(): Promise<CampaignRecord[]> {
  if (!isKVConfigured()) {
    console.warn("Vercel KV not configured — skipping persistence");
    return [];
  }
  try {
    return asArray<CampaignRecord>(await kv.get(CAMPAIGNS_KEY));
  } catch (err) {
    console.error("KV getCampaigns error:", err);
    return [];
  }
}

export async function saveCampaign(name: string): Promise<CampaignRecord> {
  const campaign: CampaignRecord = {
    id: crypto.randomUUID(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };

  if (!isKVConfigured()) {
    console.warn("Vercel KV not configured — skipping persistence");
    return campaign;
  }

  try {
    const existing = await getCampaigns();
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === campaign.name.toLowerCase()
    );
    if (duplicate) return duplicate;
    await kv.set(CAMPAIGNS_KEY, [campaign, ...existing]);
  } catch (err) {
    console.error("KV saveCampaign error:", err);
  }

  return campaign;
}
