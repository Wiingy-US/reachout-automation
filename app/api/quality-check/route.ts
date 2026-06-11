import { NextRequest, NextResponse } from "next/server";
import { runDeterministicChecks } from "@/lib/deterministicChecks";
import { runLayer2JudgeBatch } from "@/lib/gemini";
import { assembleVerdict, normaliseJudgeChecks } from "@/lib/quality";
import { toTokenRecord } from "@/lib/costs";
import { LAYER2_CHECKS } from "@/lib/rubric";
import { CheckResult, GeneratedEmail } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface QualityBody {
  emails: GeneratedEmail[];
  dataFactsSummary: string;
}

/** All Layer 2 checks marked failed with a shared reason (judge error paths). */
function allLayer2Failed(message: string): CheckResult[] {
  return LAYER2_CHECKS.map((c) => ({
    check_id: c.id,
    question: c.question,
    model_answer: message,
    pass: false,
  }));
}

export async function POST(req: NextRequest) {
  let body: QualityBody;
  try {
    body = (await req.json()) as QualityBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emails, dataFactsSummary } = body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }

  // Layer 1 — deterministic, per email. Layer 2 (LLM judge) only runs on the
  // emails that fully pass Layer 1, and is batched into a single Gemini call.
  const layer1ByRow = new Map<number, CheckResult[]>();
  const l1Passers: GeneratedEmail[] = [];
  for (const email of emails) {
    const layer1 = runDeterministicChecks(email);
    layer1ByRow.set(email.rowIndex, layer1);
    if (layer1.every((c) => c.pass)) l1Passers.push(email);
  }

  // Run the batched judge over the L1 passers.
  const judgeByEmail = new Map<string, CheckResult[]>();
  let judgeError: string | null = null;
  const token_records = [];
  if (l1Passers.length > 0) {
    try {
      const { items, usage } = await runLayer2JudgeBatch(l1Passers, dataFactsSummary || "");
      token_records.push(toTokenRecord("quality_check_layer2", usage));
      const itemByEmail = new Map(items.map((it) => [it.journalist_email, it]));
      for (const email of l1Passers) {
        const item = itemByEmail.get(email.journalist.email);
        if (!item) {
          judgeByEmail.set(
            email.journalist.email,
            allLayer2Failed("Judge error — journalist missing from response")
          );
          continue;
        }
        let layer2 = normaliseJudgeChecks(item.checks);
        // MAIN-31 can only be judged against a bio — skip (pass) when absent.
        if (!email.journalist.about_bio?.trim()) {
          layer2 = layer2.map((c) =>
            c.check_id === "MAIN-31"
              ? { ...c, pass: true, model_answer: "Skipped — no bio available" }
              : c
          );
        }
        judgeByEmail.set(email.journalist.email, layer2);
      }
    } catch (err: any) {
      judgeError = err?.message || "judge call failed";
      for (const email of l1Passers) {
        judgeByEmail.set(
          email.journalist.email,
          allLayer2Failed("Judge error — could not parse batch response")
        );
      }
    }
  }

  // Assemble per-email verdicts.
  const results = emails.map((email) => {
    const layer1 = layer1ByRow.get(email.rowIndex)!;
    const l1Pass = layer1.every((c) => c.pass);
    const layer2 = l1Pass ? judgeByEmail.get(email.journalist.email) ?? null : null;
    return {
      rowIndex: email.rowIndex,
      journalist_email: email.journalist.email,
      quality: assembleVerdict(layer1, layer2),
    };
  });

  return NextResponse.json({ results, token_records, judgeError });
}
