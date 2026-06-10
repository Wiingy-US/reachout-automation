import { Redis } from "@upstash/redis";
import { RunRecord, CampaignRecord } from "./types";

// Guard: return null if env vars not set (local dev without credentials).
function createRedisClient(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn("Upstash Redis not configured — KV features disabled");
    return null;
  }
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

export const redis = createRedisClient();

// Key structure:
//   runs:index        → string[]  ordered list of run IDs, newest first
//   run:{id}          → RunRecord
//   campaigns:all     → CampaignRecord[]

const RUNS_INDEX_KEY = "runs:index";
const CAMPAIGNS_KEY = "campaigns:all";
const MAX_RUNS = 500;

// @upstash/redis auto-serialises objects and parses JSON on read, but values
// may also come back as strings — normalise both shapes defensively.
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

// ── Runs ────────────────────────────────────────────────────────

export async function saveRun(record: RunRecord): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`run:${record.id}`, record);
    const existing = asArray<string>(await redis.get(RUNS_INDEX_KEY));
    // Dedupe so re-saving the same run id (post-generation, then post-QC)
    // updates in place instead of creating a duplicate dashboard row.
    const updated = [record.id, ...existing.filter((id) => id !== record.id)].slice(0, MAX_RUNS);
    await redis.set(RUNS_INDEX_KEY, updated);
  } catch (err) {
    console.error("Redis saveRun error:", err);
  }
}

export async function getAllRuns(): Promise<RunRecord[]> {
  if (!redis) return [];
  try {
    const ids = asArray<string>(await redis.get(RUNS_INDEX_KEY));
    if (ids.length === 0) return [];
    const records = await Promise.all(
      ids.map(async (id) => asObject<RunRecord>(await redis!.get(`run:${id}`)))
    );
    return records.filter(Boolean) as RunRecord[];
  } catch (err) {
    console.error("Redis getAllRuns error:", err);
    return [];
  }
}

// ── Campaigns ───────────────────────────────────────────────────

export async function getCampaigns(): Promise<CampaignRecord[]> {
  if (!redis) return [];
  try {
    return asArray<CampaignRecord>(await redis.get(CAMPAIGNS_KEY));
  } catch (err) {
    console.error("Redis getCampaigns error:", err);
    return [];
  }
}

export async function saveCampaign(name: string): Promise<CampaignRecord> {
  const { v4: uuidv4 } = await import("uuid");
  const campaign: CampaignRecord = {
    id: uuidv4(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };
  if (!redis) return campaign;
  try {
    const existing = await getCampaigns();
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === campaign.name.toLowerCase()
    );
    if (duplicate) return duplicate;
    await redis.set(CAMPAIGNS_KEY, [campaign, ...existing]);
  } catch (err) {
    console.error("Redis saveCampaign error:", err);
  }
  return campaign;
}
