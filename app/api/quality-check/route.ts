import { NextRequest, NextResponse } from "next/server";
import { runDeterministicChecks } from "@/lib/deterministicChecks";
import { runJudge } from "@/lib/gemini";
import { assembleVerdict, normaliseJudgeChecks } from "@/lib/quality";
import { CheckResult, GeneratedEmail } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface QualityBody {
  email: GeneratedEmail;
  dataFactsSummary: string;
}

export async function POST(req: NextRequest) {
  let body: QualityBody;
  try {
    body = (await req.json()) as QualityBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, dataFactsSummary } = body;
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Layer 1 — deterministic, always first.
  const layer1 = runDeterministicChecks(email);
  const layer1Pass = layer1.every((c) => c.pass);

  // Layer 2 — only when Layer 1 fully passes (spec 5.2 / 5.4).
  if (!layer1Pass) {
    return NextResponse.json({ quality: assembleVerdict(layer1, null) });
  }

  try {
    const judge = await runJudge({
      dataFactsSummary: dataFactsSummary || "",
      firstName: email.journalist.first_name,
      lastName: email.journalist.last_name,
      organisation: email.journalist.organisation,
      subject: email.subject,
      email1Html: email.email_1_html,
      followupHtml: email.followup_html,
    });
    const layer2: CheckResult[] = normaliseJudgeChecks(judge.checks);
    return NextResponse.json({ quality: assembleVerdict(layer1, layer2) });
  } catch (err: any) {
    // Judge failed — surface as a failing Layer 2 so the email is flagged
    // rather than silently passing.
    const layer2: CheckResult[] = [
      {
        check_id: "JUDGE-ERROR",
        question: "LLM judge call",
        model_answer: `No — ${err?.message || "judge call failed"}`,
        pass: false,
      },
    ];
    return NextResponse.json({ quality: assembleVerdict(layer1, layer2) });
  }
}
