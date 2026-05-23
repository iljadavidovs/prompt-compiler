export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS context_sources (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS context_documents (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES context_sources(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS context_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES context_documents(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES context_sources(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        content TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS context_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        document_id UNINDEXED,
        source_id UNINDEXED,
        kind,
        label,
        content,
        metadata_json UNINDEXED
      );

      CREATE TABLE IF NOT EXISTS compilations (
        compile_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL,
        mode TEXT NOT NULL,
        template_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        prompt TEXT NOT NULL,
        prompt_ir_json TEXT NOT NULL,
        context_pack_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        token_estimate INTEGER NOT NULL,
        context_token_estimate INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        compile_id TEXT NOT NULL REFERENCES compilations(compile_id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        rating TEXT NOT NULL,
        outcome TEXT,
        comment TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_context_chunks_kind ON context_chunks(kind);
      CREATE INDEX IF NOT EXISTS idx_context_chunks_document_id ON context_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_compilations_created_at ON compilations(created_at);
      CREATE INDEX IF NOT EXISTS idx_compilations_mode ON compilations(mode);
      CREATE INDEX IF NOT EXISTS idx_feedback_compile_id ON feedback(compile_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
    `,
  },
];

