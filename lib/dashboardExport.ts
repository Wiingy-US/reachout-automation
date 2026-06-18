import * as XLSX from "xlsx";
import { RunRecord } from "./types";
import { USD_TO_INR } from "./costs";

const inr = (usd: number) => Math.round(usd * USD_TO_INR * 100) / 100;
const thinking = (b: { total_tokens: number; input_tokens: number; output_tokens: number }) =>
  Math.max(0, b.total_tokens - b.input_tokens - b.output_tokens);

/** Export the (filtered) runs to an XLSX workbook with Runs + Failed Checks sheets. */
export function exportRunsToXLSX(runs: RunRecord[]): void {
  if (runs.length === 0) return;

  const rows = runs.map((run) => {
    const g = run.generation;
    const ev = run.evaluation;
    const dur = run.duration ?? { generation_ms: 0, evaluation_ms: 0, total_ms: 0 };
    const freq = run.failed_check_frequency ?? {};
    return {
      Date: new Date(run.created_at).toLocaleString(),
      User: run.user_name,
      Campaign: run.campaign_name,
      Model: run.config?.model ?? "—",
      "Batch Size": run.config?.batch_size ?? g.batch_size,
      "Total Journalists": g.total_journalists,
      Generated: g.succeeded,
      "Gen Failed": g.failed,
      "Total Batches": g.total_batches,
      "Gen Input Tokens": g.input_tokens,
      "Gen Output Tokens": g.output_tokens,
      "Gen Thinking Tokens": thinking(g),
      "Gen Total Tokens": g.total_tokens,
      "Gen Cost INR": inr(g.cost_usd),
      "Gen Cost USD": g.cost_usd,
      "Gen Time (s)": Math.round(dur.generation_ms / 1000),
      Evaluated: ev.evaluated ?? ev.total_evaluated,
      "Was Sampled": ev.was_sampled ? "Yes" : "No",
      "Sample Method": ev.sample_method ?? "—",
      "Not Evaluated": ev.not_evaluated ?? 0,
      "QC Passed": ev.passed,
      "QC Failed": ev.failed,
      "Pass Rate %": ev.pass_rate,
      "Avg L1 Score": ev.avg_l1_score ?? "—",
      "Avg L2 Score": ev.avg_l2_score === -1 || ev.avg_l2_score == null ? "N/A" : ev.avg_l2_score,
      "L2 Skipped": ev.l2_skipped_count ?? 0,
      "QC Input Tokens": ev.input_tokens,
      "QC Output Tokens": ev.output_tokens,
      "QC Thinking Tokens": thinking(ev),
      "QC Total Tokens": ev.total_tokens,
      "QC Cost INR": inr(ev.cost_usd),
      "QC Cost USD": ev.cost_usd,
      "Grand Total Tokens": run.totals.total_tokens,
      "Total Cost INR": inr(run.totals.total_cost_usd),
      "Total Cost USD": run.totals.total_cost_usd,
      "Total Time (s)": Math.round(dur.total_ms / 1000),
      "Top Failed Checks": Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${id}×${n}`)
        .join(", "),
    };
  });

  // Note cell at A1, blank row, then table starting at A3.
  const ws = XLSX.utils.aoa_to_sheet([[`Exchange rate used: 1 USD = ${USD_TO_INR} INR`]]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((key) => ({ wch: Math.max(key.length + 2, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Runs");

  // Aggregate failed-check frequency across all filtered runs.
  const aggFailed: Record<string, number> = {};
  for (const run of runs) {
    for (const [id, n] of Object.entries(run.failed_check_frequency ?? {})) {
      aggFailed[id] = (aggFailed[id] ?? 0) + n;
    }
  }
  const failedRows = Object.entries(aggFailed)
    .sort((a, b) => b[1] - a[1])
    .map(([check_id, count]) => ({ "Check ID": check_id, "Total Failures": count }));
  if (failedRows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(failedRows);
    ws2["!cols"] = [{ wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Failed Checks");
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `dashboard_runs_${dateStr}.xlsx`);
}
