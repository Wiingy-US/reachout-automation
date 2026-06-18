"use client";

import { useState } from "react";
import { SessionTokenSummary, TokenUsage, CostEstimate } from "@/lib/types";
import { formatINR, formatUSD, formatTokensExact } from "@/lib/costs";

type Row = TokenUsage & CostEstimate;

// Thinking is disabled (budget 0); derive it defensively so it surfaces if it
// ever leaks (total beyond input+output).
function thinkingOf(row: { total_tokens: number; input_tokens: number; output_tokens: number }) {
  return Math.max(0, row.total_tokens - row.input_tokens - row.output_tokens);
}

function SectionRows({ label, row }: { label: string; row: Row }) {
  const thinking = thinkingOf(row);
  const sub = (name: string, value: number, warn = false) => (
    <tr>
      <td className="py-0.5 pl-3 pr-2 text-light-text2 dark:text-dark-text2">{name}</td>
      <td className="py-0.5 pl-2 text-right tabular-nums text-light-text dark:text-dark-text">
        {formatTokensExact(value)}
        {warn && <span className="ml-1 text-warning-text">⚠</span>}
      </td>
    </tr>
  );
  return (
    <>
      <tr>
        <td colSpan={2} className="pt-1.5 font-semibold text-light-text dark:text-dark-text">{label}</td>
      </tr>
      {sub("Input", row.input_tokens)}
      {sub("Output", row.output_tokens)}
      {thinking > 0 && sub("Thinking", thinking, true)}
    </>
  );
}

export function TokenCostPanel({ summary }: { summary: SessionTokenSummary }) {
  const [open, setOpen] = useState(false);
  if (summary.records.length === 0) return null;
  const { totals, breakdown } = summary;

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-2 w-80 rounded-2xl border border-light-border bg-light-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-dark-border dark:bg-dark-surface">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
            Token Usage
          </div>
          <table className="w-full text-xs">
            <tbody>
              <SectionRows label="Generation" row={breakdown.email_generation} />
              <SectionRows label="Quality Check" row={breakdown.quality_check} />
              <tr className="border-t-2 border-light-border font-semibold dark:border-dark-border">
                <td className="py-1 text-light-text dark:text-dark-text">TOTAL</td>
                <td className="py-1 pl-2 text-right tabular-nums text-light-text dark:text-dark-text">
                  {formatTokensExact(totals.total_tokens)}
                </td>
              </tr>
              <tr>
                <td className="text-light-text3 dark:text-dark-text3">Cost (est.)</td>
                <td className="pl-2 text-right">
                  <div className="font-bold text-brand dark:text-[#7B8FE8]">{formatINR(totals.total_cost_usd)}</div>
                  <div className="text-[10px] text-light-text3 dark:text-dark-text3">({formatUSD(totals.total_cost_usd)})</div>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-between border-t border-light-border pt-2 text-[11px] text-light-text3 dark:border-dark-border dark:text-dark-text3">
            <span>Gemini 2.5 Flash · estimates only</span>
            <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              Pricing ↗
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
          <span className="text-brand-mid">⚡</span> {formatTokensExact(totals.total_tokens)} tokens
        </span>
        <span className="text-white/70 dark:text-dark-text2">{formatINR(totals.total_cost_usd)}</span>
        <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
    </div>
  );
}
