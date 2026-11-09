import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  createCompileId,
  isoNow,
  redactSecrets,
  redactStructured,
  resolvePcrPaths,
  type CompilationHistoryRecord,
  type ContextPack,
  type PromptIR,
} from "@pcr/shared";
import { MIGRATIONS } from "./migrations.js";
import type {
  ContextChunkRecord,
  ContextDocumentRecord,
  ContextSourceRecord,
  FeedbackRecord,
  PcrStoreOptions,
} from "./types.js";

type SqliteDatabase = Database.Database;

interface CompilationRow {
  compile_id: string;
  created_at: string;
  source: CompilationHistoryRecord["source"];
  mode: CompilationHistoryRecord["mode"];
  template_id: string;
  profile_id: string;
  raw_text: string;
  prompt: string;
  prompt_ir_json: string;
  context_pack_json: string;
  metadata_json: string;
  token_estimate: number;
  context_token_estimate: number;
}

interface FeedbackRow {
  id: string;
  compile_id: string;
  created_at: string;
  rating: FeedbackRecord["rating"];
  outcome: string | null;
  comment: string | null;
}

interface ContextChunkRow {
  id: string;
  document_id: string;
  source_id: string;
  kind: ContextChunkRecord["kind"];
  label: string;
  content: string;
  token_estimate: number;
  metadata_json: string;
}

function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function openDatabase(options: PcrStoreOptions = {}): SqliteDatabase {
  const dbPath = options.dbPath ?? resolvePcrPaths().dbPath;
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const database = new Database(dbPath, { readonly: options.readonly ?? false });
  database.pragma("foreign_keys = ON");
  return database;
}

export class PcrStore {
  readonly database: SqliteDatabase;

  constructor(options: PcrStoreOptions = {}) {
    this.database = openDatabase(options);
  }

  migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = new Set(
      this.database
        .prepare("SELECT version FROM schema_migrations")
        .all()
        .map((row) => (row as { version: number }).version),
    );

    const applyMigration = this.database.transaction(() => {
      for (const migration of MIGRATIONS) {
        if (applied.has(migration.version)) {
          continue;
        }
        this.database.exec(migration.sql);
        this.database
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(migration.version, migration.name, isoNow());
      }
    });

    applyMigration();
  }

  close(): void {
    this.database.close();
  }

  saveCompilation(record: CompilationHistoryRecord): void {
    this.migrate();
    this.database
      .prepare(`
        INSERT OR REPLACE INTO compilations (
          compile_id,
          created_at,
          source,
          mode,
          template_id,
          profile_id,
          raw_text,
          prompt,
          prompt_ir_json,
          context_pack_json,
          metadata_json,
          token_estimate,
          context_token_estimate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.compileId,
        record.createdAt,
        record.source,
        record.mode,
        record.templateId,
        record.profileId,
        redactSecrets(record.rawText),
        redactSecrets(record.prompt),
        json(redactStructured(record.promptIr)),
        json(redactStructured(record.contextPack)),
        json(redactStructured(record.metadata)),
        record.metadata.tokenEstimate,
        record.metadata.contextTokenEstimate,
      );
  }

  getCompilationByRequestId(requestId: string): CompilationHistoryRecord | null {
    this.migrate();
    const row = this.database.prepare("SELECT * FROM compilations WHERE json_extract(metadata_json, '$.requestId') = ? LIMIT 1").get(requestId) as CompilationRow | undefined;
    return row ? rowToCompilation(row) : null;
  }

  getCompilation(compileId: string): CompilationHistoryRecord | null {
    this.migrate();
    const row = this.database
      .prepare("SELECT * FROM compilations WHERE compile_id = ?")
      .get(compileId) as CompilationRow | undefined;
    return row ? rowToCompilation(row) : null;
  }

  listCompilations(limit = 20): CompilationHistoryRecord[] {
    this.migrate();
    const rows = this.database
      .prepare("SELECT * FROM compilations ORDER BY created_at DESC LIMIT ?")
      .all(limit) as CompilationRow[];
    return rows.map(rowToCompilation);
  }

  addFeedback(input: {
    compileId: string;
    rating: FeedbackRecord["rating"];
    outcome?: string;
    comment?: string;
  }): FeedbackRecord {
    this.migrate();
    const record: FeedbackRecord = {
      id: createCompileId().replace("pcr_", "fb_"),
      compileId: input.compileId,
      createdAt: isoNow(),
      rating: input.rating,
      outcome: input.outcome ? redactSecrets(input.outcome) : undefined,
      comment: input.comment ? redactSecrets(input.comment) : undefined,
    };

    this.database
      .prepare(`
        INSERT INTO feedback (id, compile_id, created_at, rating, outcome, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(record.id, record.compileId, record.createdAt, record.rating, record.outcome ?? null, record.comment ?? null);

    return record;
  }

  listFeedback(compileId?: string): FeedbackRecord[] {
    this.migrate();
    const rows = compileId
      ? (this.database
          .prepare("SELECT * FROM feedback WHERE compile_id = ? ORDER BY created_at DESC")
          .all(compileId) as FeedbackRow[])
      : (this.database.prepare("SELECT * FROM feedback ORDER BY created_at DESC").all() as FeedbackRow[]);
    return rows.map(rowToFeedback);
  }

  upsertContextSource(record: ContextSourceRecord): void {
    this.migrate();
    const now = isoNow();
    this.database
      .prepare(`
        INSERT INTO context_sources (id, scope, kind, path, created_at, updated_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          scope = excluded.scope,
          kind = excluded.kind,
          path = excluded.path,
          updated_at = excluded.updated_at,
          metadata_json = excluded.metadata_json
      `)
      .run(record.id, record.scope, record.kind, record.path, now, now, json(record.metadata));
  }

  upsertContextDocument(record: ContextDocumentRecord): void {
    this.migrate();
    const now = isoNow();
    this.database
      .prepare(`
        INSERT INTO context_documents (id, source_id, path, kind, title, content_hash, created_at, updated_at, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_id = excluded.source_id,
          path = excluded.path,
          kind = excluded.kind,
          title = excluded.title,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at,
          metadata_json = excluded.metadata_json
      `)
      .run(
        record.id,
        record.sourceId,
        record.path,
        record.kind,
        record.title,
        record.contentHash,
        now,
        now,
        json(record.metadata),
      );
  }

  replaceDocumentChunks(documentId: string, chunks: ContextChunkRecord[]): void {
    this.migrate();
    const transaction = this.database.transaction(() => {
      const existingRows = this.database
        .prepare("SELECT id FROM context_chunks WHERE document_id = ?")
        .all(documentId) as Array<{ id: string }>;
      const existingIds = existingRows.map((row) => row.id);
      if (existingIds.length > 0) {
        const placeholders = existingIds.map(() => "?").join(", ");
        this.database.prepare(`DELETE FROM context_chunks_fts WHERE chunk_id IN (${placeholders})`).run(...existingIds);
      }
      this.database.prepare("DELETE FROM context_chunks WHERE document_id = ?").run(documentId);

      const now = isoNow();
      const insertChunk = this.database.prepare(`
        INSERT INTO context_chunks (
          id,
          document_id,
          source_id,
          kind,
          label,
          content,
          token_estimate,
          created_at,
          updated_at,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertFts = this.database.prepare(`
        INSERT INTO context_chunks_fts (chunk_id, document_id, source_id, kind, label, content, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const chunk of chunks) {
        const metadata = json(chunk.metadata);
        const redactedContent = redactSecrets(chunk.content);
        insertChunk.run(
          chunk.id,
          chunk.documentId,
          chunk.sourceId,
          chunk.kind,
          chunk.label,
          redactedContent,
          chunk.tokenEstimate,
          now,
          now,
          metadata,
        );
        insertFts.run(chunk.id, chunk.documentId, chunk.sourceId, chunk.kind, chunk.label, redactedContent, metadata);
      }
    });

    transaction();
  }

  listContextChunks(limit = 50): ContextChunkRecord[] {
    this.migrate();
    const rows = this.database
      .prepare("SELECT * FROM context_chunks ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as ContextChunkRow[];
    return rows.map(rowToContextChunk);
  }
}

export function createPcrStore(options?: PcrStoreOptions): PcrStore {
  const store = new PcrStore(options);
  store.migrate();
  return store;
}

function rowToCompilation(row: CompilationRow): CompilationHistoryRecord {
  return {
    compileId: row.compile_id,
    createdAt: row.created_at,
    source: row.source,
    mode: row.mode,
    templateId: row.template_id,
    profileId: row.profile_id,
    rawText: row.raw_text,
    prompt: row.prompt,
    promptIr: parseJson<PromptIR>(row.prompt_ir_json),
    contextPack: parseJson<ContextPack>(row.context_pack_json),
    metadata: parseJson<CompilationHistoryRecord["metadata"]>(row.metadata_json),
  };
}

function rowToFeedback(row: FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    compileId: row.compile_id,
    createdAt: row.created_at,
    rating: row.rating,
    outcome: row.outcome ?? undefined,
    comment: row.comment ?? undefined,
  };
}

function rowToContextChunk(row: ContextChunkRow): ContextChunkRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    sourceId: row.source_id,
    kind: row.kind,
    label: row.label,
    content: row.content,
    tokenEstimate: row.token_estimate,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json),
  };
}

