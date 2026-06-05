// Helpers to convert between the plain-text data_facts_summary that Gemini
// returns / the quality engine consumes, and the editable table rows shown in
// the UI (Change 2).

import { DataFactRow } from "./types";

export const FACT_CATEGORIES = [
  "Demographics",
  "Behaviour",
  "Geography",
  "Economic",
  "Other",
];

/** Strip leading bullets / numbering from a fact line. */
function cleanLine(s: string): string {
  return s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
}

/**
 * Parse the plain-text data_facts_summary into one row per fact. Splits on
 * newlines first; if that yields a single block, falls back to sentence
 * boundaries. Category defaults to "Other"; the user can refine inline.
 */
export function parseDataFactsToRows(text: string): DataFactRow[] {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  let pieces = trimmed
    .split(/\r?\n+/)
    .map(cleanLine)
    .filter(Boolean);

  if (pieces.length <= 1) {
    pieces = trimmed
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map(cleanLine)
      .filter(Boolean);
  }

  return pieces.map((stat) => ({ stat, category: "Other", source: "" }));
}

/**
 * Serialise the table back into a plain-text paragraph for the quality-check
 * engine — one sentence per row, joining the stat with its category (and
 * source/context when present). The engine still receives a plain string.
 */
export function serializeDataFacts(rows: DataFactRow[]): string {
  return rows
    .filter((r) => r.stat.trim())
    .map((r) => {
      const stat = r.stat.trim();
      const ended = /[.!?]$/.test(stat) ? stat : `${stat}.`;
      const context = r.source.trim() ? `, ${r.source.trim()}` : "";
      return `${ended} (${r.category || "Other"}${context})`;
    })
    .join(" ");
}
