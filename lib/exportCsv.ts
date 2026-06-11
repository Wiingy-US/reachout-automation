// CSV export (spec section 07). AppScript columns + two quality columns.

import { GeneratedEmail } from "./types";
import { findUnclosedTags } from "./htmlUtils";

export const EXPORT_COLUMNS = [
  "Email",
  "Subject",
  "HTML Body main email",
  "HTML Body followup email",
  "l1_score",
  "l2_score",
  "quality_verdict",
  "failed_checks",
] as const;

function csvCell(value: string): string {
  const v = value ?? "";
  // Always quote and escape — bodies contain commas, quotes and newlines.
  return `"${v.replace(/"/g, '""')}"`;
}

export function buildExportCsv(emails: GeneratedEmail[], qualityRun: boolean): string {
  const header = EXPORT_COLUMNS.join(",");
  const lines = emails.map((e) => {
    let l1 = "NOT_EVALUATED";
    let l2 = "NOT_EVALUATED";
    let verdict = "NOT_EVALUATED";
    let failed = "";
    if (qualityRun && e.quality) {
      l1 = String(e.quality.layer1_score);
      l2 = e.quality.layer2_score < 0 ? "—" : String(e.quality.layer2_score);
      verdict = e.quality.verdict;
      const ids = [...e.quality.layer1, ...e.quality.layer2]
        .filter((c) => !c.pass)
        .map((c) => c.check_id);
      failed = verdict === "PASS" ? "" : ids.join(", ");
    }
    return [
      csvCell(e.journalist.email),
      csvCell(e.subject),
      csvCell(e.email_1_html),
      csvCell(e.followup_html),
      csvCell(l1),
      csvCell(l2),
      csvCell(verdict),
      csvCell(failed),
    ].join(",");
  });
  return [header, ...lines].join("\r\n");
}

export interface HtmlWarning {
  rowIndex: number;
  journalist: string;
  field: "main" | "followup";
  unclosed: string[];
}

/** Pre-export HTML validation (spec 7 "HTML validation before export"). */
export function validateExportHtml(emails: GeneratedEmail[]): HtmlWarning[] {
  const warnings: HtmlWarning[] = [];
  emails.forEach((e) => {
    const name = `${e.journalist.first_name} ${e.journalist.last_name}`.trim();
    const mainUnclosed = findUnclosedTags(e.email_1_html);
    if (mainUnclosed.length) {
      warnings.push({ rowIndex: e.rowIndex, journalist: name, field: "main", unclosed: mainUnclosed });
    }
    const fupUnclosed = findUnclosedTags(e.followup_html);
    if (fupUnclosed.length) {
      warnings.push({ rowIndex: e.rowIndex, journalist: name, field: "followup", unclosed: fupUnclosed });
    }
  });
  return warnings;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
