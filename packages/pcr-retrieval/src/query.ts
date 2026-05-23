import type { ContextBlockKind, PromptMode } from "@pcr/shared";

export interface SearchOptions {
  kinds?: ContextBlockKind[];
  mode?: PromptMode;
  contextHints?: string[];
  limit?: number;
}

export function extractKeywords(query: string): string[] {
  const ignored = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "according",
    "current",
    "nearest",
    "compile",
    "prompt",
  ]);

  const keywords = query
    .toLowerCase()
    .match(/[a-z0-9]{2,}/g) ?? [];

  return [...new Set(keywords.filter((keyword) => !ignored.has(keyword)))].slice(0, 12);
}

export function toFtsQuery(query: string): string {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return "";
  }
  return keywords.map((keyword) => `${keyword.replace(/"/g, "")}*`).join(" OR ");
}

export function keywordScore(text: string, keywords: string[]): number {
  const lowered = text.toLowerCase();
  return keywords.reduce((score, keyword) => score + (lowered.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}
