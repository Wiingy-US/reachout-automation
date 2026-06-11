import { GeneratedEmail, RunRecord, SessionTokenSummary } from "./types";

// Assembles a RunRecord from session state. This codebase stores quality on
// each GeneratedEmail (`email.quality`), so params reflect that.
export function buildRunRecord(params: {
  id?: string;
  user_name: string;
  campaign_name: string;
  total_journalists: number;
  batch_size: number;
  generated_emails: GeneratedEmail[];
  token_summary: SessionTokenSummary;
  generation_duration_ms?: number;
  qc_duration_ms?: number;
  generation_prompt?: string;
  data_facts_summary?: string;
  model?: string;
  sample_method?: string;
}): RunRecord {
  const {
    id,
    user_name,
    campaign_name,
    total_journalists,
    batch_size,
    generated_emails,
    token_summary,
    generation_duration_ms = 0,
    qc_duration_ms = 0,
    generation_prompt = "",
    data_facts_summary = "",
    model = "gemini-2.5-flash",
    sample_method,
  } = params;

  const succeeded = generated_emails.filter((e) => e.status === "generated").length;
  const failed = generated_emails.filter((e) => e.status === "generation_failed").length;
  const total_batches = batch_size > 0 ? Math.ceil(total_journalists / batch_size) : 0;

  const evaluatedEmails = generated_emails.filter((e) => e.quality);
  const total_evaluated = evaluatedEmails.length;
  const qc_passed = evaluatedEmails.filter((e) => e.quality!.verdict === "PASS").length;
  const qc_failed = total_evaluated - qc_passed;
  const pass_rate = total_evaluated > 0 ? Math.round((qc_passed / total_evaluated) * 100) : 0;
  const was_sampled = total_evaluated < succeeded;
  const not_evaluated = Math.max(0, succeeded - total_evaluated);
  const l2_skipped_count = evaluatedEmails.filter((e) => e.quality!.layer2Skipped).length;

  const l1Scores = evaluatedEmails.map((e) => e.quality!.layer1_score);
  const avg_l1_score =
    l1Scores.length > 0 ? Math.round(l1Scores.reduce((a, b) => a + b, 0) / l1Scores.length) : 0;
  const l2Scores = evaluatedEmails
    .filter((e) => !e.quality!.layer2Skipped && e.quality!.layer2_score >= 0)
    .map((e) => e.quality!.layer2_score);
  const avg_l2_score =
    l2Scores.length > 0 ? Math.round(l2Scores.reduce((a, b) => a + b, 0) / l2Scores.length) : -1;

  // Count failed check ids across all evaluated emails.
  const failed_check_frequency: Record<string, number> = {};
  for (const e of evaluatedEmails) {
    const q = e.quality!;
    for (const c of [...q.layer1, ...q.layer2]) {
      if (!c.pass) failed_check_frequency[c.check_id] = (failed_check_frequency[c.check_id] ?? 0) + 1;
    }
  }

  const gen = token_summary.breakdown.email_generation;
  const qc = token_summary.breakdown.quality_check;

  return {
    id: id ?? crypto.randomUUID(),
    created_at: new Date().toISOString(),
    user_name,
    campaign_name,
    config: {
      batch_size,
      model,
      generation_prompt_length: generation_prompt.length,
      data_facts_length: data_facts_summary.length,
    },
    failed_check_frequency,
    generation: {
      total_journalists,
      batch_size,
      total_batches,
      succeeded,
      failed,
      input_tokens: gen.input_tokens,
      output_tokens: gen.output_tokens,
      total_tokens: gen.total_tokens,
      cost_usd: gen.total_cost_usd,
    },
    evaluation: {
      total_evaluated,
      evaluated: total_evaluated,
      total_journalists,
      sample_size: total_evaluated,
      sample_method: sample_method ?? (was_sampled ? "random" : "all"),
      passed: qc_passed,
      failed: qc_failed,
      pass_rate,
      avg_l1_score,
      avg_l2_score,
      l2_skipped_count,
      was_sampled,
      not_evaluated,
      input_tokens: qc.input_tokens,
      output_tokens: qc.output_tokens,
      total_tokens: qc.total_tokens,
      cost_usd: qc.total_cost_usd,
    },
    totals: {
      total_tokens: token_summary.totals.total_tokens,
      total_cost_usd: token_summary.totals.total_cost_usd,
    },
    duration: {
      generation_ms: generation_duration_ms,
      evaluation_ms: qc_duration_ms,
      total_ms: generation_duration_ms + qc_duration_ms,
    },
  };
}
