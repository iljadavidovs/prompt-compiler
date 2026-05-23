import { describe, expect, it } from "vitest";
import { createPcrStore } from "@pcr/store";
import { getFeedbackExamples, searchContext } from "./index.js";

describe("retrieval", () => {
  it("searches SQLite FTS context chunks with deterministic ranking", () => {
    const store = createPcrStore({ dbPath: ":memory:" });
    store.upsertContextSource({ id: "src", scope: "user", kind: "goal", path: "/goals.md" });
    store.upsertContextDocument({
      id: "doc",
      sourceId: "src",
      path: "/goals.md",
      kind: "goal",
      title: "goals.md",
      contentHash: "hash",
    });
    store.replaceDocumentChunks("doc", [
      {
        id: "goal_chunk",
        documentId: "doc",
        sourceId: "src",
        kind: "goal",
        label: "goals.md",
        content: "Finish PCR V0 and improve execution consistency",
        tokenEstimate: 10,
      },
      {
        id: "schedule_chunk",
        documentId: "doc",
        sourceId: "src",
        kind: "schedule",
        label: "schedule.md",
        content: "Friday review architecture",
        tokenEstimate: 5,
      },
    ]);

    const results = searchContext(store, "goals schedule progress", { kinds: ["goal", "schedule"] });
    expect(results.map((result) => result.id)).toContain("goal_chunk");
    store.close();
  });

  it("returns positive and negative feedback examples", () => {
    const store = createPcrStore({ dbPath: ":memory:" });
    store.saveCompilation({
      compileId: "pcr_history",
      createdAt: "2026-05-20T00:00:00.000Z",
      source: "cli",
      mode: "research",
      templateId: "research.progress-assessment",
      profileId: "reflective-research",
      rawText: "assess progress against goals",
      prompt: "Include bottleneck analysis and risks.",
      promptIr: {
        intent: "progress-assessment",
        mode: "research",
        task: "assess progress",
        assumptions: [],
        constraints: [],
        contextSummary: "",
        contextItems: [],
        positivePatterns: [],
        negativePatterns: [],
        outputFormat: { type: "markdown" },
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
          source: "cli",
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
        summary: "",
        tokenEstimate: 0,
      },
      metadata: {
        compileId: "pcr_history",
        createdAt: "2026-05-20T00:00:00.000Z",
        templateId: "research.progress-assessment",
        profileId: "reflective-research",
        mode: "research",
        source: "cli",
        tokenEstimate: 10,
        contextTokenEstimate: 0,
        warnings: [],
        compilerVersion: "0.1.0",
      },
    });
    store.addFeedback({ compileId: "pcr_history", rating: "like", comment: "good structure" });

    const examples = getFeedbackExamples(store, { query: "progress goals", mode: "research" });
    expect(examples.positive[0]?.content).toContain("good structure");
    store.close();
  });
});

