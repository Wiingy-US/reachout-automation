"use client";

import { QualitySummary } from "@/lib/types";

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export function SummaryBar({ summary }: { summary: QualitySummary | null }) {
  return (
    <div className="flex gap-3">
      <Card label="Evaluated" value={summary ? String(summary.evaluated) : "—"} />
      <Card label="Pass" value={summary ? String(summary.pass) : "—"} tone="text-emerald-600" />
      <Card label="Fail" value={summary ? String(summary.fail) : "—"} tone="text-red-600" />
      <Card label="Pass rate" value={summary ? `${summary.passRate}%` : "—"} />
    </div>
  );
}
