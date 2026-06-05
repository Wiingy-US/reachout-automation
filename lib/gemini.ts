// Server-side Gemini client + prompt builders (spec section 09).
// The API key is read from the environment and never leaves the server.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { JournalistRow, PdfExtraction } from "./types";
import { LAYER2_CHECKS } from "./rubric";

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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

// ---------------------------------------------------------------------------
// 9.1 — PDF extraction
// ---------------------------------------------------------------------------

const PDF_SYSTEM_INSTRUCTION = `You are a campaign analyst for a Digital PR agency. You will be given a research report PDF. Extract two things and return them as a JSON object with keys "generation_prompt" and "data_facts_summary". Return valid JSON only — no markdown, no preamble.

"generation_prompt": A full SOP-compliant Gemini prompt for journalist email outreach. It MUST include:
- A role declaration: "You are a Senior Media Relations Strategist".
- 2 to 5 content angles derived from the PDF, each listing the specific statistics that angle is permitted to use.
- A personalisation instruction (tailor each email to the journalist's beat, organisation and recent work).
- Hard constraints, stated explicitly: no em dashes anywhere; maximum 7 bolded elements; use ONLY facts present in this report; every email body must open with "Hi [First Name],"; the subject line must be returned as plain text above the HTML; the follow-up must be at most 50% of the length of Email 1; no markdown artefacts in the HTML.
- An output format spec describing the required 3-part output per journalist: a verification summary, Email 1 as HTML, and Follow-Up 1 as HTML. Email 1 must contain a "Key Findings" section and a "Potential Angles" section.

"data_facts_summary": A plain-text structured list of EVERY key statistic, percentage, finding and data point in the PDF, written as clear declarative sentences. No HTML, no bullet/markdown characters. Approximately 300-500 words. This is used verbatim as the ground-truth source for quality-checking whether emails hallucinate statistics.`;

export async function extractFromPdf(
  base64Pdf: string,
  mimeType = "application/pdf"
): Promise<PdfExtraction> {
  const model = getModel();
  const res = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: PDF_SYSTEM_INSTRUCTION },
          { inlineData: { data: base64Pdf, mimeType } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });
  const json = extractJson(res.response.text());
  if (typeof json.generation_prompt !== "string" || typeof json.data_facts_summary !== "string") {
    throw new Error("PDF extraction returned an unexpected shape");
  }
  return {
    generation_prompt: json.generation_prompt,
    data_facts_summary: json.data_facts_summary,
  };
}

// ---------------------------------------------------------------------------
// 9.2 — Email generation (per batch)
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

export function buildGenerationPrompt(
  basePrompt: string,
  rows: JournalistRow[]
): string {
  return `${basePrompt}

${GENERATION_OUTPUT_SPEC}

JOURNALIST PROFILES (generate one block per journalist below):

${buildProfilesBlock(rows)}`;
}

export async function generateBatch(
  basePrompt: string,
  rows: JournalistRow[]
): Promise<string> {
  const model = getModel();
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildGenerationPrompt(basePrompt, rows) }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  });
  return res.response.text();
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

export async function runJudge(input: JudgeInput): Promise<JudgeOutput> {
  const model = getModel();
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildJudgePrompt(input) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  const json = extractJson(res.response.text());
  if (!Array.isArray(json.checks)) {
    throw new Error("Judge response missing 'checks' array");
  }
  return json as JudgeOutput;
}
