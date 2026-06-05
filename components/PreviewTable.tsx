"use client";

import { Fragment, useEffect, useState } from "react";
import { CheckResult, GeneratedEmail } from "@/lib/types";
import { Badge } from "./ui";

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function HtmlPreview({ html, title }: { html: string; title: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <iframe
        title={title}
        sandbox=""
        srcDoc={html || "<em>empty</em>"}
        className="h-48 w-full rounded-lg border border-slate-200 bg-white"
      />
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <div
      className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
        check.pass ? "" : "bg-red-50"
      }`}
    >
      <span className={check.pass ? "text-emerald-600" : "text-red-600"}>
        {check.pass ? "✓" : "✕"}
      </span>
      <span className="w-20 shrink-0 font-mono font-semibold text-slate-600">{check.check_id}</span>
      <span className="flex-1 text-slate-600">{check.question}</span>
      <span className={`w-44 shrink-0 text-right ${check.pass ? "text-slate-500" : "font-medium text-red-700"}`}>
        {check.model_answer}
      </span>
    </div>
  );
}

function ChecklistSection({ title, checks }: { title: string; checks: CheckResult[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-slate-700">{title}</div>
      <div className="space-y-0.5">
        {checks.map((c) => (
          <CheckRow key={c.check_id} check={c} />
        ))}
      </div>
    </div>
  );
}

function Drawer({ email }: { email: GeneratedEmail }) {
  if (email.status === "generation_failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Generation failed:</strong> {email.error || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Verification Summary
        </div>
        <p className="text-sm text-slate-700">{email.verification_summary || "—"}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HtmlPreview html={email.email_1_html} title="Email 1" />
        <HtmlPreview html={email.followup_html} title="Follow-Up 1" />
      </div>

      {email.quality && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Quality Check</span>
            <Badge tone={email.quality.verdict === "PASS" ? "pass" : "fail"}>
              {email.quality.verdict}
            </Badge>
          </div>
          <ChecklistSection title="Layer 1 — Deterministic" checks={email.quality.layer1} />
          {email.quality.layer2Skipped ? (
            <div className="rounded bg-slate-100 px-2 py-1 text-xs italic text-slate-500">
              LLM judge skipped (Layer 1 failed)
            </div>
          ) : (
            <ChecklistSection title="Layer 2 — LLM Judge" checks={email.quality.layer2} />
          )}
        </div>
      )}
    </div>
  );
}

export function PreviewTable({
  emails,
  qualityRun,
  qualityVersion,
}: {
  emails: GeneratedEmail[];
  qualityRun: boolean;
  qualityVersion: number; // bumps when quality results land, to trigger auto-open
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  // After quality check completes, default failing rows to open (spec 6.5).
  useEffect(() => {
    if (qualityVersion === 0) return;
    const next = new Set<number>();
    emails.forEach((e) => {
      if (e.quality?.verdict === "FAIL") next.add(e.rowIndex);
    });
    setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityVersion]);

  function toggle(rowIndex: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Journalist</th>
              <th className="px-3 py-2">Subject</th>
              {qualityRun && <th className="px-3 py-2 w-20">Quality</th>}
              <th className="px-3 py-2 w-32">Status</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emails.map((e, i) => {
              const isOpen = open.has(e.rowIndex);
              const failed = e.status === "generation_failed";
              return (
                <Fragment key={e.rowIndex}>
                  <tr
                    onClick={() => toggle(e.rowIndex)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {e.journalist.first_name} {e.journalist.last_name}
                      </div>
                      <div className="text-xs text-slate-400">{e.journalist.email}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {failed ? <span className="text-slate-400">—</span> : truncate(e.subject || "", 60)}
                    </td>
                    {qualityRun && (
                      <td className="px-3 py-2">
                        {e.quality ? (
                          <Badge tone={e.quality.verdict === "PASS" ? "pass" : "fail"}>
                            {e.quality.verdict}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {failed ? (
                        <Badge tone="fail">Generation Failed</Badge>
                      ) : (
                        <Badge tone="neutral">Generated</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      <span className={`inline-block transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={qualityRun ? 6 : 5} className="bg-slate-50/60 px-5 py-4">
                        <Drawer email={e} />
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
  );
}
