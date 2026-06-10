import { NextRequest } from "next/server";
import { getCampaigns, saveCampaign } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  const campaigns = await getCampaigns();
  return Response.json({ campaigns });
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Campaign name is required" }, { status: 400 });
  }

  const campaign = await saveCampaign(name);
  return Response.json({ campaign });
}
