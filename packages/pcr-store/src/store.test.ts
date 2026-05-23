import { describe, expect, it } from "vitest";
import { createPcrStore } from "./index.js";

function sampleCompilation() {
  return {
    compileId: "pcr_test",
    createdAt: "2026-05-20T00:00:00.000Z",
    source: "cli" as const,
    mode: "research" as const,
    templateId: "research.progress-assessment",
    profileId: "reflective-research",
    rawText: "assess progress",
    prompt: "compiled prompt",
    promptIr: {
      intent: "progress-assessment",
      mode: "research" as const,
      task: "assess progress",
      assumptions: [],
      constraints: [],
      contextSummary: "summary",
      contextItems: [],
      positivePatterns: [],
      negativePatterns: [],
      outputFormat: { type: "markdown" as const },
      style: {},
      execution: {
        askClarifyingQuestions: false,
        allowWeb: false,
        requireCitations: false,
        requireTests: false,
        requirePlan: true,
      },
      metadata: {
        templateId: "research.progress-assessment",
        profileId: "reflective-research",
        source: "cli" as const,
      },
    },
    contextPack: {
      goals: [],
      schedule: [],
      preferences: [],
      recurringComments: [],
      positiveExamples: [],
      negativeExamples: [],
      projectContext: [],
      manualContext: [],
      summary: "summary",
      tokenEstimate: 1,
    },
    metadata: {
      compileId: "pcr_test",
      createdAt: "2026-05-20T00:00:00.000Z",
      templateId: "research.progress-assessment",
      profileId: "reflective-research",
      mode: "research",
      source: "cli",
      tokenEstimate: 10,
      contextTokenEstimate: 1,
      warnings: [],
      compilerVersion: "0.1.0",
    },
  };
}

describe("PcrStore", () => {
  it("runs migrations", () => {
    const store = createPcrStore({ dbPath: ":memory:" });
    const rows = store.database.prepare("SELECT version FROM schema_migrations").all();
    expect(rows).toHaveLength(1);
    store.close();
  });

  it("persists history and feedback", () => {
    const store = createPcrStore({ dbPath: ":memory:" });
    store.saveCompilation(sampleCompilation());
    const found = store.getCompilation("pcr_test");
    expect(found?.prompt).toBe("compiled prompt");

    store.addFeedback({ compileId: "pcr_test", rating: "like", comment: "good structure" });
    expect(store.listFeedback("pcr_test")[0]?.rating).toBe("like");
    store.close();
  });

  it("persists context chunks and FTS rows", () => {
    const store = createPcrStore({ dbPath: ":memory:" });
    store.upsertContextSource({
      id: "src_goals",
      scope: "user",
      kind: "goal",
      path: "/tmp/goals.md",
    });
    store.upsertContextDocument({
      id: "doc_goals",
      sourceId: "src_goals",
      path: "/tmp/goals.md",
      kind: "goal",
      title: "goals.md",
      contentHash: "hash",
    });
    store.replaceDocumentChunks("doc_goals", [
      {
        id: "chunk_goals_1",
        documentId: "doc_goals",
        sourceId: "src_goals",
        kind: "goal",
        label: "goals.md",
        content: "Finish PCR V0",
        tokenEstimate: 4,
      },
    ]);

    expect(store.listContextChunks()).toHaveLength(1);
    const ftsRows = store.database
      .prepare("SELECT chunk_id FROM context_chunks_fts WHERE context_chunks_fts MATCH ?")
      .all("PCR");
    expect(ftsRows).toHaveLength(1);
    store.close();
  });
});

