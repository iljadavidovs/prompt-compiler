import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyIntent, deterministicClassifyIntent, loadLocalEnv, openAiOptions } from "./index.js";

describe("pcr-intelligence", () => {
  it("classifies vague progress language with deterministic fallback", () => {
    const result = deterministicClassifyIntent({
      rawText: "help me figure out where I stand this week",
      enabledTools: [
        {
          id: "progress-assessment",
          name: "Progress Assessment",
          description: "Assess progress against goals and schedule.",
          modes: ["research"],
          intents: ["progress-assessment"],
          triggers: ["progress", "where I stand"],
          contextKinds: ["goal", "schedule"],
        },
      ],
    });

    expect(result.intent).toBe("progress-assessment");
    expect(result.contextNeeds).toContain("goal");
    expect(result.contextNeeds).toContain("schedule");
    expect(result.usedLlm).toBe(false);
  });

  it("skips when no tools are enabled", () => {
    const result = deterministicClassifyIntent({
      rawText: "what is 2 + 2?",
      enabledTools: [],
    });

    expect(result.adapter).toBe("skip");
    expect(result.intent).toBe("skip");
  });

  it("uses GPT-5.5 as the default OpenAI classifier model", () => {
    const previous = process.env.PCR_OPENAI_MODEL;
    delete process.env.PCR_OPENAI_MODEL;

    expect(openAiOptions().model).toBe("gpt-5.5");

    if (previous === undefined) {
      delete process.env.PCR_OPENAI_MODEL;
    } else {
      process.env.PCR_OPENAI_MODEL = previous;
    }
  });

  it("skips PCR diagnostic questions instead of routing pasted output to planner", async () => {
    const result = await classifyIntent({
      rawText: [
        "But why did it return this?",
        "",
        "## Reminder query",
        "- Command: /opt/homebrew/bin/remindctl show upcoming --json",
        "- Horizon: upcoming reminders.",
        "- Reason: No narrower planning horizon was detected; use upcoming reminders.",
      ].join("\n"),
      enabledTools: [
        {
          id: "planner",
          name: "Planner",
          description: "Compile planning prompts.",
          modes: ["analysis"],
          intents: ["planning"],
          triggers: ["plan", "planner", "planning", "schedule"],
          contextKinds: ["schedule"],
        },
      ],
      options: {
        enabled: true,
        provider: "openai",
      },
    });

    expect(result.adapter).toBe("skip");
    expect(result.intent).toBe("skip");
    expect(result.warnings.join("\n")).toContain("PCR diagnostic output");
  });

  it("sends compact recent user turns to OpenAI classifier", async () => {
    const previousFetch = globalThis.fetch;
    let payload: any;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          mode: "analysis",
          intent: "planning",
          confidence: 0.9,
          taskRewrite: "Plan next month using continuity from recent turns.",
          contextQueries: ["next month launch plan"],
          contextNeeds: ["goal", "schedule", "preference"],
          adapter: "planning_prompt_compile",
          complexity: "medium",
          shouldAskClarifyingQuestion: false,
          clarifyingQuestions: [],
          constraints: [],
          warnings: [],
        }),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    try {
      const result = await classifyIntent({
        rawText: "Let's continue that plan next month.",
        history: [
          {
            role: "user",
            text: "Let's plan next month so I can launch essencekit and prompt compiler.",
            selectedToolId: "planner",
            intent: "planning",
            mode: "analysis",
            skipped: false,
          },
        ],
        enabledTools: [
          {
            id: "planner",
            name: "Planner",
            description: "Compile planning prompts.",
            modes: ["analysis"],
            intents: ["planning"],
            triggers: ["plan", "planner", "planning"],
            contextKinds: ["goal", "schedule", "preference"],
          },
        ],
        options: {
          enabled: true,
          provider: "openai",
          apiKey: "test-key",
        },
      });

      const userContent = JSON.parse(payload.input[1].content);
      expect(userContent.recentUserTurns).toHaveLength(1);
      expect(userContent.recentUserTurns[0].selectedToolId).toBe("planner");
      expect(userContent.recentUserTurns[0].text).toContain("essencekit");
      expect(JSON.stringify(payload)).not.toContain("Compiled prompt");
      expect(result.usedLlm).toBe(true);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("falls back when OpenAI is enabled without an API key", async () => {
    const previous = process.env.PCR_OPENAI_API_KEY;
    const previousOpenAi = process.env.OPENAI_API_KEY;
    const previousSkip = process.env.PCR_SKIP_ENV_FILE;
    delete process.env.PCR_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.PCR_SKIP_ENV_FILE = "1";

    const result = await classifyIntent({
      rawText: "help me figure out where I stand this week",
      options: {
        enabled: true,
        provider: "openai",
      },
    });

    expect(result.provider).toBe("deterministic");
    expect(result.usedLlm).toBe(false);
    expect(result.warnings.join("\n")).toContain("Intelligence fallback");

    if (previous) {
      process.env.PCR_OPENAI_API_KEY = previous;
    }
    if (previousOpenAi) {
      process.env.OPENAI_API_KEY = previousOpenAi;
    }
    if (previousSkip === undefined) {
      delete process.env.PCR_SKIP_ENV_FILE;
    } else {
      process.env.PCR_SKIP_ENV_FILE = previousSkip;
    }
  });

  it("canonicalizes progress assessment variants", async () => {
    const result = await classifyIntent({
      rawText: "progress assessment please",
      explicitMode: "research",
      options: {
        enabled: false,
      },
    });

    expect(result.intent).toBe("progress-assessment");
    expect(result.contextNeeds).toEqual(expect.arrayContaining(["goal", "schedule", "preference", "history"]));
  });

  it("loads local env files without overriding existing env", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pcr-env-"));
    await writeFile(join(dir, ".env.local"), "PCR_OPENAI_MODEL=test-model\nPCR_TEST_VALUE=loaded\n");
    delete process.env.PCR_TEST_VALUE;
    const previousModel = process.env.PCR_OPENAI_MODEL;
    const previousSkip = process.env.PCR_SKIP_ENV_FILE;
    delete process.env.PCR_SKIP_ENV_FILE;
    process.env.PCR_OPENAI_MODEL = "existing-model";

    loadLocalEnv(dir);

    expect(process.env.PCR_TEST_VALUE).toBe("loaded");
    expect(process.env.PCR_OPENAI_MODEL).toBe("existing-model");

    if (previousModel === undefined) {
      delete process.env.PCR_OPENAI_MODEL;
    } else {
      process.env.PCR_OPENAI_MODEL = previousModel;
    }
    delete process.env.PCR_TEST_VALUE;
    if (previousSkip === undefined) {
      delete process.env.PCR_SKIP_ENV_FILE;
    } else {
      process.env.PCR_SKIP_ENV_FILE = previousSkip;
    }
  });
});
