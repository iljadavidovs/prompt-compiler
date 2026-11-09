import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { redactStructured, type BindingRole, type SourceReference } from "@pcr/shared";

export const ROLES: BindingRole[] = ["background", "requirement", "criteria", "example", "goal", "schedule", "preference"];
export interface Binding { id: string; revision: number; contentHash: string; role: BindingRole; enabled: boolean }
export interface LibraryItem {
  id: string; revision: number; contentHash: string; title: string; type: "prompt" | "context" | "criteria";
  content: string; purpose: string; inputs: string[]; outputCriteria: string; tags: string[];
  sensitivity: "non-sensitive" | "private"; provenance: string; source?: SourceReference; archived?: boolean;
}
export interface Draft {
  id: string; revision: number; title: string; content: string; bindings: Binding[];
  derivedFrom?: string; updatedAt: string;
}
interface Workspace { schemaVersion: 1; projectId: string; items: LibraryItem[]; drafts: Draft[] }
export class WorkspaceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const hashContent = (content: string): string => createHash("sha256").update(content).digest("hex");
function text(value: unknown, name: string, max = 200_000): string {
  if (typeof value !== "string" || value.length > max) throw new WorkspaceError(`Invalid ${name}.`);
  return value;
}
function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new WorkspaceError(`Invalid ${name}.`);
  return value.map((item) => text(item, name, 500));
}
function safe(value: unknown): void {
  if (JSON.stringify(value) !== JSON.stringify(redactStructured(value))) throw new WorkspaceError("Credential-shaped content is not accepted. Remove it before saving or importing.");
}
function validId(id: unknown): string {
  if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id)) throw new WorkspaceError("Invalid document ID.");
  return id;
}
export function parseItem(value: unknown): LibraryItem {
  if (!value || typeof value !== "object") throw new WorkspaceError("Expected a library item.");
  const data = value as Record<string, unknown>;
  const content = text(data.content, "content");
  if (!["prompt", "context", "criteria"].includes(String(data.type))) throw new WorkspaceError("Invalid artifact type.");
  if (!["non-sensitive", "private"].includes(String(data.sensitivity))) throw new WorkspaceError("Invalid sensitivity.");
  const item: LibraryItem = {
    id: validId(data.id), revision: Number(data.revision), contentHash: hashContent(content),
    title: text(data.title, "title", 200), type: data.type as LibraryItem["type"], content,
    purpose: text(data.purpose, "purpose", 3000), inputs: strings(data.inputs, "inputs"),
    outputCriteria: text(data.outputCriteria, "review criteria", 6000), tags: strings(data.tags, "tags"),
    sensitivity: data.sensitivity as LibraryItem["sensitivity"], provenance: text(data.provenance, "provenance", 3000),
    archived: data.archived === true,
  };
  if (!item.title.trim() || !Number.isSafeInteger(item.revision) || item.revision < 1) throw new WorkspaceError("A title and positive revision are required.");
  if (data.contentHash && data.contentHash !== item.contentHash) throw new WorkspaceError("Content hash mismatch.");
  if (data.source) {
    const source = data.source as SourceReference;
    if (!["local", "quaggit-fixture"].includes(source.host)) throw new WorkspaceError("Source adapter unavailable. Import a resolved local snapshot instead.");
    if (typeof source.projectId !== "string" || typeof source.artifactId !== "string" || !Number.isSafeInteger(source.revision) || source.revision < 1 || source.contentHash !== item.contentHash) throw new WorkspaceError("Malformed or stale source reference.");
    item.source = { host: source.host, projectId: source.projectId, artifactId: source.artifactId, revision: source.revision, contentHash: source.contentHash };
  }
  safe(item);
  return item;
}
export function parseBindings(value: unknown): Binding[] {
  if (!Array.isArray(value) || value.length > 100) throw new WorkspaceError("Invalid context selection.");
  const bindings = value.map((binding: Binding) => {
    if (!binding || !ROLES.includes(binding.role) || typeof binding.enabled !== "boolean" || !Number.isSafeInteger(binding.revision) || binding.revision < 1 || !/^[a-f0-9]{64}$/.test(binding.contentHash)) throw new WorkspaceError("Invalid context binding.");
    return { id: validId(binding.id), revision: binding.revision, contentHash: binding.contentHash, role: binding.role, enabled: binding.enabled };
  });
  if (new Set(bindings.map((binding) => binding.id)).size !== bindings.length) throw new WorkspaceError("Duplicate context binding.");
  return bindings;
}

/** One standalone authority for drafts and local library, with atomic CAS writes. No search index. */
export class WorkspaceStore {
  readonly path: string;
  constructor(readonly dir: string) { this.path = join(dir, "workspace.json"); }
  async read(): Promise<Workspace> {
    try {
      const data = JSON.parse(await readFile(this.path, "utf8")) as Workspace;
      if (data.schemaVersion !== 1) throw new WorkspaceError("Unsupported workspace version.");
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { schemaVersion: 1, projectId: `local-${hashContent(this.dir).slice(0, 16)}`, items: [], drafts: [] };
    }
  }
  async mutate<T>(change: (data: Workspace) => T): Promise<T> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const lockPath = `${this.path}.lock`;
    const lock = await open(lockPath, "wx", 0o600).catch(() => { throw new WorkspaceError("Workspace is busy. Retry saving; your draft is still in the editor.", 409); });
    const temp = `${this.path}.${randomUUID()}.tmp`;
    try {
      const data = await this.read();
      const result = change(data);
      const file = await open(temp, "wx", 0o600);
      try { await file.writeFile(JSON.stringify(data, null, 2)); await file.sync(); } finally { await file.close(); }
      await rename(temp, this.path);
      return result;
    } finally {
      await unlink(temp).catch(() => {});
      await lock.close(); await unlink(lockPath);
    }
  }
  async saveItem(value: unknown, expectedRevision: unknown): Promise<LibraryItem> {
    const item = parseItem(value);
    return this.mutate((data) => {
      const index = data.items.findIndex((entry) => entry.id === item.id);
      const old = data.items[index];
      if ((old?.revision ?? 0) !== expectedRevision) throw new WorkspaceError("Library item changed in another session. Export your edit, then reload or save a copy.", 409);
      item.revision = (old?.revision ?? 0) + 1;
      // Editing a snapshot creates local authorship; preserve the exact imported source only while unchanged.
      if (old && old.contentHash !== item.contentHash) delete item.source;
      if (index < 0) data.items.push(item); else data.items[index] = item;
      return item;
    });
  }
  async saveDraft(value: unknown, expectedRevision: unknown): Promise<Draft> {
    const input = value as Draft;
    const draft: Draft = { id: validId(input.id), title: text(input.title, "draft title", 200), content: text(input.content, "draft"), bindings: parseBindings(input.bindings), revision: 1, updatedAt: new Date().toISOString() };
    if (input.derivedFrom) draft.derivedFrom = text(input.derivedFrom, "compilation reference", 100);
    safe(draft);
    return this.mutate((data) => {
      const index = data.drafts.findIndex((entry) => entry.id === draft.id);
      const old = data.drafts[index];
      if ((old?.revision ?? 0) !== expectedRevision) throw new WorkspaceError("Draft changed in another session. Your edits are kept here. Export them or duplicate before reloading.", 409);
      draft.revision = (old?.revision ?? 0) + 1;
      if (index < 0) data.drafts.push(draft); else data.drafts[index] = draft;
      return draft;
    });
  }
  async importEnvelope(value: unknown): Promise<{ imported: number; unchanged: number }> {
    const envelope = value as { schemaVersion: unknown; format: unknown; projectId: unknown; items: unknown[] };
    if (!envelope || envelope.schemaVersion !== 1 || envelope.format !== "pcr-library" || typeof envelope.projectId !== "string" || !Array.isArray(envelope.items) || envelope.items.length > 200) throw new WorkspaceError("Expected pcr-library version 1 JSON (up to 200 resolved items).");
    const items = envelope.items.map(parseItem).map(item => ({ ...item, source: item.source ?? { host: "local" as const, projectId: envelope.projectId as string, artifactId: item.id, revision: item.revision, contentHash: item.contentHash } }));
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new WorkspaceError("Duplicate import IDs.");
    return this.mutate((data) => {
      let imported = 0;
      for (const item of items) {
        const old = data.items.find((entry) => entry.id === item.id);
        const comparable = old ? { ...old, source: old.source ?? { host: "local", projectId: data.projectId, artifactId: old.id, revision: old.revision, contentHash: old.contentHash } } : undefined;
        if (old && JSON.stringify(comparable) !== JSON.stringify(item)) throw new WorkspaceError(`Import conflict: ${item.id}. Existing work was preserved. Duplicate it with a new ID to import separately.`, 409);
        if (!old) { data.items.push(item); imported++; }
      }
      return { imported, unchanged: items.length - imported };
    });
  }
}
