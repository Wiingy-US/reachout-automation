"use client";

import { useState } from "react";
import { estimateEvaluationCost } from "@/lib/sampling";
import { Button, Spinner } from "./ui";

export function QCSampleSelector({
  totalGenerated,
  isRunning,
  onRun,
}: {
  totalGenerated: number;
  isRunning: boolean;
  onRun: (sample: number | "all") => void;
}) {
  const [mode, setMode] = useState<"all" | "sample">(totalGenerated <= 20 ? "all" : "sample");
  const [sampleSize, setSampleSize] = useState<number>(Math.min(20, totalGenerated));

  const effectiveSize = mode === "all" ? totalGenerated : sampleSize;
  const cost = estimateEvaluationCost({ sampleSize: effectiveSize });

  const radio = (m: "all" | "sample", label: string, hint: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      disabled={isRunning}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        mode === m
          ? "border-brand bg-brand-light text-brand dark:bg-dark-surface3"
          : "border-light-border text-light-text2 hover:bg-light-surface2 dark:border-dark-border dark:text-dark-text2 dark:hover:bg-dark-surface2"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full border ${
          mode === m ? "border-brand bg-brand" : "border-light-text3 dark:border-dark-text3"
        }`}
      />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-light-text3 dark:text-dark-text3">{hint}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {radio("all", "Evaluate all", `(${totalGenerated} emails)`)}
        {radio("sample", "Sample", "")}
      </div>

      {mode === "sample" && (
        <div>
          <input
            type="range"
            min={5}
            max={totalGenerated}
            step={1}
            value={sampleSize}
            disabled={isRunning}
            onChange={(e) => setSampleSize(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <p className="mt-1 text-xs text-light-text3 dark:text-dark-text3">
            {sampleSize} of {totalGenerated} emails (
            {Math.round((sampleSize / totalGenerated) * 100)}%)
          </p>
        </div>
      )}

      {/* Cost estimate */}
      <div className="rounded-lg border border-brand/20 bg-brand-light px-3 py-2 text-xs text-brand dark:bg-brand/10 dark:text-brand-muted">
        <div>
          L1 checks: free · L2 judge: {cost.estimated_calls} API call
          {cost.estimated_calls === 1 ? "" : "s"}
        </div>
        <div>Estimated cost: {cost.formatted}</div>
      </div>

      <Button onClick={() => onRun(mode === "all" ? "all" : sampleSize)} disabled={isRunning}>
        {isRunning ? (
          <>
            <Spinner /> Running quality check…
          </>
        ) : mode === "all" ? (
          `Evaluate All (${totalGenerated} emails)`
        ) : (
          `Evaluate Sample (${sampleSize})`
        )}
      </Button>
    </div>
  );
}
