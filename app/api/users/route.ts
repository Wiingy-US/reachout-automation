import { NextRequest } from "next/server";
import { getUsers, saveUser } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ users: await getUsers() });
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
    return Response.json({ error: "User name required" }, { status: 400 });
  }
  return Response.json({ user: await saveUser(name) });
}
