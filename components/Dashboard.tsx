"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { RunRecord, CampaignRecord, UserRecord } from "@/lib/types";
import { formatTokens, formatCostTable } from "@/lib/costs";
import { formatDuration } from "@/lib/utils";
import { getCheck } from "@/lib/rubric";
import { getDatePreset, DatePreset } from "@/lib/datePresets";
import { exportRunsToXLSX } from "@/lib/dashboardExport";
import { ScorePill } from "./ui";

// ---- helpers ----
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const evald = (r: RunRecord) => r.evaluation.evaluated ?? r.evaluation.total_evaluated ?? 0;
const tierColor = (id: string) => {
  const t = getCheck(id)?.tier;
  return t === "critical" ? "#EF4444" : t === "major" ? "#F59E0B" : "#9CA3AF";
};
function passRateClass(p: number): string {
  if (p >= 70) return "text-[#15803D] bg-success-light dark:bg-[#14532D] dark:text-[#86EFAC]";
  if (p >= 50) return "text-[#B45309] bg-warning-light dark:bg-[#78350F] dark:text-[#FCD34D]";
  return "text-[#DC2626] bg-danger-light dark:bg-[#7F1D1D] dark:text-[#FCA5A5]";
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-xl border border-light-border bg-light-surface px-5 py-4 dark:border-dark-border dark:bg-dark-surface dark:shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-light-text2 dark:text-dark-text3">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-brand dark:text-[#7B8FE8]" : "text-light-text dark:text-dark-text"}`}>
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
      <div className="mb-2 text-sm font-semibold text-light-text dark:text-dark-text">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-light-text3 dark:text-dark-text3">{label}: </span>
      <span className="text-light-text dark:text-dark-text">{value}</span>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-light-text2 dark:text-dark-text2 first:mt-0">
      {children}
    </div>
  );
}

export function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  // Dark mode (recharts needs explicit colours; recolour on theme toggle).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [r, c, u] = await Promise.all([
          fetch("/api/runs"),
          fetch("/api/campaigns"),
          fetch("/api/users"),
        ]);
        if (!r.ok) throw new Error("bad status");
        const rd = await r.json();
        const cd = await c.json().catch(() => ({ campaigns: [] }));
        const ud = await u.json().catch(() => ({ users: [] }));
        if (active) {
          setRuns(rd.runs ?? []);
          setCampaigns(cd.campaigns ?? []);
          setUsers(ud.users ?? []);
        }
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
    () => ["all", ...Array.from(new Set([...campaigns.map((c) => c.name), ...runs.map((r) => r.campaign_name)]))],
    [campaigns, runs]
  );
  const userOptions = useMemo(
    () => ["all", ...Array.from(new Set([...users.map((u) => u.name), ...runs.map((r) => r.user_name)]))],
    [users, runs]
  );

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const t = new Date(run.created_at).getTime();
      if (fromDate && t < new Date(fromDate).getTime()) return false;
      if (toDate && t > new Date(toDate).getTime()) return false;
      if (campaignFilter !== "all" && run.campaign_name !== campaignFilter) return false;
      if (userFilter !== "all" && run.user_name !== userFilter) return false;
      return true;
    });
  }, [runs, fromDate, toDate, campaignFilter, userFilter]);

  const filtersActive =
    !!fromDate || !!toDate || campaignFilter !== "all" || userFilter !== "all";

  // Summary (filtered).
  const summary = useMemo(() => {
    const n = filteredRuns.length;
    const journalists = filteredRuns.reduce((s, r) => s + r.generation.total_journalists, 0);
    const evaluated = filteredRuns.reduce((s, r) => s + evald(r), 0);
    const avgPass = n ? Math.round(filteredRuns.reduce((s, r) => s + r.evaluation.pass_rate, 0) / n) : 0;
    const l1 = n ? Math.round(filteredRuns.reduce((s, r) => s + (r.evaluation.avg_l1_score ?? 0), 0) / n) : 0;
    const l2runs = filteredRuns.filter((r) => (r.evaluation.avg_l2_score ?? -1) >= 0);
    const l2 = l2runs.length
      ? Math.round(l2runs.reduce((s, r) => s + (r.evaluation.avg_l2_score ?? 0), 0) / l2runs.length)
      : -1;
    const spend = filteredRuns.reduce((s, r) => s + r.totals.total_cost_usd, 0);
    return { n, journalists, evaluated, avgPass, l1, l2, spend };
  }, [filteredRuns]);

  // Chart data (oldest → newest).
  const chrono = useMemo(
    () => [...filteredRuns].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [filteredRuns]
  );
  const timeSeries = chrono.map((r) => ({
    date: fmtDay(r.created_at),
    campaign: r.campaign_name,
    pass_rate: r.evaluation.pass_rate,
    cost: Number(r.totals.total_cost_usd.toFixed(4)),
    tokens: r.totals.total_tokens,
    l1: r.evaluation.avg_l1_score ?? 0,
    l2: (r.evaluation.avg_l2_score ?? -1) >= 0 ? r.evaluation.avg_l2_score : null,
  }));
  const topFailing = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const r of filteredRuns) {
      for (const [id, n] of Object.entries(r.failed_check_frequency ?? {})) agg[id] = (agg[id] ?? 0) + n;
    }
    return Object.entries(agg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([check_id, count]) => ({ check_id, count }));
  }, [filteredRuns]);

  const axisColor = isDark ? "#AAAAAA" : "#6B7280";
  const gridColor = isDark ? "#333333" : "#E5E7EB";
  const tooltipStyle = {
    backgroundColor: isDark ? "#1A1A1A" : "#FFFFFF",
    border: `1px solid ${gridColor}`,
    color: isDark ? "#ECECEC" : "#1A1A2E",
    borderRadius: 8,
    fontSize: 12,
  };

  function applyPreset(p: DatePreset) {
    const { from, to } = getDatePreset(p);
    setFromDate(from);
    setToDate(to);
  }
  function clearFilters() {
    setFromDate(null);
    setToDate(null);
    setCampaignFilter("all");
    setUserFilter("all");
  }
  function toggleRow(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // datetime-local needs "YYYY-MM-DDTHH:mm"; convert from stored ISO.
  const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

  return (
    <div className="space-y-5">
      {/* A — Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">Dashboard</h1>
        <button
          type="button"
          onClick={() => exportRunsToXLSX(filteredRuns)}
          disabled={filteredRuns.length === 0}
          title={filteredRuns.length === 0 ? "No runs to export" : "Export current view to Excel"}
          className="inline-flex items-center gap-2 rounded-lg border border-brand bg-transparent px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-brand/10"
        >
          ↓ Export to Excel
        </button>
      </div>

      {/* B — Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-light-border bg-light-surface p-3 dark:border-dark-border dark:bg-dark-surface">
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          From
          <input
            type="datetime-local"
            value={toLocalInput(fromDate)}
            onChange={(e) => setFromDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface px-2 py-1.5 text-sm text-light-text focus:border-brand focus:outline-none dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          />
        </label>
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          To
          <input
            type="datetime-local"
            value={toLocalInput(toDate)}
            onChange={(e) => setToDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface px-2 py-1.5 text-sm text-light-text focus:border-brand focus:outline-none dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          />
        </label>
        <div className="flex gap-1">
          {(["today", "7days", "30days", "all"] as DatePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-light-border px-2 py-1.5 text-xs text-light-text2 hover:bg-light-surface2 dark:border-dark-border dark:text-dark-text2 dark:hover:bg-dark-surface2"
            >
              {p === "today" ? "Today" : p === "7days" ? "7 Days" : p === "30days" ? "30 Days" : "All"}
            </button>
          ))}
        </div>
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          Campaign
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface px-2 py-1.5 text-sm text-light-text focus:border-brand focus:outline-none dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          >
            {campaignOptions.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All Campaigns" : c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          User
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface px-2 py-1.5 text-sm text-light-text focus:border-brand focus:outline-none dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          >
            {userOptions.map((u) => (
              <option key={u} value={u}>{u === "all" ? "All Users" : u}</option>
            ))}
          </select>
        </label>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-xs font-medium text-brand hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-3">
          <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 flex-1 animate-pulse rounded-xl bg-light-surface2 dark:bg-dark-surface2" />)}</div>
          <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-light-surface2 dark:bg-dark-surface2" />)}</div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-light p-6 text-center dark:border-danger dark:bg-[#2D0A0A]">
          <div className="font-semibold text-danger-text dark:text-[#FCA5A5]">Could not load run history.</div>
          <p className="mt-1 text-sm text-danger-text dark:text-[#FCA5A5]">Check that Upstash Redis is connected in Vercel → Storage.</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-light-border bg-light-surface p-10 text-center dark:border-dark-border dark:bg-dark-surface">
          <div className="text-4xl">🗂️</div>
          <div className="mt-2 font-semibold text-light-text dark:text-dark-text">No runs yet</div>
          <p className="mt-1 text-sm text-light-text2 dark:text-dark-text2">Complete a generation run to see history here.</p>
        </div>
      ) : (
        <>
          {/* C — Summary cards */}
          <div className="flex flex-wrap gap-3">
            <StatCard label="Total Runs" value={String(summary.n)} />
            <StatCard label="Journalists" value={String(summary.journalists)} />
            <StatCard label="Emails Evaluated" value={String(summary.evaluated)} />
            <StatCard label="Avg Pass Rate" value={`${summary.avgPass}%`} />
            <StatCard label="Avg L1 / L2" value={`${summary.l1} / ${summary.l2 < 0 ? "—" : summary.l2}`} />
            <StatCard label="Total Spend" value={formatCostTable(summary.spend)} accent />
          </div>

          {filteredRuns.length === 0 ? (
            <div className="rounded-lg border border-light-border bg-light-surface p-10 text-center dark:border-dark-border dark:bg-dark-surface">
              <div className="font-semibold text-light-text dark:text-dark-text">No runs match the current filters.</div>
              <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-brand hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* D — Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Pass Rate Over Time">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="pass_rate" name="Pass rate" stroke="#2D3DA8" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Cost Per Run">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={timeSeries}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <YAxis stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="cost" name="Cost (USD)" fill="#2D3DA8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Structure (L1) vs Quality (L2) Scores">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
                      <Line type="monotone" dataKey="l1" name="L1 Score" stroke="#2D3DA8" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="l2" name="L2 Score" stroke="#7C3AED" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Most Frequent Failures (filtered)">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topFailing} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} allowDecimals={false} />
                      <YAxis type="category" dataKey="check_id" width={70} stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Failures">
                        {topFailing.map((d) => (
                          <Cell key={d.check_id} fill={tierColor(d.check_id)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* E — Runs table with expandable rows */}
              <div className="overflow-hidden rounded-xl border border-light-border bg-light-surface dark:border-dark-border dark:bg-dark-surface">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-light-bg text-xs uppercase tracking-wide text-light-text2 dark:bg-dark-surface2 dark:text-dark-text2">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="px-3 py-2">Date</th>
                        <th className="hidden px-3 py-2 md:table-cell">User</th>
                        <th className="px-3 py-2">Campaign</th>
                        <th className="hidden px-3 py-2 md:table-cell">Journalists</th>
                        <th className="hidden px-3 py-2 md:table-cell">Evaluated</th>
                        <th className="px-3 py-2">Pass Rate</th>
                        <th className="hidden px-3 py-2 md:table-cell">L1 / L2</th>
                        <th className="px-3 py-2">Total Cost</th>
                        <th className="hidden px-3 py-2 md:table-cell">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-dark-border">
                      {[...filteredRuns]
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .map((r) => {
                          const isOpen = openRows.has(r.id);
                          const ev = r.evaluation;
                          const dur = r.duration;
                          return (
                            <Fragment key={r.id}>
                              <tr
                                onClick={() => toggleRow(r.id)}
                                className="cursor-pointer hover:bg-light-surface2 dark:hover:bg-dark-surface3"
                              >
                                <td className="px-3 py-2 text-light-text3 dark:text-dark-text3">
                                  <span className={`inline-block transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-light-text2 dark:text-dark-text2">{fmtDateTime(r.created_at)}</td>
                                <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{r.user_name}</td>
                                <td className="px-3 py-2 text-light-text dark:text-dark-text">{r.campaign_name}</td>
                                <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{r.generation.total_journalists}</td>
                                <td className="hidden whitespace-nowrap px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">
                                  {evald(r)} / {r.generation.total_journalists}
                                  {ev.was_sampled && <span className="text-light-text3 dark:text-dark-text3"> (sample)</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {evald(r) === 0 ? (
                                    <span className="text-light-text3 dark:text-dark-text3">—</span>
                                  ) : (
                                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${passRateClass(ev.pass_rate)}`}>{ev.pass_rate}%</span>
                                  )}
                                </td>
                                <td className="hidden px-3 py-2 md:table-cell">
                                  <div className="flex gap-1">
                                    <ScorePill score={ev.avg_l1_score ?? -1} />
                                    <ScorePill score={ev.avg_l2_score ?? -1} />
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-bold text-light-text dark:text-dark-text">{formatCostTable(r.totals.total_cost_usd)}</td>
                                <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{formatDuration(dur?.total_ms ?? 0)}</td>
                              </tr>
                              {isOpen && (
                                <tr>
                                  <td colSpan={10} className="border-l-[3px] border-brand bg-light-surface2 px-5 py-4 dark:bg-dark-surface2">
                                    <div className="grid gap-x-8 gap-y-1 text-xs md:grid-cols-2">
                                      <div>
                                        <SubHead>Run Configuration</SubHead>
                                        <Field label="Batch size" value={r.config?.batch_size ?? r.generation.batch_size} />
                                        <Field label="Model" value={r.config?.model ?? "—"} />
                                        <Field label="Prompt length" value={`${r.config?.generation_prompt_length ?? "—"} chars`} />
                                        <Field label="Data facts length" value={`${r.config?.data_facts_length ?? "—"} chars`} />
                                        <Field label="Sample method" value={ev.sample_method ?? "—"} />
                                      </div>
                                      <div>
                                        <SubHead>Generation Detail</SubHead>
                                        <Field label="Journalists" value={r.generation.total_journalists} />
                                        <Field label="Succeeded" value={r.generation.succeeded} />
                                        <Field label="Failed" value={r.generation.failed} />
                                        <Field label="Batches" value={`${r.generation.total_batches} (size ${r.generation.batch_size})`} />
                                        <Field label="Tokens" value={`${formatTokens(r.generation.input_tokens)} in · ${formatTokens(r.generation.output_tokens)} out`} />
                                        <Field label="Cost" value={formatCostTable(r.generation.cost_usd)} />
                                        <Field label="Time" value={formatDuration(dur?.generation_ms ?? 0)} />
                                      </div>
                                      <div>
                                        <SubHead>Evaluation Detail</SubHead>
                                        <Field label="Evaluated" value={`${evald(r)} of ${r.generation.total_journalists}${ev.was_sampled ? " (sample)" : ""}`} />
                                        <Field label="Passed" value={ev.passed} />
                                        <Field label="Failed" value={ev.failed} />
                                        <Field label="Not evaluated" value={ev.not_evaluated ?? 0} />
                                        <Field label="Pass rate" value={`${ev.pass_rate}%`} />
                                        <Field label="Avg L1" value={ev.avg_l1_score ?? "—"} />
                                        <Field label="Avg L2" value={(ev.avg_l2_score ?? -1) < 0 ? "—" : ev.avg_l2_score} />
                                        <Field label="L2 skipped (gate)" value={ev.l2_skipped_count ?? 0} />
                                        <Field label="Cost" value={formatCostTable(ev.cost_usd)} />
                                        <Field label="Time" value={formatDuration(dur?.evaluation_ms ?? 0)} />
                                      </div>
                                      <div>
                                        <SubHead>Failed Checks in This Run</SubHead>
                                        {Object.keys(r.failed_check_frequency ?? {}).length === 0 ? (
                                          <p className="text-light-text2 dark:text-dark-text2">No checks failed in this run.</p>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5">
                                            {Object.entries(r.failed_check_frequency ?? {})
                                              .sort((a, b) => b[1] - a[1])
                                              .map(([id, n]) => (
                                                <span
                                                  key={id}
                                                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                                  style={{ backgroundColor: tierColor(id) }}
                                                >
                                                  {id} ×{n}
                                                </span>
                                              ))}
                                          </div>
                                        )}
                                        <SubHead>Totals</SubHead>
                                        <Field label="Total tokens" value={formatTokens(r.totals.total_tokens)} />
                                        <Field label="Total cost" value={formatCostTable(r.totals.total_cost_usd)} />
                                        <Field label="Total time" value={formatDuration(dur?.total_ms ?? 0)} />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
