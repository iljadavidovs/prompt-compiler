import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_MAX_PROMPT_TOKENS,
  PCR_PROJECT_DIR_NAME,
  PCR_SQLITE_FILE,
  PCR_USER_DIR_NAME,
} from "./constants.js";
import type { CompileOptions, ResolvedPcrPaths } from "./types.js";

export function createCompileId(): string {
  return `pcr_${randomUUID()}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }
  const maxChars = Math.max(0, maxTokens * 4);
  return `${text.slice(0, maxChars).trimEnd()}\n[truncated]`;
}

export function uniqueStable<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (!seen.has(itemKey)) {
      seen.add(itemKey);
      output.push(item);
    }
  }
  return output;
}

export function resolvePcrPaths(cwd = process.cwd(), userDir?: string): ResolvedPcrPaths {
  const resolvedCwd = resolve(cwd);
  const resolvedUserDir = userDir ?? join(homedir(), PCR_USER_DIR_NAME);
  return {
    cwd: resolvedCwd,
    projectDir: join(resolvedCwd, PCR_PROJECT_DIR_NAME),
    userDir: resolvedUserDir,
    dbPath: join(resolvedUserDir, PCR_SQLITE_FILE),
  };
}

export function maxContextTokens(options?: CompileOptions): number {
  return options?.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
}

export function maxPromptTokens(options?: CompileOptions): number {
  return options?.maxPromptTokens ?? DEFAULT_MAX_PROMPT_TOKENS;
}

export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED_SECRET]")
    .replace(/\b((?:OPENAI|ANTHROPIC|GITHUB|NPM|AWS|GOOGLE|AZURE)[A-Z0-9_]*_?(?:KEY|TOKEN|SECRET))=([^\s]+)/gi, "$1=[REDACTED_SECRET]")
    .replace(/\b(password|passwd|secret|token|api_key)\s*[:=]\s*([^\s]+)/gi, "$1=[REDACTED_SECRET]");
}

export function toArrayText(items: string[], fallback = "- None found."): string {
  if (items.length === 0) {
    return fallback;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

