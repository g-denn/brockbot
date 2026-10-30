import { NextRequest } from "next/server";
import { isSafeId, readWorkspaceFile } from "@/lib/local-agent/workspace";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1")) return Response.json({ error: "This local-only endpoint accepts requests from localhost." }, { status: 403 });
  if (origin && origin !== `${request.nextUrl.protocol}//${host}`) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const agentId = request.nextUrl.searchParams.get("agentId") ?? "";
  const file = request.nextUrl.searchParams.get("file") ?? "";
  if (!isSafeId(agentId) || !file) return Response.json({ error: "Invalid file request." }, { status: 400 });
  try {
    const result = await readWorkspaceFile(agentId, file);
    return new Response(result.content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${result.name}"` } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "File is unavailable." }, { status: 404 }); }
}
