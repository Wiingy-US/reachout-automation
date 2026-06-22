// Client-side journalist CSV parsing + validation (spec 3.2).

import Papa from "papaparse";
import { CsvValidationResult, JournalistRow } from "./types";

export const REQUIRED_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "organisation",
  "designation",
  "org_media_type",
  "about_bio",
] as const;

// Fields whose absence makes a row unusable for generation (spec 3.2).
export const CRITICAL_FIELDS = ["email", "first_name", "about_bio"] as const;

export const MAX_ROWS = 600;

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseJournalistCsv(text: string): CsvValidationResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normaliseHeader,
  });

  const headers = parsed.meta.fields?.map(normaliseHeader) ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));

  const rows: JournalistRow[] = [];
  const invalidRows: CsvValidationResult["invalidRows"] = [];

  (parsed.data || []).forEach((raw, i) => {
    const get = (k: string) => (raw[k] ?? "").toString().trim();
    const row: JournalistRow = {
      first_name: get("first_name"),
      last_name: get("last_name"),
      email: get("email"),
      organisation: get("organisation"),
      designation: get("designation"),
      org_media_type: get("org_media_type"),
      about_bio: get("about_bio"),
      _rowIndex: i,
    };

    const missing = CRITICAL_FIELDS.filter((f) => !row[f]);
    if (missing.length > 0) {
      invalidRows.push({ rowIndex: i, missing: [...missing] });
    }
    rows.push(row);
  });

  return {
    rows: rows.slice(0, MAX_ROWS),
    totalRows: rows.length,
    missingColumns,
    invalidRows: invalidRows.filter((r) => r.rowIndex < MAX_ROWS),
  };
}
