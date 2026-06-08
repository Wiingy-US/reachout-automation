// The quality rubric (v2). Counts are derived dynamically from this array
// (LAYER1_CHECKS / LAYER2_CHECKS) — never hardcode them elsewhere.
//
// Layer 1 (deterministic) is evaluated server-side with pure string/regex/HTML
// parsing — see lib/deterministicChecks.ts.
// Layer 2 (LLM judge) is evaluated by Gemini — the judge prompt in lib/gemini.ts
// builds its rubric block from LAYER2_CHECKS.

export const RUBRIC_CONFIG = {
  subjectMaxChars: 60,
  mainMaxWords: 210,
  followupMaxWords: 90,
  introMaxSentences: 5,
  keyFindingsBullets: 3,
  potentialAnglesBullets: 2,
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
  // -------------------------------------------------------------------------
  // LAYER 1 — DETERMINISTIC
  // -------------------------------------------------------------------------

  // Subject
  {
    id: "SUB-02",
    layer: 1,
    target: "subject",
    question: `Is the subject line under ${RUBRIC_CONFIG.subjectMaxChars} characters?`,
    idealAnswer: "Yes",
  },
  {
    id: "SUB-03",
    layer: 1,
    target: "subject",
    question: "Does the subject line contain ALL CAPS words?",
    idealAnswer: "No",
  },

  // Main email
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
    question: "Does the email open with 'Hi [First Name],' exactly?",
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
    question: "Does the email include both 'Key Findings:' and 'Potential Angles:' labels?",
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
    id: "MAIN-23",
    layer: 1,
    target: "main",
    question: `Does the Key Findings section contain exactly ${RUBRIC_CONFIG.keyFindingsBullets} bullets?`,
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-24",
    layer: 1,
    target: "main",
    question: `Does the Potential Angles section contain exactly ${RUBRIC_CONFIG.potentialAnglesBullets} bullets?`,
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-25",
    layer: 1,
    target: "main",
    question: "Does the email sign-off end with exactly 'Best,' and nothing after it?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-26",
    layer: 1,
    target: "main",
    question:
      "Does the email contain forbidden HTML tags (<html>, <head>, <body>, <style>, <title>, <meta>, <!DOCTYPE>)?",
    idealAnswer: "No",
  },

  // Follow-up
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
  {
    id: "FUP-09",
    layer: 1,
    target: "followup",
    question: "Does the follow-up contain a 'Potential Angles' section?",
    idealAnswer: "No",
  },
  {
    id: "FUP-10",
    layer: 1,
    target: "followup",
    question: "Does the follow-up sign-off end with exactly 'Best,' and nothing after it?",
    idealAnswer: "Yes",
  },

  // -------------------------------------------------------------------------
  // LAYER 2 — LLM JUDGE
  // -------------------------------------------------------------------------

  // Main email
  {
    id: "MAIN-01",
    layer: 2,
    target: "main",
    question:
      "Do all statistics match the permitted data facts — no hallucinated or altered numbers?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-09",
    layer: 2,
    target: "main",
    question: "Are all paragraphs appropriate length — no overly long blocks?",
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
    question: `Is the introduction (before Key Findings) ${RUBRIC_CONFIG.introMaxSentences} sentences or fewer?`,
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-28",
    layer: 2,
    target: "main",
    question: "Do at least 2 of the 3 Key Findings bullets contain a real figure or number?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-30",
    layer: 2,
    target: "main",
    question:
      "Are the three Key Findings independent — no restatement of the same stat or cause-and-effect?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-31",
    layer: 2,
    target: "main",
    question:
      "Does the opening hook reference only facts from the journalist's supplied bio — no invented work, employer, or beat?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-33",
    layer: 2,
    target: "main",
    question:
      "Does the intro consist of exactly two paragraphs before Key Findings (hook paragraph + Wiingy/study paragraph)?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-34",
    layer: 2,
    target: "main",
    question:
      "Does each Potential Angles bullet have a 3-4 word headline followed by a one-line description?",
    idealAnswer: "Yes",
  },

  // Follow-up
  {
    id: "FUP-06",
    layer: 2,
    target: "followup",
    question: "Are all follow-up paragraphs appropriate length — no overly long blocks?",
    idealAnswer: "Yes",
  },
  {
    id: "FUP-08",
    layer: 2,
    target: "followup",
    question: "Does the follow-up mention page count or page numbers?",
    idealAnswer: "No",
  },
  {
    id: "FUP-11",
    layer: 2,
    target: "followup",
    question: "Does the follow-up open by restating a specific finding or city from the initial pitch?",
    idealAnswer: "Yes",
  },
];

export const LAYER1_CHECKS = RUBRIC.filter((c) => c.layer === 1);
export const LAYER2_CHECKS = RUBRIC.filter((c) => c.layer === 2);

export function getCheck(id: string): RubricCheck | undefined {
  return RUBRIC.find((c) => c.id === id);
}
