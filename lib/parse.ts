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
}

const SECTION_LABELS = ["ID", "VERIFICATION", "SUBJECT", "EMAIL1_HTML", "FOLLOWUP1_HTML"];

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

export function parseGenerationOutput(raw: string): ParsedJournalist[] {
  const blocks: string[] = [];

  if (raw.includes(JOURNALIST_START)) {
    const parts = raw.split(JOURNALIST_START).slice(1);
    for (const p of parts) {
      blocks.push(p.split(JOURNALIST_END)[0]);
    }
  } else {
    // Fallback: no delimiters — treat the whole thing as a single block.
    blocks.push(raw);
  }

  return blocks.map((block) => {
    const idRaw = extractSection(block, "ID");
    const idNum = idRaw ? parseInt(idRaw.replace(/[^0-9-]/g, ""), 10) : NaN;
    return {
      id: Number.isFinite(idNum) ? idNum : null,
      verification_summary: extractSection(block, "VERIFICATION"),
      subject: stripQuotes(extractSection(block, "SUBJECT")),
      email_1_html: stripFences(extractSection(block, "EMAIL1_HTML")),
      followup_html: stripFences(extractSection(block, "FOLLOWUP1_HTML")),
    };
  });
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
