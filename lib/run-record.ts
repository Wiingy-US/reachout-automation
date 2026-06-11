import { GeneratedEmail, RunRecord, SessionTokenSummary } from "./types";

// Assembles a RunRecord from session state. Called from page.tsx after
// generation + QC complete (wiring is a later change — this PR is the data
// foundation only).
//
// Note: this codebase stores quality results on each GeneratedEmail
// (`email.quality.verdict`), not in a separate Map, so the params reflect that.
export function buildRunRecord(params: {
  id?: string; // stable session run id so post-generation + post-QC saves update the same record
  user_name: string;
  campaign_name: string;
  total_journalists: number;
  batch_size: number;
  generated_emails: GeneratedEmail[];
  token_summary: SessionTokenSummary;
  generation_duration_ms?: number;
  qc_duration_ms?: number;
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
  } = params;

  const succeeded = generated_emails.filter((e) => e.status === "generated").length;
  const failed = generated_emails.filter((e) => e.status === "generation_failed").length;
  const total_batches = batch_size > 0 ? Math.ceil(total_journalists / batch_size) : 0;

  const evaluated = generated_emails.filter((e) => e.quality);
  const qc_passed = evaluated.filter((e) => e.quality!.verdict === "PASS").length;
  const qc_failed = evaluated.filter((e) => e.quality!.verdict === "FAIL").length;
  const total_evaluated = qc_passed + qc_failed;
  const pass_rate =
    total_evaluated > 0 ? Math.round((qc_passed / total_evaluated) * 100) : 0;

  const gen = token_summary.breakdown.email_generation;
  const qc = token_summary.breakdown.quality_check;

  return {
    id: id ?? crypto.randomUUID(),
    created_at: new Date().toISOString(),
    user_name,
    campaign_name,
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
      passed: qc_passed,
      failed: qc_failed,
      pass_rate,
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
