"use client";

import { useState } from "react";
import { CsvValidationResult } from "@/lib/types";
import { MAX_ROWS, REQUIRED_COLUMNS, parseJournalistCsv } from "@/lib/csv";
import { Badge } from "./ui";

export function CsvUpload({
  onParsed,
  disabled,
}: {
  onParsed: (r: CsvValidationResult) => void;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<CsvValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseJournalistCsv(text);
    if (parsed.totalRows === 0) {
      setError("No data rows found in CSV.");
      setResult(null);
      return;
    }
    setResult(parsed);
    onParsed(parsed);
  }

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-6 text-center transition hover:border-brand ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <span className="text-sm font-medium text-slate-700">
          {fileName ? `Selected: ${fileName}` : "Click to upload journalist CSV"}
        </span>
        <span className="mt-1 text-xs text-slate-400">
          Required columns: {REQUIRED_COLUMNS.join(", ")} · max {MAX_ROWS} rows
        </span>
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {Math.min(result.totalRows, MAX_ROWS)} rows loaded
              {result.totalRows > MAX_ROWS ? ` (of ${result.totalRows}, capped at ${MAX_ROWS})` : ""}
            </Badge>
            {result.missingColumns.length === 0 ? (
              <Badge tone="pass">All required columns present</Badge>
            ) : (
              <Badge tone="fail">Missing columns: {result.missingColumns.join(", ")}</Badge>
            )}
            {result.invalidRows.length > 0 ? (
              <Badge tone="warn">{result.invalidRows.length} row(s) missing critical fields</Badge>
            ) : (
              <Badge tone="pass">No rows missing critical fields</Badge>
            )}
          </div>

          {result.invalidRows.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {result.invalidRows.map((r) => (
                <div key={r.rowIndex}>
                  Row {r.rowIndex + 1}: missing {r.missing.join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
