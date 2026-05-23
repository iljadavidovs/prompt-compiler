import type { PcrStore } from "@pcr/store";
import type { ContextBlock, ContextBlockKind, PromptMode, RankedContextBlock } from "@pcr/shared";
import { keywordScore } from "./query.js";
import { extractKeywords, toFtsQuery, type SearchOptions } from "./query.js";

interface SearchRow {
  id: string;
  document_id: string;
  source_id: string;
  kind: ContextBlockKind;
  label: string;
  content: string;
  token_estimate: number;
  metadata_json: string;
  updated_at: string;
  fts_rank: number;
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function modeBoost(metadata: Record<string, unknown>, mode?: PromptMode): number {
  if (!mode) {
    return 0;
  }
  return metadata.mode === mode || metadata.modes === mode || (Array.isArray(metadata.modes) && metadata.modes.includes(mode))
    ? 8
    : 0;
}

function kindBoost(kind: ContextBlockKind, query: string, kinds?: ContextBlockKind[]): number {
  let score = 0;
  if (kinds?.includes(kind)) {
    score += 15;
  }
  if (kind === "goal" && /goal|progress|objective/i.test(query)) {
    score += 10;
  }
  if (kind === "schedule" && /schedule|nearest|week|today|tomorrow|friday|weekend/i.test(query)) {
    score += 10;
  }
  if (kind === "preference" && /preference|style|tone|format|instruction/i.test(query)) {
    score += 6;
  }
  return score;
}

function hintBoost(text: string, hints?: string[]): number {
  if (!hints?.length) {
    return 0;
  }
  const lowered = text.toLowerCase();
  return hints.reduce((score, hint) => score + (lowered.includes(hint.toLowerCase()) ? 5 : 0), 0);
}

function rowToRankedBlock(row: SearchRow, query: string, options: SearchOptions): RankedContextBlock {
  const keywords = extractKeywords(query);
  const metadata = parseMetadata(row.metadata_json);
  const text = `${row.label}\n${row.content}`;
  const lexicalScore = keywordScore(text, keywords) * 12;
  const ftsScore = Math.max(0, 25 - Math.abs(row.fts_rank));
  const score =
    lexicalScore +
    ftsScore +
    kindBoost(row.kind, query, options.kinds) +
    modeBoost(metadata, options.mode) +
    hintBoost(text, options.contextHints);

  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    content: row.content,
    metadata: {
      ...metadata,
      documentId: row.document_id,
      sourceId: row.source_id,
      tokenEstimate: row.token_estimate,
      updatedAt: row.updated_at,
    },
    score,
    source: "context_chunks",
  };
}

export function searchContext(store: PcrStore, query: string, options: SearchOptions = {}): RankedContextBlock[] {
  store.migrate();
  const limit = options.limit ?? 20;
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) {
    return [];
  }

  const kindClause = options.kinds?.length
    ? `AND c.kind IN (${options.kinds.map(() => "?").join(", ")})`
    : "";
  const params = options.kinds?.length ? [ftsQuery, ...options.kinds, limit * 3] : [ftsQuery, limit * 3];

  const rows = store.database
    .prepare(`
      SELECT
        c.id,
        c.document_id,
        c.source_id,
        c.kind,
        c.label,
        c.content,
        c.token_estimate,
        c.metadata_json,
        c.updated_at,
        bm25(context_chunks_fts) AS fts_rank
      FROM context_chunks_fts
      JOIN context_chunks c ON c.id = context_chunks_fts.chunk_id
      WHERE context_chunks_fts MATCH ?
      ${kindClause}
      ORDER BY bm25(context_chunks_fts), c.updated_at DESC, c.id ASC
      LIMIT ?
    `)
    .all(...params) as SearchRow[];

  return rows
    .map((row) => rowToRankedBlock(row, query, options))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function rankedBlockToContextBlock(block: RankedContextBlock): ContextBlock {
  return {
    id: block.id,
    label: block.label,
    kind: block.kind,
    content: block.content,
    metadata: block.metadata,
  };
}

