// Server-side Gemini client + prompt builders (spec section 09).
// The API key is read from the environment and never leaves the server.

import { GenerateContentResponse, GoogleGenerativeAI } from "@google/generative-ai";
import { JournalistRow, TokenUsage } from "./types";
import { LAYER2_CHECKS } from "./rubric";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function client(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
  return new GoogleGenerativeAI(key);
}

function getModel() {
  return client().getGenerativeModel({ model: MODEL });
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
 * Pull token usage from a Gemini response's usageMetadata. Falls back to a
 * rough length/4 estimate if the SDK doesn't surface metadata.
 */
export function extractTokenUsage(
  response: GenerateContentResponse,
  fallbackInput?: string,
  fallbackOutput?: string
): TokenUsage {
  const meta = response.usageMetadata;
  if (meta?.promptTokenCount !== undefined) {
    const input = meta.promptTokenCount;
    const output = meta.candidatesTokenCount ?? 0;
    return {
      input_tokens: input,
      output_tokens: output,
      total_tokens: meta.totalTokenCount ?? input + output,
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
  const model = getModel();
  const promptText = buildGenerationPrompt(basePrompt, rows, dataFactsSummary);
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
  });
  const raw = res.response.text();
  return { raw, usage: extractTokenUsage(res.response, promptText, raw) };
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
  return `You are a strict quality auditor for journalist pitch emails. Evaluate the provided email against the rubric below. Return ONLY a valid JSON object matching the schema exactly. No commentary. No markdown. Every check_id in the rubric MUST appear in the output, with no extras and no omissions.

PERMITTED DATA FACTS: These are the only statistics and findings the email is allowed to reference.
"""
${input.dataFactsSummary}
"""

JOURNALIST CONTEXT:
First name: ${input.firstName}
Last name: ${input.lastName}
Organisation: ${input.organisation}

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
  const model = getModel();
  const promptText = buildJudgePrompt(input);
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  const text = res.response.text();
  const usage = extractTokenUsage(res.response, promptText, text);
  const json = extractJson(text);
  if (!Array.isArray(json.checks)) {
    throw new Error("Judge response missing 'checks' array");
  }
  return { output: json as JudgeOutput, usage };
}
