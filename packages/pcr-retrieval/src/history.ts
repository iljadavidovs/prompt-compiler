import type { PcrStore } from "@pcr/store";
import type { CompilationHistoryRecord, ContextBlock, PromptMode } from "@pcr/shared";
import { estimateTokens } from "@pcr/shared";
import { extractKeywords, keywordScore } from "./query.js";

export interface HistoryExampleOptions {
  query: string;
  mode?: PromptMode;
  limit?: number;
}

interface HistoryFeedbackRow {
  compile_id: string;
  created_at: string;
  rating: "like" | "dislike" | "neutral";
  outcome: string | null;
  comment: string | null;
  raw_text: string;
  prompt: string;
  mode: PromptMode;
}

function exampleScore(row: HistoryFeedbackRow, query: string, mode?: PromptMode): number {
  const text = `${row.raw_text}\n${row.prompt}\n${row.comment ?? ""}\n${row.outcome ?? ""}`;
  return keywordScore(text, extractKeywords(query)) * 10 + (mode && row.mode === mode ? 8 : 0);
}

function rowToExample(row: HistoryFeedbackRow, kind: "positive" | "negative", score: number): ContextBlock {
  const lesson =
    kind === "positive"
      ? "Preserve the qualities that made this compilation useful."
      : "Avoid repeating the issue captured by this feedback.";

  const feedback = [row.outcome ? `Outcome: ${row.outcome}` : "", row.comment ? `Comment: ${row.comment}` : ""]
    .filter(Boolean)
    .join("\n");

  return {
    id: `${kind}_${row.compile_id}`,
    label: `${kind === "positive" ? "Positive" : "Negative"} prompt history: ${row.compile_id}`,
    kind: "history",
    content: [
      lesson,
      `Request: ${row.raw_text}`,
      feedback,
      `Prompt excerpt: ${row.prompt.slice(0, 1200)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      compileId: row.compile_id,
      createdAt: row.created_at,
      rating: row.rating,
      score,
      tokenEstimate: estimateTokens(row.prompt),
    },
  };
}

export function getFeedbackExamples(store: PcrStore, options: HistoryExampleOptions): {
  positive: ContextBlock[];
  negative: ContextBlock[];
} {
  store.migrate();
  const rows = store.database
    .prepare(`
      SELECT
        c.compile_id,
        c.created_at,
        f.rating,
        f.outcome,
        f.comment,
        c.raw_text,
        c.prompt,
        c.mode
      FROM feedback f
      JOIN compilations c ON c.compile_id = f.compile_id
      WHERE f.rating IN ('like', 'dislike')
      ORDER BY f.created_at DESC
      LIMIT 100
    `)
    .all() as HistoryFeedbackRow[];

  const scored = rows
    .map((row) => ({ row, score: exampleScore(row, options.query, options.mode) }))
    .filter((entry) => entry.score > 0 || entry.row.rating === "like" || entry.row.rating === "dislike")
    .sort((a, b) => b.score - a.score || b.row.created_at.localeCompare(a.row.created_at));

  const limit = options.limit ?? 3;
  return {
    positive: scored
      .filter((entry) => entry.row.rating === "like")
      .slice(0, limit)
      .map((entry) => rowToExample(entry.row, "positive", entry.score)),
    negative: scored
      .filter((entry) => entry.row.rating === "dislike")
      .slice(0, limit)
      .map((entry) => rowToExample(entry.row, "negative", entry.score)),
  };
}

export function findSimilarHistory(store: PcrStore, options: HistoryExampleOptions): CompilationHistoryRecord[] {
  store.migrate();
  const records = store.listCompilations(50);
  const keywords = extractKeywords(options.query);
  return records
    .map((record) => ({
      record,
      score: keywordScore(`${record.rawText}\n${record.prompt}`, keywords) * 10 + (options.mode === record.mode ? 5 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.record.createdAt.localeCompare(a.record.createdAt))
    .slice(0, options.limit ?? 5)
    .map((entry) => entry.record);
}

