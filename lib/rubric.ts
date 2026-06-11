// Quality rubric v3. Counts are derived from this array (LAYER1_CHECKS /
// LAYER2_CHECKS) — never hardcode them elsewhere.
//
// Layer 1 (deterministic) is evaluated server-side with pure string/regex/HTML
// parsing — see lib/deterministicChecks.ts.
// Layer 2 (LLM judge) is evaluated by Gemini in batches — see the batch judge
// prompt in lib/gemini.ts.

export const RUBRIC_CONFIG = {
  subjectMaxChars: 60,
  mainMaxWords: 210,
  followupMaxWords: 90,
  introMaxSentences: 5,
  keyFindingsBullets: 3,
  potentialAnglesBullets: 2,
  followupBullets: 2,
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
  // ---- LAYER 1 — DETERMINISTIC (19) ----

  // Subject
  {
    id: "SUB-02",
    layer: 1,
    target: "subject",
    question: "Is the subject line under 60 characters?",
    idealAnswer: "Yes",
  },
  {
    id: "SUB-03",
    layer: 1,
    target: "subject",
    question: "Does the subject line contain ALL CAPS words (excluding whitelisted abbreviations)?",
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
    question: "Are both 'Key Findings:' and 'Potential Angles:' labels present AND wrapped in <b> tags?",
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
    question: "Is the email body 210 words or fewer (HTML stripped)?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-23",
    layer: 1,
    target: "main",
    question: "Does the Key Findings section contain exactly 3 bullets?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-24",
    layer: 1,
    target: "main",
    question: "Does the Potential Angles section contain exactly 2 bullets?",
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
      "Does the email contain forbidden HTML tags (<html> <head> <body> <style> <title> <meta> <!DOCTYPE>)?",
    idealAnswer: "No",
  },
  {
    id: "MAIN-36",
    layer: 1,
    target: "main",
    question: "Does the CTA paragraph contain a question mark (CTA phrased as a question)?",
    idealAnswer: "Yes",
  },

  // Follow-up
  {
    id: "FUP-01",
    layer: 1,
    target: "followup",
    question: "Is the follow-up body 90 words or fewer (HTML stripped)?",
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
  {
    id: "FUP-13",
    layer: 1,
    target: "followup",
    question: "Does the follow-up contain exactly 2 bullets?",
    idealAnswer: "Yes",
  },

  // ---- LAYER 2 — LLM JUDGE (11) ----

  // Main email
  {
    id: "MAIN-01",
    layer: 2,
    target: "main",
    question: "Do all statistics match the permitted data facts — no hallucinated or altered numbers?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-12",
    layer: 2,
    target: "main",
    question: "Is the introduction (before Key Findings) 5 sentences or fewer?",
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
    question: "Are the three Key Findings independent — no restatement of the same stat or cause-effect?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-31",
    layer: 2,
    target: "main",
    question:
      "Does the opening hook reference only facts from the journalist's supplied bio — no invented work or employer?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-33",
    layer: 2,
    target: "main",
    question: "Does the intro consist of exactly two paragraphs before Key Findings?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-37",
    layer: 2,
    target: "main",
    question:
      "Does each Key Finding bullet contain a bolded stat-phrase (a number with its 1-3 word descriptor — not a number alone or city name alone)?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-38",
    layer: 2,
    target: "main",
    question: "Is the study title referenced verbatim using the exact EMAIL TITLE from the verified data?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-39",
    layer: 2,
    target: "main",
    question:
      "If the journalist covers a city present in the verified data, does the lead Key Finding use that city's specific figures?",
    idealAnswer: "Yes",
  },

  // Follow-up
  {
    id: "FUP-11",
    layer: 2,
    target: "followup",
    question: "Does the follow-up reconnect to a specific finding or topic from the initial pitch?",
    idealAnswer: "Yes",
  },
  {
    id: "FUP-12",
    layer: 2,
    target: "followup",
    question: "Are both follow-up bullets fresh data points not used in the initial pitch?",
    idealAnswer: "Yes",
  },
];

export const LAYER1_CHECKS = RUBRIC.filter((c) => c.layer === 1);
export const LAYER2_CHECKS = RUBRIC.filter((c) => c.layer === 2);

export function getCheck(id: string): RubricCheck | undefined {
  return RUBRIC.find((c) => c.id === id);
}
