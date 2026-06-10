"use client";

import { useState } from "react";
import { SessionTokenSummary, TokenUsage, CostEstimate } from "@/lib/types";
import { formatCost, formatTokens } from "@/lib/costs";

type Row = TokenUsage & CostEstimate;

function BreakdownRow({ label, row }: { label: string; row: Row }) {
  return (
    <tr className="border-b border-light-border dark:border-dark-border last:border-0">
      <td className="py-1 pr-2 text-light-text2 dark:text-dark-text2">{label}</td>
      <td className="py-1 px-2 text-right tabular-nums text-light-text dark:text-dark-text2">{formatTokens(row.input_tokens)}</td>
      <td className="py-1 px-2 text-right tabular-nums text-light-text dark:text-dark-text2">{formatTokens(row.output_tokens)}</td>
      <td className="py-1 pl-2 text-right tabular-nums text-light-text dark:text-dark-text2">{formatCost(row.total_cost_usd)}</td>
    </tr>
  );
}

export function TokenCostPanel({ summary }: { summary: SessionTokenSummary }) {
  const [open, setOpen] = useState(false);

  // Only render once at least one AI operation has run.
  if (summary.records.length === 0) return null;

  const { totals, breakdown } = summary;

  return (
    // Offset up from the bottom so it never overlaps the Download CSV button.
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-2 w-80 rounded-2xl border border-light-border bg-light-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-dark-border dark:bg-dark-surface">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
            Session Token Usage
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-light-text3 dark:text-dark-text3">
                <th className="py-1 pr-2 text-left"></th>
                <th className="py-1 px-2 text-right">Input</th>
                <th className="py-1 px-2 text-right">Output</th>
                <th className="py-1 pl-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              <BreakdownRow label="Email Generation" row={breakdown.email_generation} />
              <BreakdownRow label="Quality Check" row={breakdown.quality_check} />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-light-border dark:border-dark-border font-semibold">
                <td className="py-1 pr-2 text-light-text dark:text-dark-text">TOTAL</td>
                <td className="py-1 px-2 text-right tabular-nums text-light-text dark:text-dark-text">
                  {formatTokens(totals.input_tokens)}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-light-text dark:text-dark-text">
                  {formatTokens(totals.output_tokens)}
                </td>
                <td className="py-1 pl-2 text-right font-bold tabular-nums text-brand">
                  ~{formatCost(totals.total_cost_usd)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-3 flex items-center justify-between border-t border-light-border dark:border-dark-border pt-2 text-[11px] text-light-text3 dark:text-dark-text3">
            <span>Gemini 2.5 Flash · estimates only</span>
            <a
              href="https://ai.google.dev/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              View current pricing ↗
            </a>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-dark-surface px-3.5 py-1.5 text-[13px] font-medium text-white shadow-lg hover:opacity-90 dark:bg-dark-surface2 dark:text-dark-text dark:border dark:border-dark-border"
        title="Token usage & estimated cost (click to toggle)"
      >
        <span>
          <span className="text-brand-mid">⚡</span> {formatTokens(totals.total_tokens)} tokens
        </span>
        <span className="text-white/70 dark:text-dark-text2">~{formatCost(totals.total_cost_usd)} total</span>
        <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
    </div>
  );
}
