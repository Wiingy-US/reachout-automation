"use client";

import { useEffect, useMemo, useState } from "react";
import { RunRecord } from "@/lib/types";
import { formatCost, formatTokens } from "@/lib/costs";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function passRateClass(p: number): string {
  if (p >= 70) return "text-green-700 bg-green-50";
  if (p >= 50) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

type SortKey =
  | "created_at" | "user_name" | "campaign_name" | "journalists" | "batches"
  | "generated" | "evaluated" | "pass_rate" | "gen_tokens" | "gen_cost"
  | "qc_tokens" | "qc_cost" | "total_cost";

const ACCESSORS: Record<SortKey, (r: RunRecord) => number | string> = {
  created_at: (r) => r.created_at,
  user_name: (r) => r.user_name.toLowerCase(),
  campaign_name: (r) => r.campaign_name.toLowerCase(),
  journalists: (r) => r.generation.total_journalists,
  batches: (r) => r.generation.total_batches,
  generated: (r) => r.generation.succeeded,
  evaluated: (r) => r.evaluation.total_evaluated,
  pass_rate: (r) => r.evaluation.pass_rate,
  gen_tokens: (r) => r.generation.total_tokens,
  gen_cost: (r) => r.generation.cost_usd,
  qc_tokens: (r) => r.evaluation.total_tokens,
  qc_cost: (r) => r.evaluation.cost_usd,
  total_cost: (r) => r.totals.total_cost_usd,
};

// label, sortKey, hide-on-mobile
const COLUMNS: { key: SortKey; label: string; hideMobile: boolean }[] = [
  { key: "created_at", label: "Date/Time", hideMobile: false },
  { key: "user_name", label: "User", hideMobile: true },
  { key: "campaign_name", label: "Campaign", hideMobile: false },
  { key: "journalists", label: "Journalists", hideMobile: true },
  { key: "batches", label: "Batches", hideMobile: true },
  { key: "generated", label: "Generated", hideMobile: true },
  { key: "evaluated", label: "Evaluated", hideMobile: true },
  { key: "pass_rate", label: "Pass Rate", hideMobile: false },
  { key: "gen_tokens", label: "Gen Tokens", hideMobile: true },
  { key: "gen_cost", label: "Gen Cost", hideMobile: true },
  { key: "qc_tokens", label: "QC Tokens", hideMobile: true },
  { key: "qc_cost", label: "QC Cost", hideMobile: true },
  { key: "total_cost", label: "Total Cost", hideMobile: false },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [campaignFilter, setCampaignFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [fromDate, setFromDate] = useState(isoDaysAgo(30));
  const [toDate, setToDate] = useState(todayIso());

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/runs");
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (active) setRuns(data.runs ?? []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const campaignOptions = useMemo(
    () => ["All", ...Array.from(new Set(runs.map((r) => r.campaign_name)))],
    [runs]
  );
  const userOptions = useMemo(
    () => ["All", ...Array.from(new Set(runs.map((r) => r.user_name)))],
    [runs]
  );

  const filtered = useMemo(() => {
    const out = runs.filter((r) => {
      if (campaignFilter !== "All" && r.campaign_name !== campaignFilter) return false;
      if (userFilter !== "All" && r.user_name !== userFilter) return false;
      const day = r.created_at.slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });
    const acc = ACCESSORS[sortKey];
    out.sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [runs, campaignFilter, userFilter, fromDate, toDate, sortKey, sortDir]);

  // Summary across ALL runs (not filtered), per spec.
  const summary = useMemo(() => {
    const totalRuns = runs.length;
    const totalJournalists = runs.reduce((s, r) => s + r.generation.total_journalists, 0);
    const avgPassRate =
      totalRuns > 0 ? Math.round(runs.reduce((s, r) => s + r.evaluation.pass_rate, 0) / totalRuns) : 0;
    const totalCost = runs.reduce((s, r) => s + r.totals.total_cost_usd, 0);
    return { totalRuns, totalJournalists, avgPassRate, totalCost };
  }, [runs]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setCampaignFilter("All");
    setUserFilter("All");
    setFromDate(isoDaysAgo(30));
    setToDate(todayIso());
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatCard label="Total Runs" value={String(summary.totalRuns)} />
        <StatCard label="Journalists Processed" value={String(summary.totalJournalists)} />
        <StatCard label="Avg Pass Rate" value={`${summary.avgPassRate}%`} />
        <StatCard label="Total Cost" value={formatCost(summary.totalCost)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-xs text-slate-500">
          Campaign
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          >
            {campaignOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          User
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          >
            {userOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <label className="text-xs text-slate-500">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <button type="button" onClick={clearFilters} className="text-xs font-medium text-brand hover:underline">
          Clear filters
        </button>
      </div>

      {/* Table / states */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Could not load run history. Check that Upstash Redis is connected in Vercel.
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <div className="text-3xl">🗂️</div>
          <div className="mt-2 font-semibold text-slate-700">No runs yet</div>
          <p className="mt-1 text-sm text-slate-500">
            Complete a generation and quality check to see your run history here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`cursor-pointer select-none px-3 py-2 whitespace-nowrap hover:text-slate-700 ${
                        col.hideMobile ? "hidden md:table-cell" : ""
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtDateTime(r.created_at)}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{r.user_name}</td>
                    <td className="px-3 py-2 text-slate-800">{r.campaign_name}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{r.generation.total_journalists}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell whitespace-nowrap">
                      {r.generation.total_batches} <span className="text-slate-400">· bs {r.generation.batch_size}</span>
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell whitespace-nowrap">
                      <span className="text-slate-700">{r.generation.succeeded}</span>
                      <span className="text-slate-400">/{r.generation.succeeded + r.generation.failed}</span>
                      {r.generation.failed > 0 && (
                        <span className="text-red-600"> ({r.generation.failed} failed)</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{r.evaluation.total_evaluated}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${passRateClass(r.evaluation.pass_rate)}`}>
                        {r.evaluation.pass_rate}%
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{formatTokens(r.generation.total_tokens)}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{formatCost(r.generation.cost_usd)}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{formatTokens(r.evaluation.total_tokens)}</td>
                    <td className="hidden px-3 py-2 text-slate-600 md:table-cell">{formatCost(r.evaluation.cost_usd)}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{formatCost(r.totals.total_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">No runs match the current filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
