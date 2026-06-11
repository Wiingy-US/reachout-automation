import * as XLSX from "xlsx";
import { RunRecord } from "./types";

/** Export the (filtered) runs to an XLSX workbook with Runs + Failed Checks sheets. */
export function exportRunsToXLSX(runs: RunRecord[]): void {
  if (runs.length === 0) return;

  const rows = runs.map((run) => {
    const ev = run.evaluation;
    const dur = run.duration ?? { generation_ms: 0, evaluation_ms: 0, total_ms: 0 };
    const freq = run.failed_check_frequency ?? {};
    return {
      Date: new Date(run.created_at).toLocaleString(),
      User: run.user_name,
      Campaign: run.campaign_name,
      Model: run.config?.model ?? "—",
      "Batch Size": run.config?.batch_size ?? run.generation.batch_size,
      "Total Journalists": run.generation.total_journalists,
      Generated: run.generation.succeeded,
      "Gen Failed": run.generation.failed,
      "Total Batches": run.generation.total_batches,
      "Gen Input Tokens": run.generation.input_tokens,
      "Gen Output Tokens": run.generation.output_tokens,
      "Gen Cost USD": run.generation.cost_usd,
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
      "QC Cost USD": ev.cost_usd,
      "QC Time (s)": Math.round(dur.evaluation_ms / 1000),
      "Total Tokens": run.totals.total_tokens,
      "Total Cost USD": run.totals.total_cost_usd,
      "Total Time (s)": Math.round(dur.total_ms / 1000),
      "Top Failed Checks": Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${id}×${n}`)
        .join(", "),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
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
