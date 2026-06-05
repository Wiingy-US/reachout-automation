// Parser for the delimited batch generation output (spec 9.2).
// Splits the model response into per-journalist blocks and extracts the
// labelled sections. Resilient to minor whitespace/casing variation.

import { JOURNALIST_END, JOURNALIST_START } from "./gemini";

export interface ParsedJournalist {
  id: number | null;
  verification_summary: string;
  subject: string;
  email_1_html: string;
  followup_html: string;
  // Names of required sections that were missing/empty in this block.
  missingSections: string[];
  // Set when this block is unusable; surfaced to the client as the failure reason.
  error_reason?: string;
}

export interface ParseResult {
  blocks: ParsedJournalist[];
  delimiterFound: boolean;
  // Set when the whole response is unusable (empty / too short / no blocks) —
  // every row in the batch should fail with this reason.
  batchError?: string;
}

// Below this length a delimiter-less response is treated as truncated junk.
const MIN_USABLE_CHARS = 40;

const SECTION_LABELS = ["ID", "VERIFICATION", "SUBJECT", "EMAIL1_HTML", "FOLLOWUP1_HTML"];
// Sections that must be present and non-empty for a block to be usable.
const REQUIRED_SECTIONS = ["VERIFICATION", "SUBJECT", "EMAIL1_HTML", "FOLLOWUP1_HTML"];

function extractSection(block: string, label: string): string {
  // Match LABEL: ... up to the next known label or end of block.
  const others = SECTION_LABELS.filter((l) => l !== label).join("|");
  const re = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${others})\\s*:|$)`,
    "i"
  );
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

export function parseGenerationOutput(raw: string): ParseResult {
  const delimiterFound = raw.includes(JOURNALIST_START);
  const trimmed = raw.trim();

  // Batch-level failures: the whole response is unusable.
  if (!trimmed) {
    return { blocks: [], delimiterFound: false, batchError: "Empty response from model" };
  }
  if (!delimiterFound) {
    console.warn(
      "[parse] No ---JOURNALIST_START--- delimiters found in Gemini output. First 500 chars:\n" +
        raw.slice(0, 500)
    );
    const batchError =
      trimmed.length < MIN_USABLE_CHARS
        ? `Model response too short to contain valid output (${trimmed.length} chars)`
        : "No journalist blocks found in model response — possible truncation";
    return { blocks: [], delimiterFound: false, batchError };
  }

  const rawBlocks: string[] = raw
    .split(JOURNALIST_START)
    .slice(1)
    .map((p) => p.split(JOURNALIST_END)[0]);

  const blocks = rawBlocks.map((block) => {
    const idRaw = extractSection(block, "ID");
    const idNum = idRaw ? parseInt(idRaw.replace(/[^0-9-]/g, ""), 10) : NaN;

    const verification_summary = extractSection(block, "VERIFICATION");
    const subject = stripQuotes(extractSection(block, "SUBJECT"));
    const email_1_html = stripFences(extractSection(block, "EMAIL1_HTML"));
    const followup_html = stripFences(extractSection(block, "FOLLOWUP1_HTML"));

    const values: Record<string, string> = {
      VERIFICATION: verification_summary,
      SUBJECT: subject,
      EMAIL1_HTML: email_1_html,
      FOLLOWUP1_HTML: followup_html,
    };
    const missingSections = REQUIRED_SECTIONS.filter((s) => !values[s]);

    return {
      id: Number.isFinite(idNum) ? idNum : null,
      verification_summary,
      subject,
      email_1_html,
      followup_html,
      missingSections,
      error_reason:
        missingSections.length > 0 ? `Missing section: ${missingSections[0]}` : undefined,
    };
  });

  return { blocks, delimiterFound };
}

function stripQuotes(s: string): string {
  return s.replace(/^["'`]+|["'`]+$/g, "").trim();
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
