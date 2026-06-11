"use client";

import { useEffect, useMemo, useState } from "react";
import { RunRecord, CampaignRecord, UserRecord } from "@/lib/types";
import { formatTokens, formatCostTable } from "@/lib/costs";
import { formatDuration } from "@/lib/utils";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function passRateBadgeClass(p: number): string {
  if (p >= 70) return "text-[#15803D] bg-wiingy-green-light dark:bg-[#14532D] dark:text-[#86EFAC]";
  if (p >= 50) return "text-[#B45309] bg-wiingy-amber-light dark:bg-[#78350F] dark:text-[#FCD34D]";
  return "text-[#DC2626] bg-wiingy-red-light dark:bg-[#7F1D1D] dark:text-[#FCA5A5]";
}

type SortKey =
  | "created_at" | "user_name" | "campaign_name" | "journalists" | "batches"
  | "generated" | "evaluated" | "duration" | "pass_rate" | "gen_tokens" | "gen_cost"
  | "qc_tokens" | "qc_cost" | "total_cost";

const ACCESSORS: Record<SortKey, (r: RunRecord) => number | string> = {
  created_at: (r) => r.created_at,
  user_name: (r) => r.user_name.toLowerCase(),
  campaign_name: (r) => r.campaign_name.toLowerCase(),
  journalists: (r) => r.generation.total_journalists,
  batches: (r) => r.generation.total_batches,
  generated: (r) => r.generation.succeeded,
  evaluated: (r) => r.evaluation.total_evaluated,
  duration: (r) => r.duration?.total_ms ?? 0,
  pass_rate: (r) => r.evaluation.pass_rate,
  gen_tokens: (r) => r.generation.total_tokens,
  gen_cost: (r) => r.generation.cost_usd,
  qc_tokens: (r) => r.evaluation.total_tokens,
  qc_cost: (r) => r.evaluation.cost_usd,
  total_cost: (r) => r.totals.total_cost_usd,
};

const COLUMNS: { key: SortKey; label: string; hideMobile: boolean }[] = [
  { key: "created_at", label: "Date", hideMobile: false },
  { key: "user_name", label: "User", hideMobile: true },
  { key: "campaign_name", label: "Campaign", hideMobile: false },
  { key: "journalists", label: "Journalists", hideMobile: true },
  { key: "batches", label: "Batches", hideMobile: true },
  { key: "generated", label: "Generated", hideMobile: true },
  { key: "evaluated", label: "Evaluated", hideMobile: true },
  { key: "duration", label: "Duration", hideMobile: true },
  { key: "pass_rate", label: "Pass Rate", hideMobile: false },
  { key: "gen_tokens", label: "Gen Tokens", hideMobile: true },
  { key: "gen_cost", label: "Gen Cost", hideMobile: true },
  { key: "qc_tokens", label: "QC Tokens", hideMobile: true },
  { key: "qc_cost", label: "QC Cost", hideMobile: true },
  { key: "total_cost", label: "Total Cost", hideMobile: false },
];

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-light-border bg-light-surface px-6 py-5 dark:border-dark-border dark:bg-dark-surface dark:shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-light-text2 dark:text-dark-text3">{label}</div>
      <div
        className={`mt-1 text-[28px] font-bold ${
          accent ? "text-brand dark:text-[#7B8FE8]" : "text-light-text dark:text-dark-text"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [campaignFilter, setCampaignFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Loads on mount; component remounts whenever the Dashboard tab is opened,
  // so this also refreshes on every tab switch to Dashboard.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [runsRes, campsRes, usersRes] = await Promise.all([
          fetch("/api/runs"),
          fetch("/api/campaigns"),
          fetch("/api/users"),
        ]);
        if (!runsRes.ok) throw new Error("bad status");
        const runsData = await runsRes.json();
        const campsData = await campsRes.json().catch(() => ({ campaigns: [] }));
        const usersData = await usersRes.json().catch(() => ({ users: [] }));
        if (active) {
          setRuns(runsData.runs ?? []);
          setCampaigns(campsData.campaigns ?? []);
          setUsers(usersData.users ?? []);
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

  const campaignOptions = useMemo(() => {
    const names = new Set(campaigns.map((c) => c.name));
    runs.forEach((r) => names.add(r.campaign_name));
    return ["All", ...Array.from(names)];
  }, [campaigns, runs]);

  const userOptions = useMemo(() => {
    const names = new Set(users.map((u) => u.name));
    runs.forEach((r) => names.add(r.user_name));
    return ["All", ...Array.from(names)];
  }, [users, runs]);

  const filtered = useMemo(() => {
    const out = runs.filter((r) => {
      if (campaignFilter !== "All" && r.campaign_name !== campaignFilter) return false;
      if (userFilter !== "All" && r.user_name !== userFilter) return false;
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
  }, [runs, campaignFilter, userFilter, sortKey, sortDir]);

  // Summary reflects the filtered set (spec section 8).
  const summary = useMemo(() => {
    const n = filtered.length;
    const journalists = filtered.reduce((s, r) => s + r.generation.total_journalists, 0);
    const avgPass = n > 0 ? Math.round(filtered.reduce((s, r) => s + r.evaluation.pass_rate, 0) / n) : 0;
    const spend = filtered.reduce((s, r) => s + r.totals.total_cost_usd, 0);
    return { n, journalists, avgPass, spend };
  }, [filtered]);

  const filtersActive = campaignFilter !== "All" || userFilter !== "All";

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
  }

  return (
    <div className="space-y-5">
      {/* Summary (reflects filters) */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatCard label="Total Runs" value={String(summary.n)} />
        <StatCard label="Journalists Processed" value={String(summary.journalists)} />
        <StatCard label="Avg Pass Rate" value={`${summary.avgPass}%`} />
        <StatCard label="Total Spend" value={formatCostTable(summary.spend)} accent />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-3">
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          Campaign
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface text-light-text px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          >
            {campaignOptions.map((c) => (
              <option key={c} value={c}>{c === "All" ? "All Campaigns" : c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-light-text2 dark:text-dark-text2">
          User
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-light-border bg-light-surface text-light-text px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
          >
            {userOptions.map((u) => (
              <option key={u} value={u}>{u === "All" ? "All Users" : u}</option>
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
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-light-bg dark:bg-dark-surface2" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-light p-6 text-center dark:border-danger dark:bg-[#2D0A0A]">
          <div className="font-semibold text-danger-text dark:text-[#FCA5A5]">Could not load run history.</div>
          <p className="mt-1 text-sm text-danger-text dark:text-[#FCA5A5]">Check that Upstash Redis is connected in Vercel → Storage.</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-10 text-center">
          <div className="text-4xl">🗂️</div>
          <div className="mt-2 font-semibold text-light-text dark:text-dark-text2">No runs yet</div>
          <p className="mt-1 text-sm text-light-text2 dark:text-dark-text2">Complete a generation run to see history here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-10 text-center">
          <div className="font-semibold text-light-text dark:text-dark-text2">No runs match the current filters.</div>
          <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-brand hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-light-bg dark:bg-dark-surface2 text-xs uppercase tracking-wide text-light-text2 dark:text-dark-text2">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:text-light-text dark:text-dark-text2 ${
                        col.hideMobile ? "hidden md:table-cell" : ""
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-dark-border">
                {filtered.map((r) => {
                  const evaluated = r.evaluation.total_evaluated;
                  return (
                    <tr
                      key={r.id}
                      className="dark:even:bg-dark-surface2 hover:bg-light-surface2 dark:hover:bg-dark-surface3"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-light-text2 dark:text-dark-text2">{fmtDateTime(r.created_at)}</td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{r.user_name}</td>
                      <td className="px-3 py-2 text-light-text dark:text-dark-text">{r.campaign_name}</td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{r.generation.total_journalists}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">
                        {r.generation.total_batches}x <span className="text-light-text3 dark:text-dark-text3">(batch: {r.generation.batch_size})</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                        <span className="text-light-text dark:text-dark-text2">{r.generation.succeeded}</span>
                        <span className="text-light-text3 dark:text-dark-text3"> / {r.generation.succeeded + r.generation.failed}</span>
                        {r.generation.failed > 0 && <span className="text-danger"> ({r.generation.failed} failed)</span>}
                      </td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{evaluated}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                        {r.duration?.total_ms ? (
                          <>
                            <div className="text-light-text dark:text-dark-text">
                              {formatDuration(r.duration.total_ms)}
                            </div>
                            <div className="text-[11px] text-light-text3 dark:text-dark-text3">
                              Gen: {formatDuration(r.duration.generation_ms)} · QC:{" "}
                              {formatDuration(r.duration.evaluation_ms)}
                            </div>
                          </>
                        ) : (
                          <span className="text-light-text3 dark:text-dark-text3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {evaluated === 0 ? (
                          <span className="text-light-text3 dark:text-dark-text3">—</span>
                        ) : (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${passRateBadgeClass(r.evaluation.pass_rate)}`}>
                            {r.evaluation.pass_rate}%
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{formatTokens(r.generation.total_tokens)}</td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{formatCostTable(r.generation.cost_usd)}</td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{formatTokens(r.evaluation.total_tokens)}</td>
                      <td className="hidden px-3 py-2 text-light-text2 dark:text-dark-text2 md:table-cell">{formatCostTable(r.evaluation.cost_usd)}</td>
                      <td className="px-3 py-2 font-bold text-light-text dark:text-dark-text">{formatCostTable(r.totals.total_cost_usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
