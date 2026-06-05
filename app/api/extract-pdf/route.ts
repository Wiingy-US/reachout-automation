import { NextRequest, NextResponse } from "next/server";
import { extractFromPdf } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60; // Pro tier; Hobby caps at 10s (spec section 08)

const MAX_BYTES = 20 * 1024 * 1024; // 20MB (spec 3.1)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "PDF exceeds 20MB limit" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const extraction = await extractFromPdf(base64, "application/pdf");
    return NextResponse.json(extraction);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "PDF extraction failed" },
      { status: 500 }
    );
  }
}
