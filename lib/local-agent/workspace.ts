import { mkdir, lstat, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, MAX_FILES } from "./types";

const root = path.resolve(process.cwd(), ".brockbot-runtime", "teammates");

export function isSafeId(value: string) {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export async function getWorkspace(agentId: string) {
  if (!isSafeId(agentId)) throw new Error("Invalid teammate ID.");
  await mkdir(root, { recursive: true });
  const workspace = path.resolve(root, agentId);
  if (!workspace.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe workspace path.");
  try {
    const info = await lstat(workspace);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Unsafe teammate workspace.");
    if (!(await realpath(workspace)).startsWith(`${await realpath(root)}${path.sep}`)) throw new Error("Unsafe teammate workspace.");
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(workspace, { recursive: true });
  return workspace;
}

async function safeDirectory(directory: string, workspace: string) {
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Unsafe workspace directory.");
    const [resolvedDirectory, resolvedWorkspace] = await Promise.all([realpath(directory), realpath(workspace)]);
    if (!resolvedDirectory.startsWith(`${resolvedWorkspace}${path.sep}`) && resolvedDirectory !== resolvedWorkspace) throw new Error("Unsafe workspace directory.");
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

function safeFileName(name: string) {
  const normalized = path.basename(name).replace(/[^a-zA-Z0-9._ -]/g, "_");
  if (!normalized || normalized !== name || normalized.includes("..")) throw new Error(`Unsafe filename: ${name}`);
  const extension = normalized.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) throw new Error("Only .txt, .md, .csv, and .json files are supported.");
  return normalized;
}

export async function writeAttachments(workspace: string, attachments: Array<{ name: string; content: string }> = []) {
  if (attachments.length > MAX_FILES) throw new Error(`Attach at most ${MAX_FILES} files.`);
  const written: string[] = [];
  for (const attachment of attachments) {
    const name = safeFileName(attachment.name);
    const content = String(attachment.content ?? "");
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) throw new Error(`${name} is larger than 2 MB.`);
    const target = path.resolve(workspace, "inputs", name);
    if (!target.startsWith(`${workspace}${path.sep}`)) throw new Error("Unsafe attachment path.");
    const inputDirectory = path.dirname(target);
    await safeDirectory(inputDirectory, workspace);
    await mkdir(inputDirectory, { recursive: true });
    await safeDirectory(inputDirectory, workspace);
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error("Unsafe attachment path."); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await writeFile(target, content, "utf8");
    written.push(`inputs/${name}`);
  }
  return written;
}

export async function listWorkspaceFiles(workspace: string) {
  const { readdir } = await import("node:fs/promises");
  const results: string[] = [];
  async function visit(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) results.push(path.relative(workspace, fullPath).replaceAll("\\", "/"));
    }
  }
  await visit(workspace);
  return results.slice(0, 100);
}

export async function readWorkspaceFile(agentId: string, filePath: string) {
  const workspace = await getWorkspace(agentId);
  const target = path.resolve(workspace, filePath);
  if (!target.startsWith(`${workspace}${path.sep}`)) throw new Error("Unsafe file path.");
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("File is unavailable.");
  const resolved = await realpath(target);
  if (!resolved.startsWith(`${workspace}${path.sep}`)) throw new Error("Unsafe file path.");
  if (info.size > MAX_FILE_SIZE) throw new Error("File is too large to preview.");
  return { name: path.basename(target), content: await (await import("node:fs/promises")).readFile(target, "utf8") };
}
