export type AgentStatus = "idle" | "working" | "review" | "done" | "failed" | "cancelled";

export type AgentEvent = {
  type: "started" | "progress" | "message" | "file_changed" | "completed" | "failed" | "cancelled";
  text?: string;
  files?: string[];
};

export type RunRequest = {
  agentId: string;
  agentName: string;
  role: string;
  boundaries: string;
  task: string;
  context?: string;
  attachments?: Array<{ name: string; content: string }>;
};

export const MAX_TASK_LENGTH = 12_000;
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_FILES = 5;
export const ALLOWED_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);
