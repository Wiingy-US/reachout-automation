// Server-side Gemini client + prompt builders (spec section 09).
// The API key is read from the environment and never leaves the server.
// Uses the @google/genai SDK with thinking disabled (thinkingBudget: 0).

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { GeneratedEmail, JournalistRow, TokenUsage } from "./types";
import { LAYER2_CHECKS } from "./rubric";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Thinking disabled everywhere — applied to every generateContent() call.
const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } } as const;

function client(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

/** Read text from a @google/genai response (`text` is a getter property). */
function responseText(response: GenerateContentResponse): string {
  const t = (response as { text?: unknown }).text;
  return typeof t === "function" ? (t as () => string)() : ((t as string) ?? "");
}

/** Strip ```json fences and grab the first JSON object from a model response. */
export function extractJson(text: string): any {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(t.slice(start, end + 1));
}

/**
 * Pull token usage from a @google/genai response's usageMetadata. Falls back to
 * a rough length/4 estimate if the SDK doesn't surface metadata. Thinking tokens
 * are excluded from the billed count (we disable thinking via thinkingBudget: 0).
 */
export function extractTokenUsage(
  response: GenerateContentResponse,
  fallbackInput?: string,
  fallbackOutput?: string
): TokenUsage {
  const meta = response.usageMetadata as
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
        totalTokenCount?: number;
      }
    | undefined;

  if (meta?.promptTokenCount !== undefined) {
    const input = meta.promptTokenCount;
    const output = meta.candidatesTokenCount ?? 0;
    const thoughts = meta.thoughtsTokenCount ?? 0;
    if (thoughts > 0) {
      console.warn(
        `[gemini] thoughtsTokenCount=${thoughts} despite thinkingBudget:0 — thinking is still running.`
      );
    }
    // Exclude thinking tokens from the billed total.
    return {
      input_tokens: input,
      output_tokens: output,
      total_tokens: input + output,
    };
  }

  // Fallback estimation (~4 chars per token).
  const input = Math.round((fallbackInput?.length ?? 0) / 4);
  const output = Math.round((fallbackOutput?.length ?? 0) / 4);
  return { input_tokens: input, output_tokens: output, total_tokens: input + output };
}

// ---------------------------------------------------------------------------
// Email generation (per batch)
// ---------------------------------------------------------------------------

export const JOURNALIST_START = "---JOURNALIST_START---";
export const JOURNALIST_END = "---JOURNALIST_END---";

function buildProfilesBlock(rows: JournalistRow[]): string {
  return rows
    .map(
      (r, i) =>
        `Journalist ${i + 1} (id=${r._rowIndex}):
First Name: ${r.first_name}
Last Name: ${r.last_name}
Role: ${r.designation}
Organisation: ${r.organisation}
Beat / Org Media Type: ${r.org_media_type}
About/Bio: ${r.about_bio}`
    )
    .join("\n\n");
}

const GENERATION_OUTPUT_SPEC = `OUTPUT FORMAT — follow exactly.
For EACH journalist, output one block delimited by ${JOURNALIST_START} and ${JOURNALIST_END}.
Inside each block, output these four labelled sections in this exact order:

ID: <the id given for the journalist>
VERIFICATION: <exactly 3 sentences: confirm the journalist's role, reference a recent topic they cover, and explain why the chosen data angle fits their beat>
SUBJECT: <the subject line as plain text, no HTML, no quotes>
EMAIL1_HTML: <full HTML body of the initial pitch. Must open with "Hi [First Name]," and include a "Key Findings" section and a "Potential Angles" section. Max 220 words excluding HTML tags.>
FOLLOWUP1_HTML: <full HTML body of the follow-up. Personalised, references the original pitch. Max 100 words excluding HTML tags.>

Do not output anything outside the delimited blocks. Do not use markdown code fences. Do not use em dashes.`;

function buildDataFactsBlock(dataFactsSummary: string): string {
  return `--- PERMITTED DATA FACTS ---
Use ONLY statistics and findings from this list when writing each email. Select only the facts that are relevant to this specific journalist's beat, organisation, and coverage area. Do not use all facts for every journalist — pick the 2-4 that best fit their specific focus. Do not invent, infer, or extrapolate any figures beyond what is listed here.

${dataFactsSummary.trim()}
--- END DATA FACTS ---`;
}

export function buildGenerationPrompt(
  basePrompt: string,
  rows: JournalistRow[],
  dataFactsSummary = "",
  campaignName = ""
): string {
  const campaignBlock = campaignName.trim()
    ? `CAMPAIGN NAME (use this EXACT text as the study title in every email): ${campaignName.trim()}\n\n`
    : "";
  const dataFactsBlock = dataFactsSummary.trim()
    ? `${buildDataFactsBlock(dataFactsSummary)}\n\n`
    : "";
  return `${basePrompt.trim()}

${GENERATION_OUTPUT_SPEC}

${campaignBlock}${dataFactsBlock}JOURNALIST PROFILES (generate one block per journalist below):

${buildProfilesBlock(rows)}`;
}

export async function generateBatch(
  basePrompt: string,
  rows: JournalistRow[],
  dataFactsSummary = "",
  campaignName = ""
): Promise<{ raw: string; usage: TokenUsage }> {
  const ai = client();
  const promptText = buildGenerationPrompt(basePrompt, rows, dataFactsSummary, campaignName);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    config: {
      temperature: 0.7,
      maxOutputTokens: 16384,
      ...NO_THINKING,
    },
  });
  const raw = responseText(response);
  return { raw, usage: extractTokenUsage(response, promptText, raw) };
}

// ---------------------------------------------------------------------------
// Quality check judge — Layer 2, batched (up to N journalists per call)
// ---------------------------------------------------------------------------

export interface JudgeCheck {
  check_id: string;
  model_answer: string;
  pass: boolean;
}

export interface JudgeBatchItem {
  journalist_email: string;
  checks: JudgeCheck[];
}

// Layer 2 rubric guidance, built from the rubric so it always matches the
// current LAYER2_CHECKS (id, question, ideal answer).
function buildL2RubricBlock(): string {
  return LAYER2_CHECKS.map((c) => `${c.id}: ${c.question} Pass = ${c.idealAnswer}.`).join("\n");
}

function buildBatchJudgePrompt(emails: GeneratedEmail[], dataFactsSummary: string): string {
  const journalistBlocks = emails
    .map((e, i) => {
      const j = e.journalist;
      return `---JOURNALIST ${i + 1}---
Email: ${j.email}
Bio: ${j.about_bio?.trim() ? j.about_bio.trim() : "(none provided)"}
Organisation: ${j.organisation}

SUBJECT: ${e.subject}

EMAIL 1 HTML:
"""
${e.email_1_html}
"""

FOLLOW-UP HTML:
"""
${e.followup_html}
"""`;
    })
    .join("\n\n");

  return `You are a strict quality auditor for journalist pitch emails.

Evaluate each journalist's emails below against the rubric.

Return ONLY a valid JSON array — one object per journalist, in the same order as provided. No commentary, no markdown, no preamble. Every check_id must appear for every journalist.

SCHEMA (one object per journalist):
{ "journalist_email": "...", "checks": [ { "check_id": "MAIN-01", "model_answer": "Yes|No", "pass": true } /* all ${LAYER2_CHECKS.length} L2 checks */ ], "verdict": "PASS|FAIL" }

The ${LAYER2_CHECKS.length} check_ids to include for every journalist, in order:
${LAYER2_CHECKS.map((c) => c.id).join(", ")}

PERMITTED DATA FACTS (ground truth for all journalists):
"""
${dataFactsSummary}
"""

RUBRIC (${LAYER2_CHECKS.length} checks total — every check_id above must appear; set pass=true only when the ideal condition is met):
${buildL2RubricBlock()}

NOW EVALUATE EACH JOURNALIST:

${journalistBlocks}`;
}

/** Strip markdown fences and parse the first JSON array in the text. */
function extractJsonArray(text: string): any[] {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in batch judge response");
  }
  const parsed = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Batch judge response is not an array");
  return parsed;
}

/**
 * Evaluate up to N journalists' emails in a single Gemini call. Returns the
 * per-journalist check arrays plus the (batch) token usage. Throws if the
 * response can't be parsed at all — the caller decides how to mark the batch.
 */
export async function runLayer2JudgeBatch(
  emails: GeneratedEmail[],
  dataFactsSummary: string
): Promise<{ items: JudgeBatchItem[]; usage: TokenUsage }> {
  const ai = client();
  const promptText = buildBatchJudgePrompt(emails, dataFactsSummary);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    config: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 16384,
      ...NO_THINKING,
    },
  });
  const text = responseText(response);
  const usage = extractTokenUsage(response, promptText, text);
  const arr = extractJsonArray(text);
  const items: JudgeBatchItem[] = arr.map((o) => ({
    journalist_email: String(o?.journalist_email ?? ""),
    checks: Array.isArray(o?.checks) ? (o.checks as JudgeCheck[]) : [],
  }));
  return { items, usage };
}
