// Verdict assembly with weighted scoring.

import { CheckResult, EmailQualityResult, QualitySummary } from "./types";
import { LAYER2_CHECKS, SCORING, calculateLayerScore, getCheck } from "./rubric";

/**
 * Normalise the judge's raw checks into CheckResult[], enforcing that every
 * Layer 2 check is present, recomputing pass against the rubric ideal, and
 * attaching layer/tier/weight for display + scoring.
 */
export function normaliseJudgeChecks(
  raw: { check_id: string; model_answer: string; pass?: boolean }[]
): CheckResult[] {
  return LAYER2_CHECKS.map((check) => {
    const base = {
      check_id: check.id,
      question: check.question,
      layer: 2 as const,
      tier: check.tier,
      weight: check.weight,
    };
    const found = raw.find((r) => r.check_id === check.id);
    if (!found) {
      return { ...base, model_answer: "No — missing from judge output", pass: false };
    }
    const answer = (found.model_answer || "").trim();
    const yesNo = /^yes/i.test(answer) ? "Yes" : /^no/i.test(answer) ? "No" : answer;
    const pass = yesNo.toLowerCase() === check.idealAnswer.toLowerCase();
    return { ...base, model_answer: answer || yesNo, pass };
  });
}

/**
 * Assemble a scored verdict. Layer 1 must reach the gate threshold for Layer 2
 * to count; overall PASS requires gate passed AND Layer 2 above its threshold.
 * Pass layer2 = null when the judge was not run (L1 below gate).
 */
export function assembleVerdict(
  layer1: CheckResult[],
  layer2: CheckResult[] | null
): EmailQualityResult {
  const layer1_score = calculateLayerScore(layer1);
  const layer1_passed_gate = layer1_score >= SCORING.l1_gate_threshold;

  if (!layer1_passed_gate || layer2 === null) {
    return {
      layer1,
      layer2: [],
      layer1_score,
      layer2_score: -1,
      layer1_passed_gate,
      layer2_passed: false,
      layer2Skipped: !layer1_passed_gate,
      verdict: "FAIL",
    };
  }

  const layer2_score = calculateLayerScore(layer2);
  const layer2_passed = layer2_score >= SCORING.l2_pass_threshold;
  return {
    layer1,
    layer2,
    layer1_score,
    layer2_score,
    layer1_passed_gate: true,
    layer2_passed,
    layer2Skipped: false,
    verdict: layer2_passed ? "PASS" : "FAIL",
  };
}

export function summarise(results: (EmailQualityResult | undefined)[]): QualitySummary {
  const evald = results.filter(Boolean) as EmailQualityResult[];
  const evaluated = evald.length;
  const pass = evald.filter((r) => r.verdict === "PASS").length;
  const fail = evaluated - pass;

  const avgL1Score =
    evaluated === 0
      ? 0
      : Math.round(evald.reduce((s, r) => s + r.layer1_score, 0) / evaluated);

  const l2Scores = evald.filter((r) => !r.layer2Skipped && r.layer2_score >= 0).map((r) => r.layer2_score);
  const avgL2Score =
    l2Scores.length === 0 ? -1 : Math.round(l2Scores.reduce((a, b) => a + b, 0) / l2Scores.length);

  return {
    evaluated,
    pass,
    fail,
    passRate: evaluated === 0 ? 0 : Math.round((pass / evaluated) * 100),
    avgL1Score,
    avgL2Score,
  };
}

export { getCheck };
