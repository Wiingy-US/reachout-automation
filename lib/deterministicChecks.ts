// Layer 1 — deterministic rule engine. Pure functions, no API calls. Runs
// first; if anything fails the email is FAIL and the LLM judge is skipped.

import { CheckResult, GeneratedEmail } from "./types";
import { LAYER1_CHECKS, RUBRIC_CONFIG } from "./rubric";
import { decodeEntities, hasEmDash, mentionsPdf, stripHtml, wordCount } from "./htmlUtils";

const FORBIDDEN_TAGS = ["<!doctype", "<html", "<head", "<body", "<style", "<title", "<meta"];

// Abbreviations that are acceptable in a subject line and must NOT be flagged
// as ALL CAPS "shouting" by SUB-03.
const ABBREVIATION_WHITELIST = new Set([
  "LA", "NYC", "NY", "SF", "DC", "US", "UK", "TX", "FL", "CA",
  "NJ", "CT", "MA", "PA", "OH", "IL", "GA", "NC", "TN", "CO",
  "WA", "OR", "MN", "MO", "AZ", "NV", "MI", "VA", "MD", "PR",
  "TV", "AI", "CEO", "CFO", "CMO", "CTO", "PhD", "USA",
  "AM", "PM", "EST", "PST", "CST", "MST",
]);

function hasAllCapsWords(text: string): { found: boolean; word?: string } {
  const matches = text.match(/\b[A-Z]{2,}\b/g);
  if (!matches) return { found: false };
  const flagged = matches.filter((w) => !ABBREVIATION_WHITELIST.has(w));
  if (flagged.length === 0) return { found: false };
  return { found: true, word: flagged[0] };
}

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

/** Break HTML into visible lines (on block boundaries / <br>) and return the
 *  last non-empty one, tags stripped. */
function lastVisibleLine(html: string): string {
  const withBreaks = (html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|table|ul|ol)>/gi, "\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ""));
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

/** Count <li> tags in the HTML region starting after `startLabel` and ending
 *  at `endLabel` (or end of string). Returns -1 if the start label is absent. */
function bulletCount(html: string, startLabel: string, endLabel?: string): number {
  const lower = html.toLowerCase();
  const start = lower.indexOf(startLabel.toLowerCase());
  if (start === -1) return -1;
  const from = start + startLabel.length;
  let to = html.length;
  if (endLabel) {
    const e = lower.indexOf(endLabel.toLowerCase(), from);
    if (e !== -1) to = e;
  }
  const matches = html.slice(from, to).match(/<li\b/gi);
  return matches ? matches.length : 0;
}

export function runDeterministicChecks(email: GeneratedEmail): CheckResult[] {
  const q = (id: string) => LAYER1_CHECKS.find((c) => c.id === id)!.question;
  const main = email.email_1_html || "";
  const fup = email.followup_html || "";
  const subject = email.subject || "";
  const out: CheckResult[] = [];

  // ---- Subject ----

  // SUB-02 — subject under max chars
  {
    const len = subject.trim().length;
    const pass = len > 0 && len < RUBRIC_CONFIG.subjectMaxChars;
    out.push(result("SUB-02", q("SUB-02"), pass, pass ? `Yes — ${len} chars` : `No — ${len} chars`));
  }

  // SUB-03 — ALL CAPS words (2+ uppercase letters), ignoring known abbreviations
  {
    const { found, word } = hasAllCapsWords(subject);
    out.push(
      result(
        "SUB-03",
        q("SUB-03"),
        !found,
        found ? `Yes — ALL CAPS word found: "${word}"` : "No ALL CAPS words found"
      )
    );
  }

  // ---- Main email ----

  // MAIN-02 — organisation referenced
  {
    const org = norm(email.journalist.organisation);
    const body = norm(stripHtml(main));
    const tokens = org.split(" ").filter((t) => t.length >= 4);
    const pass = org.length > 0 && (body.includes(org) || tokens.some((t) => body.includes(t)));
    out.push(result("MAIN-02", q("MAIN-02"), pass, pass ? "Yes" : "No — organisation not found in body"));
  }

  // MAIN-03 — opens with "Hi [First Name]," exactly
  {
    const body = stripHtml(main).trim();
    const expected = `Hi ${email.journalist.first_name.trim()},`;
    const pass = email.journalist.first_name.trim().length > 0 && body.startsWith(expected);
    out.push(
      result(
        "MAIN-03",
        q("MAIN-03"),
        pass,
        pass ? `Yes — "${expected}"` : `No — starts "${body.slice(0, 40)}"`
      )
    );
  }

  // MAIN-04 — em dash
  {
    const has = hasEmDash(main);
    out.push(result("MAIN-04", q("MAIN-04"), !has, has ? "Yes — em dash present" : "No"));
  }

  // MAIN-07 — 'Key Findings:' and 'Potential Angles:' labels present (plain text)
  {
    const lower = main.toLowerCase();
    const hasKF = lower.includes("key findings:");
    const hasPA = lower.includes("potential angles:");
    const pass = hasKF && hasPA;
    const missing = [!hasKF ? "Key Findings:" : null, !hasPA ? "Potential Angles:" : null].filter(Boolean);
    out.push(
      result("MAIN-07", q("MAIN-07"), pass, pass ? "Yes — both labels present" : `No — missing: ${missing.join(", ")}`)
    );
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

  // MAIN-23 — Key Findings has exactly N bullets
  {
    const n = bulletCount(main, "Key Findings", "Potential Angles");
    const count = n === -1 ? 0 : n;
    const pass = count === RUBRIC_CONFIG.keyFindingsBullets;
    out.push(result("MAIN-23", q("MAIN-23"), pass, pass ? `Yes — ${count} bullets` : `No — ${count} bullets found`));
  }

  // MAIN-24 — Potential Angles has exactly N bullets
  {
    const n = bulletCount(main, "Potential Angles");
    const count = n === -1 ? 0 : n;
    const pass = count === RUBRIC_CONFIG.potentialAnglesBullets;
    out.push(result("MAIN-24", q("MAIN-24"), pass, pass ? `Yes — ${count} bullets` : `No — ${count} bullets found`));
  }

  // MAIN-25 — sign-off ends with exactly "Best,"
  {
    const last = lastVisibleLine(main);
    const pass = last === "Best,";
    out.push(result("MAIN-25", q("MAIN-25"), pass, pass ? "Yes — ends 'Best,'" : `No — ends '${last}'`));
  }

  // MAIN-26 — forbidden HTML tags
  {
    const lower = main.toLowerCase();
    const found = FORBIDDEN_TAGS.find((t) => lower.includes(t));
    out.push(result("MAIN-26", q("MAIN-26"), !found, found ? `Yes — found: ${found}` : "No"));
  }

  // ---- Follow-up ----

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

  // FUP-07 — literal "pdf"
  {
    const has = mentionsPdf(fup);
    out.push(result("FUP-07", q("FUP-07"), !has, has ? "Yes — 'pdf' present" : "No"));
  }

  // FUP-09 — follow-up must NOT contain a Potential Angles section
  {
    const has = /potential angles/i.test(stripHtml(fup));
    out.push(
      result(
        "FUP-09",
        q("FUP-09"),
        !has,
        has ? "Yes — 'Potential Angles' found in follow-up" : "No — not present"
      )
    );
  }

  // FUP-10 — sign-off ends with exactly "Best,"
  {
    const last = lastVisibleLine(fup);
    const pass = last === "Best,";
    out.push(result("FUP-10", q("FUP-10"), pass, pass ? "Yes — ends 'Best,'" : `No — ends '${last}'`));
  }

  return out;
}
