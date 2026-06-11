// Quality rubric v2 (29 checks) with weighted scoring. Counts/weights are
// derived from this array — never hardcode them.

import type { CheckResult } from "./types";

export const RUBRIC_CONFIG = {
  subjectMaxChars: 60,
  mainMaxWords: 210,
  followupMaxWords: 90,
  introMaxSentences: 5,
  keyFindingsBullets: 3,
  potentialAnglesBullets: 2,
};

export const SCORING = {
  critical_deduction: 20,
  major_deduction: 10,
  minor_deduction: 5,
  l1_gate_threshold: 60, // L1 must reach this to run L2
  l2_pass_threshold: 70, // L2 must reach this for PASS
  starting_score: 100,
  floor: 0,
};

export type Layer = 1 | 2;
export type Target = "subject" | "main" | "followup";
export type Tier = "critical" | "major" | "minor";

export interface RubricCheck {
  id: string;
  layer: Layer;
  target: Target;
  question: string;
  idealAnswer: "Yes" | "No";
  tier: Tier;
  weight: number; // points deducted on failure
}

// Source entries omit tier/weight; they're derived below from the tier sets.
type RawCheck = Omit<RubricCheck, "tier" | "weight">;

const CRITICAL = new Set(["MAIN-03", "MAIN-04", "MAIN-26", "FUP-02", "FUP-07", "MAIN-01", "MAIN-09"]);
const MAJOR = new Set(["FUP-09", "FUP-11", "MAIN-31", "MAIN-28"]);

function tierFor(id: string): Tier {
  if (CRITICAL.has(id)) return "critical";
  if (MAJOR.has(id)) return "major";
  return "minor";
}
function weightFor(tier: Tier): number {
  return tier === "critical"
    ? SCORING.critical_deduction
    : tier === "major"
    ? SCORING.major_deduction
    : SCORING.minor_deduction;
}

const RAW: RawCheck[] = [
  // ---- LAYER 1 — DETERMINISTIC (17) ----

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

  // ---- LAYER 2 — LLM JUDGE (12) ----

  // Main email
  {
    id: "MAIN-01",
    layer: 2,
    target: "main",
    question: "Do all statistics match the permitted data facts — no hallucinated or altered numbers?",
    idealAnswer: "Yes",
  },
  {
    id: "MAIN-09",
    layer: 2,
    target: "main",
    question:
      "Does the email contain any paragraph over 3 sentences? (3 sentences is the maximum — flag if exceeded)",
    idealAnswer: "No",
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
    id: "MAIN-34",
    layer: 2,
    target: "main",
    question: "Does each Potential Angles bullet have a 3-4 word headline followed by a one-line description?",
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

// Derive the full rubric with tier + weight assigned from the tier sets.
export const RUBRIC: RubricCheck[] = RAW.map((c) => {
  const tier = tierFor(c.id);
  return { ...c, tier, weight: weightFor(tier) };
});

export const LAYER1_CHECKS = RUBRIC.filter((c) => c.layer === 1);
export const LAYER2_CHECKS = RUBRIC.filter((c) => c.layer === 2);

export function getCheck(id: string): RubricCheck | undefined {
  return RUBRIC.find((c) => c.id === id);
}

/** Weighted layer score: start at 100, subtract each failing check's weight. */
export function calculateLayerScore(results: CheckResult[]): number {
  const deductions = results
    .filter((r) => !r.pass)
    .reduce((sum, r) => sum + (getCheck(r.check_id)?.weight ?? SCORING.minor_deduction), 0);
  return Math.max(SCORING.floor, SCORING.starting_score - deductions);
}

/** Pill colour band for a 0-100 score (or -1 = skipped). */
export function scoreBand(score: number): "green" | "amber" | "red" | "skipped" {
  if (score < 0) return "skipped";
  if (score >= 85) return "green";
  if (score >= 70) return "amber";
  return "red";
}
