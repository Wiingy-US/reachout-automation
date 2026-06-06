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

// ---- Token usage & cost tracking ----

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface CostEstimate {
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
}

export interface OperationTokenRecord {
  operation: "email_generation" | "quality_check_layer2";
  batch_index?: number; // which batch this was (for generation)
  journalist_email?: string; // which journalist (for quality check)
  token_usage: TokenUsage;
  cost_estimate: CostEstimate;
  timestamp: string; // ISO string
}

export interface SessionTokenSummary {
  records: OperationTokenRecord[];
  totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
  };
  breakdown: {
    email_generation: TokenUsage & CostEstimate;
    quality_check: TokenUsage & CostEstimate;
  };
}
