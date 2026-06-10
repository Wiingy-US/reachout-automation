import { NextRequest } from "next/server";
import { getAllRuns, saveRun } from "@/lib/redis";
import { RunRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const runs = await getAllRuns();
  return Response.json({ runs });
}

export async function POST(req: NextRequest) {
  let record: RunRecord;
  try {
    record = (await req.json()) as RunRecord;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!record.id || !record.campaign_name || !record.user_name) {
    return Response.json(
      { error: "Missing required fields: id, campaign_name, user_name" },
      { status: 400 }
    );
  }

  await saveRun(record);
  return Response.json({ success: true });
}
