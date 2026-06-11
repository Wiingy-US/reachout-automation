"use client";

import { Fragment, useEffect, useState } from "react";
import { CheckResult, GeneratedEmail } from "@/lib/types";
import { getCheck, SCORING } from "@/lib/rubric";
import { Badge, ScorePill, TierBadge } from "./ui";

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function HtmlPreview({ html, title }: { html: string; title: string }) {
  // Wrap the email HTML in a minimal white-background document so it renders
  // like a real email client regardless of the app's light/dark mode.
  const doc = `<html><head><style>
    body { margin: 16px; padding: 0; background: #ffffff; color: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 14px; line-height: 1.6; }
    p { margin: 0 0 12px 0; }
    ul { margin: 0 0 12px 0; padding-left: 20px; }
    li { margin-bottom: 6px; }
  </style></head><body>${html || "<em>empty</em>"}</body></html>`;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-light-text2 dark:text-dark-text2">
        {title}
      </div>
      <div className="overflow-hidden rounded-lg border border-light-border bg-white dark:border-dark-border">
        <iframe
          title={title}
          sandbox="allow-same-origin"
          srcDoc={doc}
          style={{ width: "100%", height: "380px", border: "none", background: "#ffffff" }}
        />
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <div
      className={`flex items-start gap-2 rounded px-2 py-1 text-xs ${
        check.pass
          ? "dark:bg-dark-surface2"
          : "bg-danger-light dark:border-l-2 dark:border-danger dark:bg-[#2D1515]"
      }`}
    >
      <span className={check.pass ? "text-success" : "text-danger dark:text-red-400"}>
        {check.pass ? "✓" : "✕"}
      </span>
      <span
        className={`w-20 shrink-0 font-mono font-semibold ${
          check.pass ? "text-light-text2 dark:text-brand" : "text-danger-text dark:text-red-400"
        }`}
      >
        {check.check_id}
      </span>
      <span
        className={`flex-1 ${
          check.pass ? "text-light-text2 dark:text-dark-text2" : "text-light-text2 dark:text-red-300"
        }`}
      >
        {check.question}
      </span>
      <span
        className={`flex-1 text-right ${
          check.pass
            ? "text-light-text2 dark:text-dark-text"
            : "font-medium text-danger-text dark:text-red-200"
        }`}
      >
        {check.model_answer}
      </span>
      <TierBadge tier={check.tier ?? getCheck(check.check_id)?.tier ?? "minor"} />
      {!check.pass && (
        <span className="w-12 shrink-0 text-right font-semibold text-danger dark:text-red-400">
          -{check.weight ?? getCheck(check.check_id)?.weight ?? SCORING.minor_deduction}pts
        </span>
      )}
    </div>
  );
}

function ChecklistSection({ title, checks }: { title: string; checks: CheckResult[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-light-text dark:text-dark-text2">{title}</div>
      <div className="space-y-0.5">
        {checks.map((c) => (
          <CheckRow key={c.check_id} check={c} />
        ))}
      </div>
    </div>
  );
}

function failureHint(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.includes("429") || r.includes("quota") || r.includes("rate limit")) {
    return "Tip: wait 60 seconds and retry — API rate limit reached.";
  }
  if (r.includes("api key")) {
    return "Tip: check that GEMINI_API_KEY is correctly set in Vercel environment variables.";
  }
  if (r.includes("truncation") || r.includes("missing section")) {
    return "Tip: reduce batch size and retry generation.";
  }
  return null;
}

function Drawer({ email }: { email: GeneratedEmail }) {
  if (email.status === "generation_failed") {
    const reason = email.error || "Unknown error";
    const hint = failureHint(reason);
    return (
      <div>
        <div className="mb-2 text-sm font-bold text-danger-text dark:text-[#FCA5A5]">Generation failed</div>
        <div className="rounded-lg border border-danger/30 bg-danger-light p-3 font-mono text-xs text-danger-text dark:border-danger dark:bg-[#2D0A0A] dark:text-[#FCA5A5]">
          {reason}
        </div>
        {hint && <p className="mt-2 text-xs font-medium text-warning-text">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-light-text2 dark:text-dark-text2">
          Verification Summary
        </div>
        <p className="rounded-lg bg-light-surface px-4 py-3 text-sm text-light-text dark:bg-dark-surface3 dark:text-dark-text">
          {email.verification_summary || "—"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <HtmlPreview html={email.email_1_html} title="Email 1" />
        <HtmlPreview html={email.followup_html} title="Follow-Up 1" />
      </div>

      {email.quality && (
        <div className="space-y-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface2 dark:bg-dark-surface2 p-3">
          {/* Score header */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-light-surface px-3 py-2 dark:bg-dark-surface3">
            <ScorePill label="L1 Score" score={email.quality.layer1_score} />
            <ScorePill label="L2 Score" score={email.quality.layer2_score} />
            <span className="text-xs text-light-text2 dark:text-dark-text2">
              Gate: {email.quality.layer1_passed_gate ? "✓ passed" : "✕ failed"}
            </span>
            <Badge tone={email.quality.verdict === "PASS" ? "pass" : "fail"}>
              {email.quality.verdict}
            </Badge>
          </div>

          <ChecklistSection title="Layer 1 — Deterministic" checks={email.quality.layer1} />
          {email.quality.layer2Skipped ? (
            <div className="rounded bg-light-bg px-3 py-2 text-xs text-warning-text dark:bg-dark-surface3 dark:text-[#FCD34D]">
              Layer 2 skipped — L1 score ({email.quality.layer1_score}) below gate ({SCORING.l1_gate_threshold}). Fix
              structural issues first to unlock quality evaluation.
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
    <div className="overflow-hidden rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-light-bg dark:bg-dark-surface2 text-xs uppercase tracking-wide text-light-text2 dark:text-dark-text2">
            <tr>
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Journalist</th>
              <th className="px-3 py-2">Subject</th>
              {qualityRun && <th className="px-3 py-2 w-20">Quality</th>}
              <th className="px-3 py-2 w-32">Status</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-dark-border">
            {emails.map((e, i) => {
              const isOpen = open.has(e.rowIndex);
              const failed = e.status === "generation_failed";
              return (
                <Fragment key={e.rowIndex}>
                  <tr
                    onClick={() => toggle(e.rowIndex)}
                    className="cursor-pointer hover:bg-light-surface2 dark:hover:bg-dark-surface3"
                  >
                    <td className="px-3 py-2 text-light-text3 dark:text-dark-text3">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-light-text dark:text-dark-text">
                        {e.journalist.first_name} {e.journalist.last_name}
                      </div>
                      <div className="text-xs text-light-text3 dark:text-dark-text3">{e.journalist.email}</div>
                    </td>
                    <td className="px-3 py-2 text-light-text2 dark:text-dark-text2">
                      {failed ? <span className="text-light-text3 dark:text-dark-text3">—</span> : truncate(e.subject || "", 60)}
                    </td>
                    {qualityRun && (
                      <td className="px-3 py-2">
                        {e.quality ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <ScorePill label="L1" score={e.quality.layer1_score} />
                            <ScorePill label="L2" score={e.quality.layer2_score} />
                            <Badge tone={e.quality.verdict === "PASS" ? "pass" : "fail"}>
                              {e.quality.verdict}
                            </Badge>
                          </div>
                        ) : (
                          <span
                            className="text-xs text-light-text3 dark:text-dark-text3"
                            title="Not included in this evaluation sample"
                          >
                            —
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {failed ? (
                        <Badge tone="neutral">Generation Failed</Badge>
                      ) : (
                        <Badge tone="generated">Generated</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-light-text3 dark:text-dark-text3">
                      <span className={`inline-block transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td
                        colSpan={qualityRun ? 6 : 5}
                        className="border-l-[3px] border-brand bg-light-surface2 px-5 py-4 dark:bg-dark-surface2"
                      >
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
