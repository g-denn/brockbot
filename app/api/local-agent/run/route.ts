import { NextRequest } from "next/server";
import { runLocalAgent } from "@/lib/local-agent/runner";
import { MAX_TASK_LENGTH, type RunRequest } from "@/lib/local-agent/types";
import { getWorkspace, isSafeId, writeAttachments } from "@/lib/local-agent/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLocalRequest(request: NextRequest) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host) return false;
  const requestOrigin = `${request.nextUrl.protocol}//${host}`;
  if (request.nextUrl.hostname !== "localhost" && request.nextUrl.hostname !== "127.0.0.1") return false;
  if (!origin) return true;
  return origin === requestOrigin;
}

function eventStream(event: object) { return `data: ${JSON.stringify(event)}\n\n`; }

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) return Response.json({ error: "This local-only endpoint accepts requests from localhost." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 11 * 1024 * 1024) return Response.json({ error: "Request is too large." }, { status: 413 });
  let input: RunRequest;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > 11 * 1024 * 1024) return Response.json({ error: "Request is too large." }, { status: 413 });
    input = JSON.parse(new TextDecoder().decode(body)) as RunRequest;
  } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!isSafeId(input.agentId) || !input.agentName?.trim() || !input.role?.trim() || input.agentName.length > 80 || input.role.length > 500 || (input.boundaries?.length ?? 0) > 2_000) return Response.json({ error: "A valid teammate name, role, and boundaries are required." }, { status: 400 });
  if (!input.task?.trim() || input.task.length > MAX_TASK_LENGTH || (input.context?.length ?? 0) > 24_000) return Response.json({ error: `Task is required and must be under ${MAX_TASK_LENGTH.toLocaleString()} characters.` }, { status: 400 });
  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const stream = new ReadableStream({
    async start(controllerStream) {
      try {
        const workspace = await getWorkspace(input.agentId);
        const attachments = await writeAttachments(workspace, input.attachments);
        if (attachments.length) controllerStream.enqueue(encoder.encode(eventStream({ type: "file_changed", files: attachments, text: "Attached files saved in the teammate workspace." })));
        for await (const event of runLocalAgent(input, workspace, controller.signal)) controllerStream.enqueue(encoder.encode(eventStream(event)));
      } catch (error) {
        controllerStream.enqueue(encoder.encode(eventStream({ type: "failed", text: error instanceof Error ? error.message : "The local run failed." })));
      } finally { controllerStream.close(); }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
