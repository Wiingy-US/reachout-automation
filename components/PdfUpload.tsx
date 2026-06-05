"use client";

import { useState } from "react";
import { OperationTokenRecord, PdfExtraction } from "@/lib/types";
import { Spinner } from "./ui";

export function PdfUpload({
  onExtracted,
  disabled,
}: {
  onExtracted: (e: PdfExtraction, fileName: string, tokenRecord?: OperationTokenRecord) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF exceeds the 20MB limit.");
      return;
    }
    setFileName(file.name);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      onExtracted(data as PdfExtraction, file.name, data.token_record as OperationTokenRecord | undefined);
    } catch (e: any) {
      setError(e?.message || "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center transition hover:border-brand ${
          disabled || loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {loading ? (
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner /> Extracting prompt & data facts from PDF…
          </span>
        ) : (
          <>
            <span className="text-sm font-medium text-slate-700">
              {fileName ? `Selected: ${fileName}` : "Click to upload research report PDF"}
            </span>
            <span className="mt-1 text-xs text-slate-400">PDF only · max 20MB</span>
          </>
        )}
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
