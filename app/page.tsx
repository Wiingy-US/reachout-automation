"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CsvValidationResult,
  GeneratedEmail,
  OperationTokenRecord,
  QualitySummary,
} from "@/lib/types";
import { summarise } from "@/lib/quality";
import { computeSessionSummary, formatCost, formatTokens } from "@/lib/costs";
import { formatDuration } from "@/lib/utils";
import { randomSample } from "@/lib/sampling";
import { QCSampleSelector } from "@/components/QCSampleSelector";
import { buildExportCsv, downloadCsv, validateExportHtml } from "@/lib/exportCsv";
import { buildRunRecord } from "@/lib/run-record";
import { Button, Section, Spinner } from "@/components/ui";
import { CsvUpload } from "@/components/CsvUpload";
import { SummaryBar } from "@/components/SummaryBar";
import { PreviewTable } from "@/components/PreviewTable";
import { TokenCostPanel } from "@/components/TokenCostPanel";
import { CampaignPicker } from "@/components/CampaignPicker";
import { UserPicker } from "@/components/UserPicker";
import { Dashboard } from "@/components/Dashboard";
import { Sidebar } from "@/components/Sidebar";
import { ConfirmModal } from "@/components/ConfirmModal";

const THEME_KEY = "wiingy_theme";

const USER_NAME_KEY = "reachout_user_name";

const BATCH_SIZES = [3, 5, 10, 25];
const QC_BATCH_SIZE = 5; // journalists per Layer 2 judge batch

export default function Home() {
  // Top-level tab
  const [activeTab, setActiveTab] = useState<"generate" | "dashboard">("generate");

  // Dark mode (class on <html>, persisted in localStorage; no-flash script in layout).
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggleDark() {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Pending step-back navigation awaiting confirmation.
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  // Session identity
  const [userName, setUserName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  // Stable id for this run so the post-generation and post-QC saves update the
  // same record rather than creating duplicates.
  const [runId, setRunId] = useState<string | null>(null);

  // Step 1 — manual campaign setup (prompt + data facts, entered by the user)
  const [prompt, setPrompt] = useState("");
  const [dataFacts, setDataFacts] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Pre-fill the user's name from localStorage on return visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(USER_NAME_KEY);
      if (saved) setUserName(saved);
    } catch {
      /* ignore */
    }
  }, []);

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
  const [wasSampled, setWasSampled] = useState(false);

  // Re-run evaluation: clear all QC results and show the selector again.
  function resetQualityCheck() {
    setEmails((prev) => prev.map((e) => ({ ...e, quality: undefined })));
    setQualityRun(false);
    setQualityVersion(0);
    setWasSampled(false);
    setTokenRecords((prev) => prev.filter((r) => r.operation !== "quality_check_layer2"));
  }

  // Token usage accumulated across the session.
  const [tokenRecords, setTokenRecords] = useState<OperationTokenRecord[]>([]);

  // Retry of failed generation rows.
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{ current: number; total: number } | null>(null);

  // Run-duration tracking.
  const generationStartTime = useRef<number>(0);
  const qcStartTime = useRef<number>(0);
  const [generationDurationMs, setGenerationDurationMs] = useState<number>(0);
  const [qcDurationMs, setQcDurationMs] = useState<number>(0);
  // Live elapsed counter (runs while generating or quality-checking).
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!generating && !qcRunning) return;
    setElapsedMs(0);
    const start = Date.now();
    const interval = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(interval);
  }, [generating, qcRunning]);

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

  const setupReady =
    userName.trim().length > 0 &&
    campaignName.trim().length > 0 &&
    prompt.trim().length > 0 &&
    dataFacts.trim().length > 0;

  // Assemble + persist a run record (never throws to the caller). Fresh emails
  // and token records are passed in explicitly to avoid stale closure state.
  async function saveRunRecord(
    id: string,
    emailsArg: GeneratedEmail[],
    recordsArg: OperationTokenRecord[],
    genMs = 0,
    qcMs = 0
  ) {
    if (!userName.trim() || !campaignName.trim()) return;
    const record = buildRunRecord({
      id,
      user_name: userName.trim(),
      campaign_name: campaignName.trim(),
      total_journalists: csv?.rows.length ?? emailsArg.length,
      batch_size: batchSize,
      generated_emails: emailsArg,
      token_summary: computeSessionSummary(recordsArg),
      generation_duration_ms: genMs,
      qc_duration_ms: qcMs,
      generation_prompt: prompt,
      data_facts_summary: dataFacts,
      model: "gemini-2.5-flash",
      sample_method: wasSampled ? "random" : "all",
    });
    try {
      await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch (err) {
      // Run-record saving must never break the main flow.
      console.error("Failed to save run record:", err);
    }
  }

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

  // Sidebar derived state.
  const completedSteps: boolean[] = [
    confirmed,
    !!csv && csv.missingColumns.length === 0 && csv.rows.length > 0,
    generated,
    qualityRun,
    false, // Export has no completion state
  ];

  const sessionStats = {
    journalists: csv ? String(csv.rows.length) : "—",
    generated: generated ? `${generatedOk.length} / ${emails.length}` : "—",
    passRate: qualityRun && summary ? `${summary.passRate}%` : "—",
    cost:
      tokenSummary.totals.total_tokens > 0
        ? formatCost(tokenSummary.totals.total_cost_usd)
        : "—",
  };

  const STEP_NAMES = ["Campaign Setup", "Journalists", "Generate", "Review & QC", "Export"];

  function scrollToStep(id: string) {
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  function stepDomId(index: number): string {
    // index 0→setup, 1→csv, 2→generate, 3/4→review/export (same card)
    return `step-${Math.min(index + 1, 4)}`;
  }

  function executeStepNav(index: number) {
    if (index === 0) {
      // Back to Campaign Setup — clear everything downstream.
      setConfirmed(false);
      setCsv(null);
      setEmails([]);
      setQualityRun(false);
      setQualityVersion(0);
      setGenProgress({ done: 0, total: 0 });
      setTokenRecords([]);
      setCsvKey((k) => k + 1);
    } else if (index === 1) {
      // Back to Journalists — clear generation + QC, keep setup.
      setEmails([]);
      setQualityRun(false);
      setQualityVersion(0);
      setGenProgress({ done: 0, total: 0 });
      setTokenRecords([]);
    }
    setActiveTab("generate");
    scrollToStep(stepDomId(index));
  }

  function handleStepClick(index: number) {
    setActiveTab("generate");
    if (index === currentStep) {
      scrollToStep(stepDomId(index));
      return;
    }
    // Going back to setup/journalists after generation is destructive.
    if (index < 2 && generated) {
      setPendingStep(index);
      return;
    }
    executeStepNav(index);
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
    const newRunId = crypto.randomUUID();
    setRunId(newRunId);
    generationStartTime.current = Date.now();
    setGenerating(true);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: rows.length });
    // Fresh run: drop any prior generation/quality token records.
    setTokenRecords([]);

    const collected: GeneratedEmail[] = [];
    const genRecords: OperationTokenRecord[] = [];
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
        if (batchRecords.length) {
          genRecords.push(...batchRecords);
          setTokenRecords((prev) => [...prev, ...batchRecords]);
        }
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
    const genMs = Date.now() - generationStartTime.current;
    setGenerationDurationMs(genMs);
    // Persist the run now (evaluation fields are 0 until QC runs).
    saveRunRecord(newRunId, collected, genRecords, genMs, 0);
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
  async function handleQualityCheck(sampleParam: number | "all" = "all") {
    // Choose the emails to evaluate: all generated, or a random sample. Skip
    // any that already have a result (preserves prior runs / retries).
    const pool =
      sampleParam === "all" ? generatedOk : randomSample(emails, sampleParam);
    const targets = pool.filter((e) => !e.quality);
    setWasSampled(sampleParam !== "all");
    qcStartTime.current = Date.now();
    setQcRunning(true);
    setQcProgress({ done: 0, total: targets.length });

    const updated = [...emails];
    const indexByRow = new Map(updated.map((e, idx) => [e.rowIndex, idx]));
    let done = 0;
    const qcRecords: OperationTokenRecord[] = [];

    // Send journalists to the route in batches; the route batches the Layer 2
    // judge into one Gemini call per batch (≈ targets/5 calls instead of one
    // per journalist).
    for (let i = 0; i < targets.length; i += QC_BATCH_SIZE) {
      const batch = targets.slice(i, i + QC_BATCH_SIZE);
      try {
        const res = await fetch("/api/quality-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: batch, dataFactsSummary: dataFacts }),
        });
        const data = await res.json();
        const results: { rowIndex: number; quality: GeneratedEmail["quality"] }[] =
          data.results ?? [];
        for (const r of results) {
          const idx = indexByRow.get(r.rowIndex);
          if (idx !== undefined && r.quality) {
            updated[idx] = { ...updated[idx], quality: r.quality };
          }
        }
        const records: OperationTokenRecord[] = data.token_records ?? [];
        if (records.length) {
          qcRecords.push(...records);
          setTokenRecords((prev) => [...prev, ...records]);
        }
      } catch {
        // leave this batch unevaluated; surfaces as no badge
      } finally {
        done += batch.length;
        setQcProgress({ done, total: targets.length });
      }
      setEmails([...updated]);
    }

    setQualityRun(true);
    setQualityVersion((v) => v + 1);
    setQcRunning(false);
    const qcMs = Date.now() - qcStartTime.current;
    setQcDurationMs(qcMs);

    // Update the same run record with evaluation stats. tokenRecords (closure)
    // already holds the generation records; append the QC records collected here.
    const id = runId ?? crypto.randomUUID();
    if (!runId) setRunId(id);
    saveRunRecord(id, updated, [...tokenRecords, ...qcRecords], generationDurationMs, qcMs);
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
    <div className="flex h-screen overflow-hidden bg-light-bg dark:bg-dark-bg">
      <Sidebar
        currentStep={currentStep}
        completedSteps={completedSteps}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onStepClick={handleStepClick}
        sessionStats={sessionStats}
        isDark={isDark}
        onToggleDark={toggleDark}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
      {activeTab === "dashboard" ? (
        <Dashboard />
      ) : (
        <>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
                  You
                </label>
                <UserPicker
                  value={userName}
                  onChange={(name) => {
                    setUserName(name);
                    try {
                      localStorage.setItem(USER_NAME_KEY, name);
                    } catch {
                      /* ignore */
                    }
                    if (confirmed) setConfirmed(false);
                  }}
                  disabled={generating || qcRunning}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
                  Campaign
                </label>
                <CampaignPicker
                  value={campaignName}
                  onChange={(name) => {
                    setCampaignName(name);
                    if (confirmed) setConfirmed(false);
                  }}
                  disabled={generating || qcRunning}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
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
                className="code-area w-full rounded-lg border border-light-border bg-light-surface text-light-text p-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-light-surface2 dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text dark:disabled:bg-dark-surface"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-light-text2 dark:text-dark-text2">
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
                className="code-area w-full rounded-lg border border-light-border bg-light-surface text-light-text p-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-light-surface2 dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text dark:disabled:bg-dark-surface"
              />
              <p className="mt-1 text-xs text-light-text3 dark:text-dark-text3">
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
            <label className="text-sm text-light-text2 dark:text-dark-text2">Batch size</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={generating || qcRunning || isRetrying}
              className="rounded-lg border border-light-border bg-light-surface text-light-text px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text"
            >
              {BATCH_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="w-full text-xs text-light-text3 dark:text-dark-text3">
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
              <div className="mb-1 flex justify-between text-xs text-light-text2 dark:text-dark-text2">
                <span>
                  {genProgress.done} of {genProgress.total} journalists processed
                  {generating && ` · Elapsed: ${formatDuration(elapsedMs)}`}
                </span>
                <span>{genPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wiingy-blue to-wiingy-blue-mid transition-all"
                  style={{ width: `${genPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-light-text3 dark:text-dark-text3">
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
            {/* Quality check: sample selector → summary after running */}
            <div className="mb-4">
              {qualityRun ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-light-text dark:text-dark-text">
                    Evaluated {summary?.evaluated ?? 0} of {generatedOk.length} emails (
                    {summary?.passRate ?? 0}% pass rate)
                  </span>
                  <button
                    type="button"
                    onClick={resetQualityCheck}
                    disabled={generating || qcRunning || isRetrying}
                    className="text-xs font-medium text-brand hover:underline disabled:opacity-40"
                  >
                    Re-run evaluation
                  </button>
                </div>
              ) : generatedOk.length === 0 ? (
                <span className="text-sm text-light-text2 dark:text-dark-text2">
                  No successfully generated emails to evaluate.
                </span>
              ) : (
                <QCSampleSelector
                  totalGenerated={generatedOk.length}
                  isRunning={qcRunning}
                  onRun={handleQualityCheck}
                />
              )}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">

              {failedCount > 0 && !isRetrying && (
                <button
                  type="button"
                  onClick={retryFailedRows}
                  disabled={generating || qcRunning}
                  className="inline-flex items-center gap-2 rounded-lg border border-warning bg-transparent px-4 py-2 text-sm font-medium text-warning-text transition hover:bg-warning-light dark:hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry Failed Rows
                  <span className="rounded-full bg-warning-light px-1.5 py-0.5 text-xs font-semibold text-warning-text">
                    {failedCount}
                  </span>
                </button>
              )}

              {isRetrying && retryProgress && (
                <span className="flex items-center gap-2 text-xs font-medium text-warning-text">
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
                <span className="text-xs text-warning-text">
                  Tip: run the quality check before export to populate the status columns.
                </span>
              )}
            </div>

            {qcRunning && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-light-text2 dark:text-dark-text2">
                  <span>
                    Evaluating {qcProgress.done} of {qcProgress.total}
                    {qcRunning && ` · Elapsed: ${formatDuration(elapsedMs)}`}
                  </span>
                  <span>{qcPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{ width: `${qcPct}%` }}
                  />
                </div>
              </div>
            )}

            {qualityRun && (
              <div className="mb-4">
                <SummaryBar summary={summary} />
                {wasSampled && summary && (
                  <p className="mt-2 text-xs text-light-text3 dark:text-dark-text3">
                    Showing results for {summary.evaluated} sampled emails.{" "}
                    {Math.max(0, generatedOk.length - summary.evaluated)} emails not evaluated.
                  </p>
                )}
              </div>
            )}

            <PreviewTable emails={emails} qualityRun={qualityRun} qualityVersion={qualityVersion} />
          </Section>
        )}
      </div>

      <footer className="mt-10 text-center text-xs text-light-text3 dark:text-dark-text3">
        MVP · Session-only working state · run history saved to KV. Deploy on Vercel (keep batch size 5 on Hobby).
      </footer>

      <TokenCostPanel summary={tokenSummary} />
        </>
      )}
        </div>
      </main>

      <ConfirmModal
        open={pendingStep !== null}
        title="Clear results?"
        body={
          pendingStep !== null
            ? `Going back to ${STEP_NAMES[pendingStep]} will clear your generated emails and QC results. Continue?`
            : ""
        }
        onConfirm={() => {
          const s = pendingStep;
          setPendingStep(null);
          if (s !== null) executeStepNav(s);
        }}
        onCancel={() => setPendingStep(null)}
      />
    </div>
  );
}
