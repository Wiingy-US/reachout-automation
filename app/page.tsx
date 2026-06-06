"use client";

import { useMemo, useState } from "react";
import {
  CsvValidationResult,
  GeneratedEmail,
  OperationTokenRecord,
  QualitySummary,
} from "@/lib/types";
import { summarise } from "@/lib/quality";
import { computeSessionSummary, formatCost, formatTokens } from "@/lib/costs";
import { buildExportCsv, downloadCsv, validateExportHtml } from "@/lib/exportCsv";
import { Button, Section, Spinner } from "@/components/ui";
import { StepIndicator } from "@/components/StepIndicator";
import { CsvUpload } from "@/components/CsvUpload";
import { SummaryBar } from "@/components/SummaryBar";
import { PreviewTable } from "@/components/PreviewTable";
import { TokenCostPanel } from "@/components/TokenCostPanel";

const BATCH_SIZES = [3, 5, 10, 25];
const QC_CONCURRENCY = 4;

export default function Home() {
  // Step 1 — manual campaign setup (prompt + data facts, entered by the user)
  const [prompt, setPrompt] = useState("");
  const [dataFacts, setDataFacts] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Step 2 — CSV
  const [csv, setCsv] = useState<CsvValidationResult | null>(null);
  const [csvKey, setCsvKey] = useState(0);

  // Step 3 — generation
  const [batchSize, setBatchSize] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);

  // Step 4 — quality + export
  const [qcRunning, setQcRunning] = useState(false);
  const [qcProgress, setQcProgress] = useState({ done: 0, total: 0 });
  const [qualityRun, setQualityRun] = useState(false);
  const [qualityVersion, setQualityVersion] = useState(0);

  // Token usage accumulated across the session.
  const [tokenRecords, setTokenRecords] = useState<OperationTokenRecord[]>([]);

  // Retry of failed generation rows.
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{ current: number; total: number } | null>(null);

  const generated = emails.length > 0;
  const generatedOk = useMemo(() => emails.filter((e) => e.status === "generated"), [emails]);
  const failedCount = useMemo(
    () => emails.filter((e) => e.status === "generation_failed").length,
    [emails]
  );

  const summary: QualitySummary | null = qualityRun
    ? summarise(emails.map((e) => e.quality))
    : null;

  const tokenSummary = useMemo(() => computeSessionSummary(tokenRecords), [tokenRecords]);

  const setupReady = prompt.trim().length > 0 && dataFacts.trim().length > 0;

  // Current wizard stage for the step indicator.
  const currentStep = !confirmed
    ? 0
    : !csv || csv.missingColumns.length > 0 || csv.rows.length === 0
    ? 1
    : !generated
    ? 2
    : !qualityRun
    ? 3
    : 4;

  function scrollToStep(id: string) {
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // Re-uploading the CSV resets only generation + quality (keeps campaign setup).
  function resetFromCsv() {
    if (generated && !window.confirm("This will clear all generated emails. Are you sure?")) return;
    setCsv(null);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: 0 });
    setTokenRecords([]);
    setCsvKey((k) => k + 1);
    scrollToStep("step-2");
  }

  // ---- Step 3: batch generation ----
  async function handleGenerate() {
    if (!csv) return;
    const rows = csv.rows;
    setGenerating(true);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: rows.length });
    // Fresh run: drop any prior generation/quality token records.
    setTokenRecords([]);

    const collected: GeneratedEmail[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            rows: chunk,
            batchIndex: i / batchSize,
            dataFactsSummary: dataFacts,
          }),
        });
        const data = await res.json();
        const batchEmails: GeneratedEmail[] = data.emails ?? [];
        collected.push(...batchEmails);
        const batchRecords: OperationTokenRecord[] = data.batch_token_records ?? [];
        if (batchRecords.length) setTokenRecords((prev) => [...prev, ...batchRecords]);
      } catch (err: any) {
        chunk.forEach((row) =>
          collected.push({
            rowIndex: row._rowIndex,
            journalist: row,
            status: "generation_failed",
            error: err?.message || "Network error",
            verification_summary: "",
            subject: "",
            email_1_html: "",
            followup_html: "",
          })
        );
      }
      setEmails([...collected]);
      setGenProgress({ done: Math.min(i + batchSize, rows.length), total: rows.length });
    }
    setGenerating(false);
  }

  // ---- Retry: re-run generation for failed rows only ----
  async function retryFailedRows() {
    const failed = emails.filter((e) => e.status === "generation_failed");
    if (failed.length === 0) return;
    const failedRows = failed.map((e) => e.journalist);

    setIsRetrying(true);
    setRetryProgress({ current: 0, total: failedRows.length });

    const retryResults: GeneratedEmail[] = [];
    for (let i = 0; i < failedRows.length; i += batchSize) {
      const chunk = failedRows.slice(i, i + batchSize);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            rows: chunk,
            batchIndex: i / batchSize,
            dataFactsSummary: dataFacts,
          }),
        });
        const data = await res.json();
        const batchEmails: GeneratedEmail[] = data.emails ?? [];
        retryResults.push(...batchEmails);
        // Retry tokens are counted into the Email Generation total.
        const batchRecords: OperationTokenRecord[] = data.batch_token_records ?? [];
        if (batchRecords.length) setTokenRecords((prev) => [...prev, ...batchRecords]);
      } catch {
        chunk.forEach((row) =>
          retryResults.push({
            rowIndex: row._rowIndex,
            journalist: row,
            status: "generation_failed",
            error: "Network or timeout error on retry",
            verification_summary: "",
            subject: "",
            email_1_html: "",
            followup_html: "",
          })
        );
      }
      setRetryProgress({
        current: Math.min(i + batchSize, failedRows.length),
        total: failedRows.length,
      });
    }

    // Merge retry results back in — replace failed rows, keep successful ones
    // untouched. Replacement rows carry no `quality`, so the stale QC result of
    // a retried row is cleared; passing rows keep theirs.
    setEmails((prev) =>
      prev.map((existing) => {
        if (existing.status !== "generation_failed") return existing;
        return retryResults.find((r) => r.rowIndex === existing.rowIndex) ?? existing;
      })
    );

    // Some rows now have no QC result — mark the quality check incomplete so it
    // can be re-run (it will only evaluate the rows that lack a result).
    if (retryResults.length > 0) setQualityRun(false);

    setIsRetrying(false);
    setRetryProgress(null);
  }

  // ---- Step 4: quality check ----
  async function handleQualityCheck() {
    // Only evaluate rows that don't already have a result — this preserves
    // passing rows across a retry and avoids re-spending tokens on them.
    const targets = generatedOk.filter((e) => !e.quality);
    setQcRunning(true);
    setQcProgress({ done: 0, total: targets.length });

    const updated = [...emails];
    const indexByRow = new Map(updated.map((e, idx) => [e.rowIndex, idx]));
    let done = 0;

    for (let i = 0; i < targets.length; i += QC_CONCURRENCY) {
      const slice = targets.slice(i, i + QC_CONCURRENCY);
      await Promise.all(
        slice.map(async (email) => {
          try {
            const res = await fetch("/api/quality-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, dataFactsSummary: dataFacts }),
            });
            const data = await res.json();
            const idx = indexByRow.get(email.rowIndex);
            if (idx !== undefined && data.quality) {
              updated[idx] = { ...updated[idx], quality: data.quality };
            }
            const records: OperationTokenRecord[] = data.token_records ?? [];
            if (records.length) setTokenRecords((prev) => [...prev, ...records]);
          } catch {
            // leave unevaluated; surfaces as no badge
          } finally {
            done += 1;
            setQcProgress({ done, total: targets.length });
          }
        })
      );
      setEmails([...updated]);
    }

    setQualityRun(true);
    setQualityVersion((v) => v + 1);
    setQcRunning(false);
  }

  // ---- Export ----
  function handleExport() {
    if (!qualityRun) {
      const ok = window.confirm(
        "Quality check has not been run. Exporting all emails without evaluation results.\n\nProceed with download?"
      );
      if (!ok) return;
    }
    const warnings = validateExportHtml(emails);
    if (warnings.length > 0) {
      const sample = warnings
        .slice(0, 8)
        .map((w) => `• Row ${w.rowIndex + 1} (${w.journalist}) ${w.field}: unclosed <${w.unclosed.join(">, <")}>`)
        .join("\n");
      const more = warnings.length > 8 ? `\n…and ${warnings.length - 8} more` : "";
      const ok = window.confirm(
        `HTML validation found unclosed tags in ${warnings.length} cell(s):\n\n${sample}${more}\n\nDownload anyway?`
      );
      if (!ok) return;
    }
    const csvText = buildExportCsv(emails, qualityRun);
    downloadCsv("reachout-emails.csv", csvText);
  }

  const genPct =
    genProgress.total === 0 ? 0 : Math.round((genProgress.done / genProgress.total) * 100);
  const qcPct =
    qcProgress.total === 0 ? 0 : Math.round((qcProgress.done / qcProgress.total) * 100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Digital PR Outreach — MVP</h1>
        <p className="text-sm text-slate-500">
          Single-session tool · prompt + data facts → personalised pitch emails → quality check → AppScript CSV.
          Nothing is stored; closing the tab clears everything.
        </p>
      </header>

      <StepIndicator current={currentStep} />

      <div className="space-y-5">
        {/* Step 1 — Campaign Setup */}
        <Section
          step={1}
          id="step-1"
          title="Step 1 — Campaign Setup"
          subtitle="Paste the generation prompt and the data facts summary. Both are required."
          done={confirmed}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Generation Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (confirmed) setConfirmed(false);
                }}
                disabled={generating || qcRunning}
                rows={20}
                className="code-area w-full rounded-lg border border-slate-300 p-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Data Facts Summary
              </label>
              <textarea
                value={dataFacts}
                onChange={(e) => {
                  setDataFacts(e.target.value);
                  if (confirmed) setConfirmed(false);
                }}
                disabled={generating || qcRunning}
                rows={12}
                className="code-area w-full rounded-lg border border-slate-300 p-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
              />
              <p className="mt-1 text-xs text-slate-400">
                Used verbatim by the quality-check judge (MAIN-01) to verify emails only cite facts you provide here.
              </p>
            </div>
            <Button
              variant={confirmed ? "secondary" : "primary"}
              onClick={() => {
                setConfirmed(true);
                scrollToStep("step-2");
              }}
              disabled={!setupReady || generating || qcRunning}
            >
              {confirmed ? "Confirmed ✓" : "Confirm & Continue"}
            </Button>
          </div>
        </Section>

        {/* Step 2 — CSV */}
        <Section
          step={2}
          id="step-2"
          title="Step 2 — Upload journalist CSV"
          subtitle="Up to 200 rows. Required columns are validated; rows missing critical fields are flagged."
          done={!!csv && csv.missingColumns.length === 0}
        >
          <CsvUpload key={csvKey} onParsed={setCsv} disabled={generating || qcRunning} />
          {csv && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetFromCsv}
                disabled={generating || qcRunning}
                className="text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-40"
              >
                Change CSV
              </button>
            </div>
          )}
        </Section>

        {/* Step 3 — generate */}
        <Section
          step={3}
          id="step-3"
          title="Step 3 — Select batch size & generate"
          subtitle="Default batch size 5 to stay under the Vercel Hobby 10s function timeout."
          done={generated && !generating}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">Batch size</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={generating || qcRunning || isRetrying}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              {BATCH_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="w-full text-xs text-slate-400">
              Smaller batches are more reliable. 5 is recommended.
            </span>
            <Button
              onClick={handleGenerate}
              disabled={
                generating ||
                qcRunning ||
                isRetrying ||
                !confirmed ||
                !csv ||
                csv.missingColumns.length > 0 ||
                csv.rows.length === 0
              }
            >
              {generating ? (
                <>
                  <Spinner /> Generating…
                </>
              ) : (
                "Generate emails"
              )}
            </Button>
          </div>

          {(generating || generated) && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>
                  {genProgress.done} of {genProgress.total} journalists processed
                </span>
                <span>{genPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${genPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Tokens used this session: {formatTokens(tokenSummary.breakdown.email_generation.total_tokens)}{" "}
                · Estimated cost so far: ~{formatCost(tokenSummary.breakdown.email_generation.total_cost_usd)}
              </p>
            </div>
          )}
        </Section>

        {/* Step 4 — review / quality / export */}
        {generated && (
          <Section
            step={4}
            id="step-4"
            title="Step 4 — Review, quality check & export"
            subtitle="Expand any row to inspect the email. Run the quality check, then download the CSV."
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleQualityCheck}
                disabled={
                  qcRunning || generating || isRetrying || qualityRun || generatedOk.length === 0
                }
              >
                {qcRunning ? (
                  <>
                    <Spinner /> Running quality check…
                  </>
                ) : qualityRun ? (
                  "Quality check complete ✓"
                ) : (
                  "Run quality check"
                )}
              </Button>

              {failedCount > 0 && !isRetrying && (
                <button
                  type="button"
                  onClick={retryFailedRows}
                  disabled={generating || qcRunning}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-600 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry Failed Rows
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                    {failedCount}
                  </span>
                </button>
              )}

              {isRetrying && retryProgress && (
                <span className="flex items-center gap-2 text-xs font-medium text-amber-700">
                  <Spinner /> Retrying failed rows… {retryProgress.current} of {retryProgress.total} processed
                </span>
              )}

              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={generating || qcRunning || isRetrying}
              >
                Download CSV
              </Button>
              {!qualityRun && !qcRunning && (
                <span className="text-xs text-amber-600">
                  Tip: run the quality check before export to populate the status columns.
                </span>
              )}
            </div>

            {qcRunning && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>
                    Evaluating {qcProgress.done} of {qcProgress.total}
                  </span>
                  <span>{qcPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${qcPct}%` }}
                  />
                </div>
              </div>
            )}

            {qualityRun && (
              <div className="mb-4">
                <SummaryBar summary={summary} />
              </div>
            )}

            <PreviewTable emails={emails} qualityRun={qualityRun} qualityVersion={qualityVersion} />
          </Section>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        MVP · No auth · No database · Session-only state. Deploy on Vercel (keep batch size 5 on Hobby).
      </footer>

      <TokenCostPanel summary={tokenSummary} />
    </main>
  );
}
