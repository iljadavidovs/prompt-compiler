import { join } from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import { compilePrompt } from "@pcr/core";
import { createPcrStore } from "@pcr/store";
import type { CompilationProvenance, CompilePromptOutput, ContextBlock } from "@pcr/shared";
import { WorkspaceError, WorkspaceStore, hashContent, parseBindings } from "./workspace-store.js";

const route = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };

export function installPlaygroundRoutes(app: Express, userDir: string, dbPath: string, isolated = true): void {
  const library = new WorkspaceStore(join(userDir, "library"));
  const pending = new Map<string, { hash: string; promise: Promise<CompilePromptOutput> }>();
  app.use("/v1", (req, res, next) => {
    if (isolated && (req.query.cwd || req.body?.cwd)) { res.status(400).json({ error: "This workspace has a fixed identity; cwd overrides are unavailable." }); return; }
    if (isolated && req.path.startsWith("/context/")) { res.status(403).json({ error: "Implicit indexing and retrieval are unavailable in selected-only mode." }); return; }
    next();
  });
  app.get("/v1/workspace", route(async (_req, res) => {
    const data = await library.read();
    res.json({ ...data, libraryPath: library.path, dbPath, capabilities: { contextMode: "selected-only", providers: "unavailable", commands: "denied", externalAdapters: "unavailable" } });
  }));
  app.post("/v1/drafts", route(async (req, res) => { res.json(await library.saveDraft(req.body.draft, req.body.expectedRevision)); }));
  app.post("/v1/library", route(async (req, res) => { res.json(await library.saveItem(req.body.item, req.body.expectedRevision)); }));
  app.post("/v1/library/import", route(async (req, res) => { res.json(await library.importEnvelope(req.body)); }));
  app.get("/v1/library/export", route(async (_req, res) => {
    const data = await library.read();
    res.json({ format: "pcr-library", schemaVersion: 1, projectId: data.projectId, items: data.items.filter((item) => !item.archived).map(item => ({ ...item, source: item.source ?? { host: "local", projectId: data.projectId, artifactId: item.id, revision: item.revision, contentHash: item.contentHash } })) });
  }));
  app.post(isolated ? ["/v1/playground/compile", "/v1/compile"] : "/v1/playground/compile", route(async (req, res) => {
    const data = await library.read();
    const { rawText, requestId } = req.body;
    if (typeof rawText !== "string" || !rawText.trim() || rawText.length > 200_000) throw new WorkspaceError("Write a request before compiling (maximum 200,000 characters).");
    if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) throw new WorkspaceError("A stable compile request ID is required.");
    if (req.body.projectId !== data.projectId) throw new WorkspaceError("Workspace identity mismatch.", 409);
    const bindings = parseBindings(req.body.bindings);
    const blocks: ContextBlock[] = [];
    const provenance: CompilationProvenance = { schemaVersion: 1, projectId: data.projectId, derivedFrom: [] };
    for (const binding of bindings.filter((binding) => binding.enabled)) {
      const item = data.items.find((entry) => entry.id === binding.id && !entry.archived);
      if (!item) throw new WorkspaceError(`Selected source ${binding.id} is missing or removed. Remove it from selection or restore it.`, 409);
      if (item.revision !== binding.revision || item.contentHash !== binding.contentHash) throw new WorkspaceError(`Selected source ${item.title} changed. Refresh its binding explicitly before compiling.`, 409);
      const source = item.source ?? { host: "local" as const, projectId: data.projectId, artifactId: item.id, revision: item.revision, contentHash: item.contentHash };
      // Imported snapshots preserve the original project's exact identity; selection is explicit.
      provenance.derivedFrom.push({ source, role: binding.role, order: blocks.length });
      const kind = ["goal", "schedule", "preference"].includes(binding.role) ? binding.role as "goal" | "schedule" | "preference" : "manual";
      blocks.push({ id: item.id, label: item.title, kind, content: item.content, metadata: { source, bindingRole: binding.role, selectionOrder: blocks.length } });
    }
    const maxContextTokens = req.body.maxContextTokens;
    if (req.body.skip !== undefined && typeof req.body.skip !== "boolean") throw new WorkspaceError("Invalid skip option.");
    if (!Number.isSafeInteger(maxContextTokens) || maxContextTokens < 256 || maxContextTokens > 32_000) throw new WorkspaceError("Context budget must be between 256 and 32,000 estimated tokens.");
    const inputHash = hashContent(JSON.stringify({ rawText, bindings, maxContextTokens, skip: req.body.skip === true, projectId: data.projectId }));
    const store = createPcrStore({ dbPath });
    try {
      const old = store.getCompilationByRequestId(requestId);
      if (old) {
        if (old.metadata.inputHash !== inputHash) throw new WorkspaceError("Compile request ID was reused with different input.", 409);
        res.json({ prompt: old.prompt, promptIr: old.promptIr, contextPack: old.contextPack, metadata: old.metadata, trace: old.metadata.trace }); return;
      }
    } finally { store.close(); }
    const active = pending.get(requestId);
    if (active && active.hash !== inputHash) throw new WorkspaceError("Compile already pending with different input.", 409);
    const promise = active?.promise ?? compilePrompt({
      source: "browser", rawText, cwd: userDir, contextBlocks: blocks, requestId, inputHash, provenance,
      options: { skip: req.body.skip === true, contextMode: "selected-only", executionPolicy: "local-only", deterministic: true, includeTrace: true, maxContextTokens, intelligence: { enabled: false, provider: "none", historyWindow: { enabled: false } } },
    });
    pending.set(requestId, { hash: inputHash, promise });
    try { res.json(await promise); } finally { pending.delete(requestId); }
  }));
  app.get("/v1/history/:id/feedback", route(async (req, res) => {
    const store = createPcrStore({ dbPath });
    try { res.json(store.listFeedback(String(req.params.id))); } finally { store.close(); }
  }));
}
