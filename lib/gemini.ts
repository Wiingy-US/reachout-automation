// Server-side Gemini client + prompt builders (spec section 09).
// The API key is read from the environment and never leaves the server.
// Uses the @google/genai SDK with thinking disabled (thinkingBudget: 0).

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { JournalistRow, TokenUsage } from "./types";
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
  dataFactsSummary = ""
): string {
  const dataFactsBlock = dataFactsSummary.trim()
    ? `${buildDataFactsBlock(dataFactsSummary)}\n\n`
    : "";
  return `${basePrompt.trim()}

${GENERATION_OUTPUT_SPEC}

${dataFactsBlock}JOURNALIST PROFILES (generate one block per journalist below):

${buildProfilesBlock(rows)}`;
}

export async function generateBatch(
  basePrompt: string,
  rows: JournalistRow[],
  dataFactsSummary = ""
): Promise<{ raw: string; usage: TokenUsage }> {
  const ai = client();
  const promptText = buildGenerationPrompt(basePrompt, rows, dataFactsSummary);
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
// 9.3 — Quality check judge (per email, Layer 2)
// ---------------------------------------------------------------------------

function buildRubricBlock(): string {
  return LAYER2_CHECKS.map(
    (c) => `- ${c.id}: ${c.question} (ideal answer: ${c.idealAnswer})`
  ).join("\n");
}

const JUDGE_SCHEMA = `{ "checks": [ { "check_id": "string", "model_answer": "Yes" | "No", "pass": true } ], "email_verdict": "PASS" | "FAIL" }`;

export interface JudgeInput {
  dataFactsSummary: string;
  firstName: string;
  lastName: string;
  organisation: string;
  bio: string;
  subject: string;
  email1Html: string;
  followupHtml: string;
}

export interface JudgeCheck {
  check_id: string;
  model_answer: string;
  pass: boolean;
}

export interface JudgeOutput {
  checks: JudgeCheck[];
  email_verdict: "PASS" | "FAIL";
}

export function buildJudgePrompt(input: JudgeInput): string {
  return `You are a strict quality auditor for journalist pitch emails. Evaluate the provided email against the rubric below. Return ONLY a valid JSON object matching the schema exactly. No commentary. No markdown. Every check_id listed in the rubric MUST appear in the output — ${LAYER2_CHECKS.length} checks total — with no extras and no omissions.

PERMITTED DATA FACTS: These are the only statistics and findings the email is allowed to reference.
"""
${input.dataFactsSummary}
"""

JOURNALIST PROFILE (ground truth for personalisation check):
First Name: ${input.firstName}
Last Name: ${input.lastName}
Organisation: ${input.organisation}
Bio: ${input.bio?.trim() ? input.bio.trim() : "(none provided)"}

The bio above is the ONLY source of truth for MAIN-31. When evaluating MAIN-31, check whether every specific claim in the opening hook (specific publications, events, projects, motivations, career moves) can be traced to a fact explicitly stated in the bio above. Pass = every hook claim is traceable to the bio, OR the hook only references their beat/outlet without specific claims. Fail = the hook contains specific details (motivations, named works, career history) that are NOT present in the bio above.

EMAIL UNDER REVIEW:
SUBJECT: ${input.subject}
EMAIL_1_HTML:
"""
${input.email1Html}
"""
FOLLOW_UP_1_HTML:
"""
${input.followupHtml}
"""

RUBRIC (evaluate each; set model_answer to "Yes" or "No"; set pass=true only when model_answer equals the ideal answer):
${buildRubricBlock()}

OUTPUT SCHEMA (return exactly this shape):
${JUDGE_SCHEMA}`;
}

export async function runJudge(
  input: JudgeInput
): Promise<{ output: JudgeOutput; usage: TokenUsage }> {
  const ai = client();
  const promptText = buildJudgePrompt(input);
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
  const json = extractJson(text);
  if (!Array.isArray(json.checks)) {
    throw new Error("Judge response missing 'checks' array");
  }
  return { output: json as JudgeOutput, usage };
}
