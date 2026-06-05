// Shared types for the Digital PR Outreach MVP.

export interface JournalistRow {
  first_name: string;
  last_name: string;
  email: string;
  organisation: string;
  designation: string;
  org_media_type: string;
  about_bio: string;
  // Index of the row in the originally uploaded CSV (0-based, data rows only).
  _rowIndex: number;
}

export interface CsvValidationResult {
  rows: JournalistRow[];
  totalRows: number;
  missingColumns: string[];
  // Row indices (0-based) that are missing a critical field.
  invalidRows: { rowIndex: number; missing: string[] }[];
}

export interface PdfExtraction {
  generation_prompt: string;
  data_facts_summary: string;
}

export type GenerationStatus = "generated" | "generation_failed";

export interface GeneratedEmail {
  rowIndex: number;
  journalist: JournalistRow;
  status: GenerationStatus;
  error?: string;
  verification_summary: string;
  subject: string;
  email_1_html: string;
  followup_html: string;
  quality?: EmailQualityResult;
}

// ---- Quality check ----

export type Answer = "Yes" | "No";

export interface CheckResult {
  check_id: string;
  question: string;
  model_answer: string; // may include specifics, e.g. "No — 234 words"
  pass: boolean;
}

export interface EmailQualityResult {
  layer1: CheckResult[];
  layer2: CheckResult[];
  layer2Skipped: boolean; // true when Layer 1 failed so the LLM judge was not called
  verdict: "PASS" | "FAIL";
}

export interface QualitySummary {
  evaluated: number;
  pass: number;
  fail: number;
  passRate: number; // 0-100
}
