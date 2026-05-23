import type {
  CompilationHistoryRecord,
  ContextBlockKind,
  FeedbackInput,
  FeedbackRating,
} from "@pcr/shared";

export interface PcrStoreOptions {
  dbPath?: string;
  readonly?: boolean;
}

export interface ContextSourceRecord {
  id: string;
  scope: "user" | "project" | "explicit" | "history";
  kind: ContextBlockKind;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface ContextDocumentRecord {
  id: string;
  sourceId: string;
  path: string;
  kind: ContextBlockKind;
  title: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

export interface ContextChunkRecord {
  id: string;
  documentId: string;
  sourceId: string;
  kind: ContextBlockKind;
  label: string;
  content: string;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
}

export interface FeedbackRecord extends FeedbackInput {
  id: string;
  createdAt: string;
  rating: FeedbackRating;
}

export type { CompilationHistoryRecord };

