"use client";

import { useMemo, useState } from "react";
import {
  CsvValidationResult,
  DataFactRow,
  GeneratedEmail,
  OperationTokenRecord,
  PdfExtraction,
  QualitySummary,
} from "@/lib/types";
import { parseDataFactsToRows, serializeDataFacts } from "@/lib/dataFacts";
import { summarise } from "@/lib/quality";
import { computeSessionSummary, formatCost, formatTokens } from "@/lib/costs";
import { buildExportCsv, downloadCsv, validateExportHtml } from "@/lib/exportCsv";
import { Button, Section, Spinner } from "@/components/ui";
import { PdfUpload } from "@/components/PdfUpload";
import { PromptEditor } from "@/components/PromptEditor";
import { CsvUpload } from "@/components/CsvUpload";
import { SummaryBar } from "@/components/SummaryBar";
import { PreviewTable } from "@/components/PreviewTable";
import { TokenCostPanel } from "@/components/TokenCostPanel";

const BATCH_SIZES = [3, 5, 10, 25];
const QC_CONCURRENCY = 4;

export default function Home() {
  // Step 1/2 — PDF + prompt
  const [extraction, setExtraction] = useState<PdfExtraction | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [dataFactsRows, setDataFactsRows] = useState<DataFactRow[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  // Step 3 — CSV
  const [csv, setCsv] = useState<CsvValidationResult | null>(null);

  // Remount keys for the upload widgets so "Re-upload" returns them to a clean
  // initial state.
  const [pdfKey, setPdfKey] = useState(0);
  const [csvKey, setCsvKey] = useState(0);

  // Step 4/5 — generation
  const [batchSize, setBatchSize] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);

  // Step 6/7 — quality + export
  const [qcRunning, setQcRunning] = useState(false);
  const [qcProgress, setQcProgress] = useState({ done: 0, total: 0 });
  const [qualityRun, setQualityRun] = useState(false);
  const [qualityVersion, setQualityVersion] = useState(0);

  // Token usage accumulated across the session.
  const [tokenRecords, setTokenRecords] = useState<OperationTokenRecord[]>([]);

  const generated = emails.length > 0;
  const generatedOk = useMemo(() => emails.filter((e) => e.status === "generated"), [emails]);

  const summary: QualitySummary | null = qualityRun
    ? summarise(emails.map((e) => e.quality))
    : null;

  // Plain-text summary passed to the quality-check engine (its interface is
  // unchanged — it still receives a string).
  const dataFactsSerialized = useMemo(
    () => serializeDataFacts(dataFactsRows),
    [dataFactsRows]
  );

  // Derived (not stored) — the full token/cost summary for the session.
  const tokenSummary = useMemo(() => computeSessionSummary(tokenRecords), [tokenRecords]);

  function handleExtracted(
    e: PdfExtraction,
    fileName: string,
    tokenRecord?: OperationTokenRecord
  ) {
    setExtraction(e);
    setPdfFileName(fileName);
    setPrompt(e.generation_prompt);
    setDataFactsRows(parseDataFactsToRows(e.data_facts_summary));
    setConfirmed(false);
    if (tokenRecord) setTokenRecords((prev) => [...prev, tokenRecord]);
  }

  function scrollToStep(id: string) {
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // ---- Change 1: re-upload / reset handlers ----
  // Re-uploading the PDF resets everything downstream (prompt, data facts, CSV,
  // emails, quality). Re-uploading the CSV keeps the PDF extraction and resets
  // only generation + quality.
  function resetFromPdf() {
    if (generated && !window.confirm("This will clear all generated emails. Are you sure?")) return;
    setExtraction(null);
    setPdfFileName(null);
    setPrompt("");
    setDataFactsRows([]);
    setConfirmed(false);
    setCsv(null);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: 0 });
    setTokenRecords([]);
    setPdfKey((k) => k + 1);
    setCsvKey((k) => k + 1);
    scrollToStep("step-1");
  }

  function resetFromCsv() {
    if (generated && !window.confirm("This will clear all generated emails. Are you sure?")) return;
    setCsv(null);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: 0 });
    // Keep the PDF-extraction token record; drop generation/quality records.
    setTokenRecords((prev) => prev.filter((r) => r.operation === "pdf_extraction"));
    setCsvKey((k) => k + 1);
    scrollToStep("step-3");
  }

  // ---- Step 4/5: batch generation ----
  async function handleGenerate() {
    if (!csv) return;
    const rows = csv.rows;
    setGenerating(true);
    setEmails([]);
    setQualityRun(false);
    setQualityVersion(0);
    setGenProgress({ done: 0, total: rows.length });
    // Fresh run: drop any prior generation/quality token records, keep PDF.
    setTokenRecords((prev) => prev.filter((r) => r.operation === "pdf_extraction"));

    const collected: GeneratedEmail[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, rows: chunk, batchIndex: i / batchSize }),
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

  // ---- Step 6: quality check ----
  async function handleQualityCheck() {
    setQcRunning(true);
    setQcProgress({ done: 0, total: generatedOk.length });
    // Clear any prior quality-check token records before this run.
    setTokenRecords((prev) => prev.filter((r) => r.operation !== "quality_check_layer2"));

    const updated = [...emails];
    const indexByRow = new Map(updated.map((e, idx) => [e.rowIndex, idx]));
    let done = 0;

    const targets = generatedOk;
    for (let i = 0; i < targets.length; i += QC_CONCURRENCY) {
      const slice = targets.slice(i, i + QC_CONCURRENCY);
      await Promise.all(
        slice.map(async (email) => {
          try {
            const res = await fetch("/api/quality-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, dataFactsSummary: dataFactsSerialized }),
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

  // ---- Step 7: export ----
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
          Single-session tool · PDF → personalised pitch emails → quality check → AppScript CSV.
          Nothing is stored; closing the tab clears everything.
        </p>
      </header>

      <div className="space-y-5">
        {/* Step 1 + 2 */}
        <Section
          step={1}
          id="step-1"
          title="Upload research report PDF & review prompt"
          subtitle="Gemini extracts a generation prompt and a data-facts summary. Both are editable."
          done={confirmed}
        >
          {extraction ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">
                ✓ Extracted from <span className="font-medium text-slate-800">{pdfFileName || "PDF"}</span>
              </span>
              <button
                type="button"
                onClick={resetFromPdf}
                disabled={generating || qcRunning}
                className="text-xs font-medium text-brand underline-offset-2 hover:underline disabled:opacity-40"
              >
                Change PDF
              </button>
            </div>
          ) : (
            <PdfUpload key={pdfKey} onExtracted={handleExtracted} disabled={generating || qcRunning} />
          )}
          {extraction && (
            <div className="mt-4 space-y-4">
              <PromptEditor
                prompt={prompt}
                dataFactsRows={dataFactsRows}
                onPromptChange={setPrompt}
                onDataFactsRowsChange={setDataFactsRows}
                disabled={generating || qcRunning}
              />
              <Button
                variant={confirmed ? "secondary" : "primary"}
                onClick={() => setConfirmed(true)}
                disabled={!prompt.trim()}
              >
                {confirmed ? "Prompt confirmed ✓" : "Confirm prompt & data facts"}
              </Button>
            </div>
          )}
        </Section>

        {/* Step 3 */}
        <Section
          step={3}
          id="step-3"
          title="Upload journalist CSV"
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

        {/* Step 4/5 */}
        <Section
          step={4}
          title="Select batch size & generate"
          subtitle="Default batch size 5 to stay under the Vercel Hobby 10s function timeout."
          done={generated && !generating}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">Batch size</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={generating || qcRunning}
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

        {/* Step 5/6/7 — results */}
        {generated && (
          <Section
            step={5}
            title="Review, quality check & export"
            subtitle="Expand any row to inspect the email. Run the quality check, then download the CSV."
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleQualityCheck}
                disabled={qcRunning || generating || qualityRun || generatedOk.length === 0}
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
              <Button variant="secondary" onClick={handleExport} disabled={generating || qcRunning}>
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
        MVP · No auth · No database · Session-only state. Deploy on Vercel (keep batch size 10 on Hobby).
      </footer>

      <TokenCostPanel summary={tokenSummary} />
    </main>
  );
}
