// Gemini pricing + cost/token helpers (verified against Google's published
// Gemini 2.5 Flash rates: $0.30 / 1M input tokens, $2.50 / 1M output tokens —
// i.e. $0.0003 / 1K input, $0.0025 / 1K output).
// See https://ai.google.dev/gemini-api/docs/pricing — estimates only, actual
// billing may differ (audio input, cache reads, batch discounts, etc.).

import {
  CostEstimate,
  OperationTokenRecord,
  SessionTokenSummary,
  TokenUsage,
} from "./types";

export const GEMINI_PRICING = {
  model: "gemini-2.5-flash",
  // Price per 1,000 tokens in USD.
  input_per_1k_tokens: 0.0003, // $0.30 / 1M input tokens
  output_per_1k_tokens: 0.0025, // $2.50 / 1M output tokens
  // Note: these are approximate — actual billing may differ.
};

export function calculateCost(usage: TokenUsage): CostEstimate {
  const input_cost_usd = (usage.input_tokens / 1000) * GEMINI_PRICING.input_per_1k_tokens;
  const output_cost_usd = (usage.output_tokens / 1000) * GEMINI_PRICING.output_per_1k_tokens;
  return {
    input_cost_usd,
    output_cost_usd,
    total_cost_usd: input_cost_usd + output_cost_usd,
  };
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/** Table variant: shows "—" for zero (used in the dashboard runs table). */
export function formatCostTable(usd: number): string {
  if (usd === 0) return "—";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(3)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** Build a token record (cost + timestamp) for a single AI operation. */
export function toTokenRecord(
  operation: OperationTokenRecord["operation"],
  usage: TokenUsage,
  extra?: { batch_index?: number; journalist_email?: string }
): OperationTokenRecord {
  return {
    operation,
    ...extra,
    token_usage: usage,
    cost_estimate: calculateCost(usage),
    timestamp: new Date().toISOString(),
  };
}

const EMPTY: TokenUsage & CostEstimate = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  input_cost_usd: 0,
  output_cost_usd: 0,
  total_cost_usd: 0,
};

function accumulate(
  acc: TokenUsage & CostEstimate,
  r: OperationTokenRecord
): TokenUsage & CostEstimate {
  return {
    input_tokens: acc.input_tokens + r.token_usage.input_tokens,
    output_tokens: acc.output_tokens + r.token_usage.output_tokens,
    total_tokens: acc.total_tokens + r.token_usage.total_tokens,
    input_cost_usd: acc.input_cost_usd + r.cost_estimate.input_cost_usd,
    output_cost_usd: acc.output_cost_usd + r.cost_estimate.output_cost_usd,
    total_cost_usd: acc.total_cost_usd + r.cost_estimate.total_cost_usd,
  };
}

/** Derive the full session summary from the accumulated token records. */
export function computeSessionSummary(records: OperationTokenRecord[]): SessionTokenSummary {
  const gen = { ...EMPTY };
  const qc = { ...EMPTY };
  let input = 0;
  let output = 0;
  let total = 0;
  let cost = 0;

  for (const r of records) {
    input += r.token_usage.input_tokens;
    output += r.token_usage.output_tokens;
    total += r.token_usage.total_tokens;
    cost += r.cost_estimate.total_cost_usd;
    if (r.operation === "email_generation") Object.assign(gen, accumulate(gen, r));
    else if (r.operation === "quality_check_layer2") Object.assign(qc, accumulate(qc, r));
  }

  return {
    records,
    totals: {
      input_tokens: input,
      output_tokens: output,
      total_tokens: total,
      total_cost_usd: cost,
    },
    breakdown: {
      email_generation: gen,
      quality_check: qc,
    },
  };
}
