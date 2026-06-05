// Layer 1 — deterministic rule engine (spec section 5.2).
// Pure functions, no API calls. Runs first; if anything fails the email is FAIL
// and the LLM judge is skipped.

import { CheckResult, GeneratedEmail } from "./types";
import { LAYER1_CHECKS, RUBRIC_CONFIG } from "./rubric";
import {
  countBolds,
  hasEmDash,
  mentionsPdf,
  stripHtml,
  wordCount,
} from "./htmlUtils";

function result(
  check_id: string,
  question: string,
  pass: boolean,
  modelAnswer: string
): CheckResult {
  return { check_id, question, pass, model_answer: modelAnswer };
}

/** Normalise a string for loose matching (lowercase, strip punctuation). */
function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function runDeterministicChecks(email: GeneratedEmail): CheckResult[] {
  const q = (id: string) => LAYER1_CHECKS.find((c) => c.id === id)!.question;
  const main = email.email_1_html || "";
  const fup = email.followup_html || "";
  const subject = email.subject || "";
  const out: CheckResult[] = [];

  // SUB-01 — subject word count
  {
    const wc = subject.trim() ? subject.trim().split(/\s+/).length : 0;
    const pass = wc <= RUBRIC_CONFIG.subjectMaxWords && wc > 0;
    out.push(result("SUB-01", q("SUB-01"), pass, pass ? `Yes — ${wc} words` : `No — ${wc} words`));
  }

  // MAIN-02 — organisation referenced
  {
    const org = norm(email.journalist.organisation);
    const body = norm(stripHtml(main));
    // match the full org name OR a distinctive (>=4 char) token from it
    const tokens = org.split(" ").filter((t) => t.length >= 4);
    const pass = org.length > 0 && (body.includes(org) || tokens.some((t) => body.includes(t)));
    out.push(result("MAIN-02", q("MAIN-02"), pass, pass ? "Yes" : "No — organisation not found in body"));
  }

  // MAIN-03 — opens with "Hi [First Name],"
  {
    const first = norm(email.journalist.first_name);
    const body = stripHtml(main).trim();
    const opening = norm(body.slice(0, 60));
    const pass = first.length > 0 && /^hi\b/.test(opening) && opening.includes(first);
    out.push(result("MAIN-03", q("MAIN-03"), pass, pass ? `Yes — "Hi ${email.journalist.first_name},"` : "No — missing 'Hi [First Name],' opening"));
  }

  // MAIN-04 — em dash
  {
    const has = hasEmDash(main);
    out.push(result("MAIN-04", q("MAIN-04"), !has, has ? "Yes — em dash present" : "No"));
  }

  // MAIN-07 — Key Findings / Potential Angles sections
  {
    const body = norm(stripHtml(main));
    const hasKF = body.includes("key findings");
    const hasPA = body.includes("potential angles");
    const pass = hasKF && hasPA;
    const missing = [!hasKF ? "Key Findings" : null, !hasPA ? "Potential Angles" : null].filter(Boolean);
    out.push(result("MAIN-07", q("MAIN-07"), pass, pass ? "Yes" : `No — missing ${missing.join(", ")}`));
  }

  // MAIN-08 — bolded sentence present, within max
  {
    const n = countBolds(main);
    const pass = n >= 1 && n <= RUBRIC_CONFIG.maxBolds;
    let answer = `Yes — ${n} bold(s)`;
    if (n === 0) answer = "No — no bolded sentence";
    else if (n > RUBRIC_CONFIG.maxBolds) answer = `No — ${n} bolds (max ${RUBRIC_CONFIG.maxBolds})`;
    out.push(result("MAIN-08", q("MAIN-08"), pass, answer));
  }

  // MAIN-10 — literal "pdf"
  {
    const has = mentionsPdf(main);
    out.push(result("MAIN-10", q("MAIN-10"), !has, has ? "Yes — 'pdf' present" : "No"));
  }

  // MAIN-13 — word count <= max
  {
    const wc = wordCount(main);
    const pass = wc <= RUBRIC_CONFIG.mainMaxWords && wc > 0;
    out.push(result("MAIN-13", q("MAIN-13"), pass, pass ? `Yes — ${wc} words` : `No — ${wc} words`));
  }

  // FUP-01 — follow-up word count <= max
  {
    const wc = wordCount(fup);
    const pass = wc <= RUBRIC_CONFIG.followupMaxWords && wc > 0;
    out.push(result("FUP-01", q("FUP-01"), pass, pass ? `Yes — ${wc} words` : `No — ${wc} words`));
  }

  // FUP-02 — em dash
  {
    const has = hasEmDash(fup);
    out.push(result("FUP-02", q("FUP-02"), !has, has ? "Yes — em dash present" : "No"));
  }

  // FUP-05 — bolded sentence present, within max
  {
    const n = countBolds(fup);
    const pass = n >= 1 && n <= RUBRIC_CONFIG.maxBolds;
    let answer = `Yes — ${n} bold(s)`;
    if (n === 0) answer = "No — no bolded sentence";
    else if (n > RUBRIC_CONFIG.maxBolds) answer = `No — ${n} bolds (max ${RUBRIC_CONFIG.maxBolds})`;
    out.push(result("FUP-05", q("FUP-05"), pass, answer));
  }

  // FUP-07 — literal "pdf"
  {
    const has = mentionsPdf(fup);
    out.push(result("FUP-07", q("FUP-07"), !has, has ? "Yes — 'pdf' present" : "No"));
  }

  return out;
}
