import { NextRequest, NextResponse } from "next/server";
import { generateBatch } from "@/lib/gemini";
import { parseGenerationOutput } from "@/lib/parse";
import { GeneratedEmail, JournalistRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  prompt: string;
  rows: JournalistRow[];
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, rows } = body;
  if (!prompt || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "prompt and a non-empty rows array are required" },
      { status: 400 }
    );
  }

  try {
    const raw = await generateBatch(prompt, rows);
    const { blocks: parsed, delimiterFound } = parseGenerationOutput(raw);

    const countMismatch = parsed.length !== rows.length;

    // Map parsed blocks back to the requested rows. Prefer matching by the id
    // the model echoed; fall back to positional order.
    const byId = new Map<number, (typeof parsed)[number]>();
    parsed.forEach((p) => {
      if (p.id !== null) byId.set(p.id, p);
    });

    const emails: GeneratedEmail[] = rows.map((row, i) => {
      const match = byId.get(row._rowIndex) ?? parsed[i];
      const ok =
        match &&
        (match.email_1_html?.length || 0) > 0 &&
        (match.subject?.length || 0) > 0;
      if (!ok) {
        // Prefer the specific reason from the parser (e.g. which section was
        // dropped); otherwise note a block/journalist count mismatch.
        let reason = match?.error_reason || "Model returned no usable output for this row";
        if (!match && countMismatch) {
          reason = `No block returned for this row (parser found ${parsed.length} block(s) for ${rows.length} journalist(s))`;
        }
        return {
          rowIndex: row._rowIndex,
          journalist: row,
          status: "generation_failed",
          error: reason,
          verification_summary: "",
          subject: "",
          email_1_html: "",
          followup_html: "",
        };
      }
      return {
        rowIndex: row._rowIndex,
        journalist: row,
        status: "generated",
        verification_summary: match.verification_summary,
        subject: match.subject,
        email_1_html: match.email_1_html,
        followup_html: match.followup_html,
      };
    });

    // Diagnostic logging when anything in this batch failed — visible in
    // Vercel Function Logs.
    const failedCount = emails.filter((e) => e.status === "generation_failed").length;
    if (failedCount > 0) {
      console.log(
        `[generate] batch had failures — journalists sent: ${rows.length}, ` +
          `blocks parsed: ${parsed.length}, delimiterFound: ${delimiterFound}, ` +
          `failed rows: ${failedCount}. Raw response (first 300 chars):\n` +
          raw.slice(0, 300)
      );
    }

    return NextResponse.json({ emails });
  } catch (err: any) {
    // Whole-batch failure: mark every row in the batch as failed so the client
    // can flag them inline and keep going (spec 4.1).
    const emails: GeneratedEmail[] = rows.map((row) => ({
      rowIndex: row._rowIndex,
      journalist: row,
      status: "generation_failed",
      error: err?.message || "Batch generation failed",
      verification_summary: "",
      subject: "",
      email_1_html: "",
      followup_html: "",
    }));
    return NextResponse.json({ emails, batchError: err?.message }, { status: 200 });
  }
}
