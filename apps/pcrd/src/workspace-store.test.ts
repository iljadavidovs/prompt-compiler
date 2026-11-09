import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { WorkspaceStore, hashContent, parseItem } from "./workspace-store.js";

// Deliberately tiny synthetic regression records; not the owner's working library.
const syntheticItem = (id = "fixture-one", content = "SYNTHETIC_REQUIREMENT"): any => ({ id, title: id, revision: 1, type: "context", content, purpose: "Regression fixture", inputs: ["[INPUT]"], outputCriteria: "Inspect result", tags: ["synthetic"], sensitivity: "non-sensitive", provenance: "Synthetic automated test fixture" });
const envelope = (items: unknown[]) => ({ format: "pcr-library", schemaVersion: 1, projectId: "fixture-project", items });

describe("standalone workspace persistence", () => {
  it("loads the shipped sample pack once and preserves initialized workspaces byte for byte", async () => {
    const pack = JSON.parse(await readFile(new URL("../../../examples/playground-sample-pack.json", import.meta.url), "utf8"));
    const store = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-sample-")));
    expect(await store.importEnvelope(pack, { onlyIfMissing: true })).toEqual({ imported: 3, unchanged: 0 });
    const seeded = await store.read();
    expect(seeded.items.map(item => item.type)).toEqual(["prompt", "context", "criteria"]);
    expect(seeded.drafts).toEqual([]);
    const [prompt, context] = seeded.items;
    await store.saveItem({ ...prompt, title: "My edited sample" }, prompt.revision);
    await store.saveItem({ ...context, archived: true }, context.revision);
    const before = await readFile(store.path, "utf8");
    expect((await store.importEnvelope(pack, { onlyIfMissing: true })).imported).toBe(0);
    expect(await readFile(store.path, "utf8")).toBe(before);

    const empty = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-empty-library-")));
    await empty.importEnvelope(envelope([]));
    const emptyBefore = await readFile(empty.path, "utf8");
    expect((await empty.importEnvelope(pack, { onlyIfMissing: true })).imported).toBe(0);
    expect(await readFile(empty.path, "utf8")).toBe(emptyBefore);
  });

  it("atomically saves drafts, rejects concurrent revision conflicts, preserves work after reload", async () => {
    const store = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-library-")));
    const draft = { id: "draft-one", title: "Synthetic", content: "Original", bindings: [] };
    const saved = await store.saveDraft(draft, 0);
    const results = await Promise.allSettled([store.saveDraft({ ...saved, content: "A" }, 1), store.saveDraft({ ...saved, content: "B" }, 1)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await new WorkspaceStore(store.dir).read()).drafts[0].revision).toBe(2);
    await expect(store.saveDraft(draft, 0)).rejects.toThrow("another session");
  });
  it("imports idempotently, stops conflicts atomically and round-trips exact fixture revisions", async () => {
    const store = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-import-")));
    const one = syntheticItem(); one.source = { host: "quaggit-fixture", projectId: "synthetic-project", artifactId: "qg_synthetic", revision: 7, contentHash: hashContent(one.content) };
    expect(await store.importEnvelope(envelope([one]))).toMatchObject({ imported: 1 });
    const stored = (await store.read()).items;
    expect(await store.importEnvelope(envelope(stored))).toEqual({ imported: 0, unchanged: 1 });
    await expect(store.importEnvelope(envelope([syntheticItem("new"), { ...one, content: "Conflict", source: undefined }]))).rejects.toThrow("conflict");
    expect((await store.read()).items).toHaveLength(1);
    expect((await store.read()).items[0].source?.revision).toBe(7);
  });
  it("rejects paths, credential content, malformed/unsupported envelopes, stale hashes and adapters", async () => {
    const store = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-invalid-")));
    await expect(store.importEnvelope({ ...envelope([]), schemaVersion: 9 })).rejects.toThrow("version 1");
    expect(() => parseItem(syntheticItem("../escape"))).toThrow("ID");
    expect(() => parseItem(syntheticItem("secret", "api_key=synthetic_value"))).toThrow("Credential-shaped");
    expect(() => parseItem({ ...syntheticItem(), contentHash: "bad" })).toThrow("hash mismatch");
    expect(() => parseItem({ ...syntheticItem(), source: { host: "unavailable" } })).toThrow("adapter unavailable");
    expect(() => parseItem({ ...syntheticItem(), source: { host: "quaggit-fixture", revision: 0 } })).toThrow("stale source");
  });
  it("preserves file bytes on save failure and removal needs no stale-index cleanup", async () => {
    const store = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-failure-")));
    const saved = await store.saveItem(syntheticItem(), 0);
    const original = await readFile(store.path, "utf8");
    await writeFile(`${store.path}.lock`, "test lock");
    await expect(store.saveItem({ ...saved, title: "cannot save" }, 1)).rejects.toThrow("busy");
    expect(await readFile(store.path, "utf8")).toBe(original);
    const other = new WorkspaceStore(await mkdtemp(join(tmpdir(), "pcr-remove-")));
    const item = await other.saveItem(syntheticItem(), 0);
    await other.saveItem({ ...item, archived: true }, 1);
    expect((await other.read()).items.filter(entry => !entry.archived)).toHaveLength(0);
  });
});
