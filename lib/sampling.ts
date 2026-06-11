// Sampling + cost-estimation helpers for quality evaluation.

import { GeneratedEmail } from "./types";
import { formatCost } from "./costs";

// Default token/cost assumptions for the Layer 2 judge (per email).
export const JUDGE_TOKEN_ESTIMATES = {
  judgeInputTokensPerEmail: 900,
  judgeOutputTokensPerEmail: 280,
  inputCostPer1k: 0.0003,
  outputCostPer1k: 0.0025,
  judgeBatchSize: 5,
};

/** Random subset of successfully-generated emails (Fisher-Yates shuffle). */
export function randomSample(emails: GeneratedEmail[], n: number): GeneratedEmail[] {
  const eligible = emails.filter((e) => e.status === "generated");
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
}

export interface EvalCostEstimate {
  estimated_calls: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number;
  formatted: string;
}

export function estimateEvaluationCost(opts: {
  sampleSize: number;
  judgeInputTokensPerEmail?: number;
  judgeOutputTokensPerEmail?: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  judgeBatchSize?: number;
}): EvalCostEstimate {
  const {
    sampleSize,
    judgeInputTokensPerEmail = JUDGE_TOKEN_ESTIMATES.judgeInputTokensPerEmail,
    judgeOutputTokensPerEmail = JUDGE_TOKEN_ESTIMATES.judgeOutputTokensPerEmail,
    inputCostPer1k = JUDGE_TOKEN_ESTIMATES.inputCostPer1k,
    outputCostPer1k = JUDGE_TOKEN_ESTIMATES.outputCostPer1k,
    judgeBatchSize = JUDGE_TOKEN_ESTIMATES.judgeBatchSize,
  } = opts;

  const estimated_calls = sampleSize > 0 ? Math.ceil(sampleSize / judgeBatchSize) : 0;
  const estimated_input_tokens = sampleSize * judgeInputTokensPerEmail;
  const estimated_output_tokens = sampleSize * judgeOutputTokensPerEmail;
  const estimated_cost_usd =
    (estimated_input_tokens / 1000) * inputCostPer1k +
    (estimated_output_tokens / 1000) * outputCostPer1k;

  return {
    estimated_calls,
    estimated_input_tokens,
    estimated_output_tokens,
    estimated_cost_usd,
    formatted: `~${formatCost(estimated_cost_usd)}`,
  };
}
