"use client";

import { useState } from "react";

export function PromptEditor({
  prompt,
  dataFacts,
  onPromptChange,
  onDataFactsChange,
  disabled,
}: {
  prompt: string;
  dataFacts: string;
  onPromptChange: (v: string) => void;
  onDataFactsChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [factsOpen, setFactsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Generation Prompt (editable)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={disabled}
          rows={14}
          className="code-area w-full rounded-lg border border-slate-300 p-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
        />
      </div>

      <div className="rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => setFactsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <span>
            Data Facts Summary — ground truth for quality check ({dataFacts.trim().split(/\s+/).filter(Boolean).length} words)
          </span>
          <span className={`transition ${factsOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {factsOpen && (
          <div className="border-t border-slate-100 p-3">
            <textarea
              value={dataFacts}
              onChange={(e) => onDataFactsChange(e.target.value)}
              disabled={disabled}
              rows={10}
              className="code-area w-full rounded-lg border border-slate-300 p-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-400">
              Used verbatim by the quality-check judge (MAIN-01) to verify the emails only cite facts present in the PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
