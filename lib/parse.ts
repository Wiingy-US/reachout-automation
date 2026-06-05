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
}

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
  const rawBlocks: string[] = [];
  const delimiterFound = raw.includes(JOURNALIST_START);

  if (delimiterFound) {
    const parts = raw.split(JOURNALIST_START).slice(1);
    for (const p of parts) {
      rawBlocks.push(p.split(JOURNALIST_END)[0]);
    }
  } else {
    // Fallback: no delimiters at all — likely truncated/malformed output.
    // Log a sample of what Gemini actually returned so we can diagnose.
    console.warn(
      "[parse] No ---JOURNALIST_START--- delimiters found in Gemini output. First 500 chars:\n" +
        raw.slice(0, 500)
    );
    rawBlocks.push(raw);
  }

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
        missingSections.length > 0
          ? `Missing section: ${missingSections.join(", ")}`
          : undefined,
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
