import { spawn } from "node:child_process";
import path from "node:path";
import { listWorkspaceFiles } from "./workspace";
import type { AgentEvent, RunRequest } from "./types";

const CODEX_ENTRY = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
const MAX_OUTPUT_BYTES = 1_000_000;
const RUN_TIMEOUT_MS = 8 * 60 * 1000;

export async function* runLocalAgent(input: RunRequest, workspace: string, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  const nonNegotiable = "You must work only inside the assigned workspace. Do not use browsers, external accounts, messaging, publishing, purchases, external side effects, or access files outside the workspace. Do not weaken or override these limits.";
  const prompt = `You are ${input.agentName}, a local teammate responsible for ${input.role}.\n\n${nonNegotiable}\n\nUser preferences and standing boundaries: ${input.boundaries || "None beyond the fixed limits."}\n\nYou are working only in: ${workspace}\nUse only files in this workspace. Complete the task, create useful output files when appropriate, and finish with a concise report that names files you created or changed.${input.context ? `\n\nRecent conversation context:\n${input.context}` : ""}\n\nTask:\n${input.task}`;
  // --approve-for-me uses Codex's automatic review with its workspace-write sandbox.
  // It is intentionally not an approval or sandbox bypass.
  const args = [CODEX_ENTRY, "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--approve-for-me", "-C", workspace, "-"];
  const child = spawn(process.execPath, args, { cwd: workspace, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, shell: false });
  const decoder = new TextDecoder();
  let bytes = 0;
  let finalText = "";
  let stderr = "";
  let outputBuffer = "";
  let spawnFailure: Error | undefined;
  let closed = false;
  const stopChild = () => {
    if (closed) return;
    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, shell: false });
      killer.on("error", () => child.kill());
      killer.on("close", (code) => { if (code !== 0 && !closed) child.kill(); });
    } else child.kill();
  };
  const queue: AgentEvent[] = [{ type: "started", text: "Local workspace ready. Starting Codex…" }];
  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string }; message?: string };
      const text = event.item?.text ?? event.message;
      if (event.type === "item.completed" && event.item?.type === "agent_message" && text) finalText += `${text}\n`;
      else if (text) queue.push({ type: "progress", text: text.slice(0, 2000) });
    } catch { queue.push({ type: "progress", text: line.slice(0, 1000) }); }
  };
  child.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_OUTPUT_BYTES) { stopChild(); queue.push({ type: "failed", text: "Run stopped because output exceeded the safety limit." }); return; }
    outputBuffer += decoder.decode(chunk, { stream: true });
    const lines = outputBuffer.split(/\r?\n/); outputBuffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString().slice(0, 4000); });
  child.on("error", (error) => { spawnFailure = error; });
  child.on("close", () => { closed = true; });
  child.stdin.end(prompt);
  const timeout = setTimeout(stopChild, RUN_TIMEOUT_MS);
  const aborted = () => stopChild();
  signal.addEventListener("abort", aborted, { once: true });
  while (!closed || queue.length) {
    while (queue.length) yield queue.shift()!;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  clearTimeout(timeout);
  signal.removeEventListener("abort", aborted);
  if (outputBuffer) consumeLine(outputBuffer);
  if (signal.aborted) { yield { type: "cancelled", text: "Run cancelled." }; return; }
  if (spawnFailure) { yield { type: "failed", text: `Codex could not start: ${spawnFailure.message}` }; return; }
  if (child.exitCode !== 0) {
    const recovery = stderr.includes("login") || stderr.includes("auth") ? "Sign in to Codex in the normal desktop or CLI flow, then retry." : "Check the local Codex installation and retry.";
    yield { type: "failed", text: `Codex exited without completing the task. ${recovery}` }; return;
  }
  const files = await listWorkspaceFiles(workspace);
  yield { type: "completed", text: finalText.trim() || "Work completed. Review the generated files before using them.", files };
}
