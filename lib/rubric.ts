// The 19-check quality rubric (spec section 05).
//
// Layer 1 (deterministic, 12 checks) is evaluated server-side with pure
// string/regex/HTML parsing — see lib/deterministicChecks.ts.
// Layer 2 (LLM judge, 10 checks) is evaluated by Gemini — see the judge prompt
// in lib/gemini.ts.
//
// NOTE ON THRESHOLDS: a few numeric thresholds (subject word limit, max bolds,
// paragraph length) are not spelled out verbatim in the MVP spec, which refers
// to an external SOP. Sensible, SOP-aligned defaults are centralised here in
// RUBRIC_CONFIG so they are easy to tune in one place.

export const RUBRIC_CONFIG = {
  subjectMaxWords: 12,
  mainMaxWords: 220,
  followupMaxWords: 100,
  introMaxSentences: 5,
};

export type Layer = 1 | 2;
export type Target = "subject" | "main" | "followup";

export interface RubricCheck {
  id: string;
  layer: Layer;
  target: Target;
  question: string;
  idealAnswer: "Yes" | "No";
}

export const RUBRIC: RubricCheck[] = [
  // ---- Layer 1 — deterministic ----
  {
    id: "SUB-01",
    layer: 1,
    target: "subject",
    question: `Is the subject line ${RUBRIC_CONFIG.subjectMaxWords} words or fewer?`,
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-02",
    layer: 1,
    target: "main",
    question: "Does the email reference the journalist's organisation?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-03",
    layer: 1,
    target: "main",
    question: "Does the email open with 'Hi [First Name],' using the journalist's first name?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-04",
    layer: 1,
    target: "main",
    question: "Does the email contain an em dash (—)?",
    idealAnswer: "No",
  },
  {
    id: "MAIN-07",
    layer: 1,
    target: "main",
    question: "Does the email include both 'Key Findings' and 'Potential Angles' sections?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-10",
    layer: 1,
    target: "main",
    question: "Does the email contain the literal word 'pdf'?",
    idealAnswer: "No",
  },
  {
    id: "MAIN-13",
    layer: 1,
    target: "main",
    question: `Is the email body ${RUBRIC_CONFIG.mainMaxWords} words or fewer (HTML stripped)?`,
    idealAnswer: "Yes",
  },
  {
    id: "FUP-01",
    layer: 1,
    target: "followup",
    question: `Is the follow-up ${RUBRIC_CONFIG.followupMaxWords} words or fewer (HTML stripped)?`,
    idealAnswer: "Yes",
  },
  {
    id: "FUP-02",
    layer: 1,
    target: "followup",
    question: "Does the follow-up contain an em dash (—)?",
    idealAnswer: "No",
  },
  {
    id: "FUP-07",
    layer: 1,
    target: "followup",
    question: "Does the follow-up contain the literal word 'pdf'?",
    idealAnswer: "No",
  },

  // ---- Layer 2 — LLM judge ----
  {
    id: "MAIN-01",
    layer: 2,
    target: "main",
    question:
      "Do ALL statistics, percentages and data points in the email appear in the PERMITTED DATA FACTS? (no hallucinated or altered numbers)",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-06",
    layer: 2,
    target: "main",
    question: "Does the email end with an appropriate professional sign-off?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-09",
    layer: 2,
    target: "main",
    question: "Are all paragraphs an appropriate length (no overly long blocks of text)?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-11",
    layer: 2,
    target: "main",
    question: "Does the email mention a page count or page numbers from the report?",
    idealAnswer: "No",
  },
  {
    id: "MAIN-12",
    layer: 2,
    target: "main",
    question: `Is the introduction (text before the Key Findings section) ${RUBRIC_CONFIG.introMaxSentences} sentences or fewer?`,
    idealAnswer: "Yes",
  },
  {
    id: "FUP-03",
    layer: 2,
    target: "followup",
    question: "Is every statistic or factual claim in the follow-up attributed to a source / citation?",
    idealAnswer: "Yes",
  },
  {
    id: "FUP-04",
    layer: 2,
    target: "followup",
    question: "Does the follow-up end with an appropriate professional sign-off?",
    idealAnswer: "Yes",
  },
  {
    id: "FUP-06",
    layer: 2,
    target: "followup",
    question: "Are all follow-up paragraphs an appropriate length (no overly long blocks)?",
    idealAnswer: "Yes",
  },
  {
    id: "FUP-08",
    layer: 2,
    target: "followup",
    question: "Does the follow-up mention a page count or page numbers from the report?",
    idealAnswer: "No",
  },
];

export const LAYER1_CHECKS = RUBRIC.filter((c) => c.layer === 1);
export const LAYER2_CHECKS = RUBRIC.filter((c) => c.layer === 2);

export function getCheck(id: string): RubricCheck | undefined {
  return RUBRIC.find((c) => c.id === id);
}
