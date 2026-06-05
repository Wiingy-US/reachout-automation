// Verdict assembly (spec 5.4). Combines Layer 1 (deterministic) and Layer 2
// (LLM judge) results into a per-email verdict.

import { CheckResult, EmailQualityResult, QualitySummary } from "./types";
import { LAYER2_CHECKS, getCheck } from "./rubric";

/**
 * Normalise the judge's raw checks into CheckResult[], enforcing that every
 * Layer 2 check is present. pass is recomputed against the rubric's ideal
 * answer so a misbehaving judge can't mark a failing answer as a pass.
 */
export function normaliseJudgeChecks(
  raw: { check_id: string; model_answer: string; pass?: boolean }[]
): CheckResult[] {
  return LAYER2_CHECKS.map((check) => {
    const found = raw.find((r) => r.check_id === check.id);
    if (!found) {
      return {
        check_id: check.id,
        question: check.question,
        model_answer: "No — missing from judge output",
        pass: false,
      };
    }
    const answer = (found.model_answer || "").trim();
    const yesNo = /^yes/i.test(answer) ? "Yes" : /^no/i.test(answer) ? "No" : answer;
    const pass = yesNo.toLowerCase() === check.idealAnswer.toLowerCase();
    return {
      check_id: check.id,
      question: check.question,
      model_answer: answer || yesNo,
      pass,
    };
  });
}

export function assembleVerdict(
  layer1: CheckResult[],
  layer2: CheckResult[] | null
): EmailQualityResult {
  const layer1Pass = layer1.every((c) => c.pass);
  if (!layer1Pass || layer2 === null) {
    return {
      layer1,
      layer2: [],
      layer2Skipped: !layer1Pass,
      verdict: "FAIL",
    };
  }
  const layer2Pass = layer2.every((c) => c.pass);
  return {
    layer1,
    layer2,
    layer2Skipped: false,
    verdict: layer1Pass && layer2Pass ? "PASS" : "FAIL",
  };
}

export function summarise(
  results: (EmailQualityResult | undefined)[]
): QualitySummary {
  const evaluated = results.filter(Boolean).length;
  const pass = results.filter((r) => r?.verdict === "PASS").length;
  const fail = evaluated - pass;
  return {
    evaluated,
    pass,
    fail,
    passRate: evaluated === 0 ? 0 : Math.round((pass / evaluated) * 100),
  };
}

export { getCheck };
