import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPcrStore } from "@pcr/store";
import { describe, expect, it } from "vitest";
import {
  compilePrompt,
  parseMarkdownTemplate,
  parseProfileYaml,
  resolveMode,
} from "./index.js";

async function enableProgressTool(tempDir: string) {
  const userDir = join(tempDir, "user-pcr");
  await mkdir(userDir, { recursive: true });
  await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled:\n    - progress-assessment\n");
  process.env.PCR_USER_DIR = userDir;
}

async function fakeRemindctl(tempDir: string): Promise<string> {
  const script = join(tempDir, "fake-remindctl.cjs");
  await writeFile(script, `#!/usr/bin/env node
const reminders = [
  {
    id: "r1",
    title: "Payment CanarySpace",
    notes: "Renew hosting payment and verify receipt.",
    dueDate: "2026-06-08T12:00:00Z",
    listName: "Reminders",
    priority: "none",
    isCompleted: false
  },
  {
    id: "r2",
    title: "Prompt Compiler review",
    notes: "Review planner routing and dashboard history.",
    dueDate: "2026-05-24T12:00:00Z",
    listName: "Prompt Compiler",
    priority: "high",
    isCompleted: false
  },
  {
    id: "r3",
    title: "Unrelated grocery task",
    notes: "Buy milk.",
    dueDate: "2026-05-24T13:00:00Z",
    listName: "Personal",
    priority: "none",
    isCompleted: false
  }
];
console.log(JSON.stringify(reminders));
`);
  await chmod(script, 0o755);
  return script;
}

describe("core compiler", () => {
  it("parses templates with YAML frontmatter", () => {
    const template = parseMarkdownTemplate(`---
id: test.template
name: Test
mode: research
outputFormat: markdown
---
Hello {{task}}`);

    expect(template.id).toBe("test.template");
    expect(template.body).toBe("Hello {{task}}");
  });

  it("parses YAML profiles", () => {
    const profile = parseProfileYaml(`id: custom
name: Custom
tone: direct
verbosity: deep
strictness: high
rules:
  - Be concrete.
`);

    expect(profile.rules).toContain("Be concrete.");
  });

  it("resolves progress assessment requests to research mode", () => {
    expect(resolveMode("according to my goals and schedule, assess progress")).toBe("research");
  });

  it("compiles a progress assessment prompt from explicit context", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-core-"));
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    await enableProgressTool(tempDir);

    const output = await compilePrompt({
      source: "cli",
      rawText: "$pcr according to my current goals and nearest schedule, compile a research prompt for assessment of my progress",
      contextBlocks: [
        {
          id: "goals",
          label: "Current goals",
          kind: "goal",
          content: "- Finish PCR V0\n- Improve execution consistency",
        },
        {
          id: "schedule",
          label: "Near schedule",
          kind: "schedule",
          content: "- Friday: review architecture",
        },
        {
          id: "preferences",
          label: "Preferences",
          kind: "preference",
          content: "- Direct tone\n- Include risks and weak assumptions",
        },
      ],
      options: { includeTrace: true },
    });

    expect(output.promptIr.intent).toBe("progress-assessment");
    expect(output.metadata.mode).toBe("research");
    expect(output.prompt).toContain("Finish PCR V0");
    expect(output.prompt).toContain("Friday: review architecture");
    expect(output.prompt).toContain("risk");
    expect(output.trace?.steps.map((step) => step.name)).toContain("renderPrompt");

    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    expect(store.getCompilation(output.metadata.compileId)?.prompt).toContain("Finish PCR V0");
    store.close();
    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_USER_DIR;
  });

  it("injects positive and negative feedback examples into future compilations", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-feedback-"));
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    await enableProgressTool(tempDir);

    const first = await compilePrompt({
      source: "cli",
      rawText: "compile a research prompt for assessment of my progress against goals and schedule",
      contextBlocks: [
        {
          id: "goal",
          label: "Goal",
          kind: "goal",
          content: "- Finish PCR V0",
        },
      ],
    });

    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    store.addFeedback({
      compileId: first.metadata.compileId,
      rating: "like",
      comment: "good structure with concrete review questions",
    });
    store.addFeedback({
      compileId: first.metadata.compileId,
      rating: "dislike",
      outcome: "missed_context",
      comment: "ignored schedule constraints",
    });
    store.close();

    const second = await compilePrompt({
      source: "cli",
      rawText: "according to my goals and schedule, compile a research prompt for assessment of my progress",
    });

    expect(second.contextPack.positiveExamples[0]?.content).toContain("good structure");
    expect(second.contextPack.negativeExamples[0]?.content).toContain("ignored schedule constraints");
    expect(second.prompt).toContain("good structure with concrete review questions");
    expect(second.prompt).toContain("ignored schedule constraints");

    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_USER_DIR;
  });

  it("uses intelligence classifier fallback for vague progress language", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-intel-core-"));
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    await enableProgressTool(tempDir);

    const output = await compilePrompt({
      source: "cli",
      rawText: "help me figure out where I stand this week",
      options: {
        includeTrace: true,
        intelligence: {
          enabled: true,
          provider: "openai",
        },
      },
    });

    expect(output.metadata.mode).toBe("research");
    expect(output.promptIr.intent).toBe("progress-assessment");
    expect(output.prompt).toContain("Assess current progress against goals");
    expect(output.metadata.warnings.join("\n")).toContain("Intelligence fallback");
    expect(output.trace?.steps.find((step) => step.name === "classifyIntent")?.details?.usedLlm).toBe(false);

    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_USER_DIR;
  });

  it("skips when no tools are enabled", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-skip-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled: []\n");
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "mcp",
      rawText: "what is 2 + 2?",
      options: { includeTrace: true },
    });

    expect(output.metadata.skipped).toBe(true);
    expect(output.prompt).toBe("");
    expect(output.metadata.skipReason).toContain("no tools are enabled");
    expect(output.trace?.steps.map((step) => step.name)).toContain("skip");

    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    const record = store.getCompilation(output.metadata.compileId);
    expect(record?.metadata.skipped).toBe(true);
    expect(record?.rawText).toBe("what is 2 + 2?");
    store.close();

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("skips when enabled tools do not match the raw request", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-tool-skip-"));
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    await enableProgressTool(tempDir);

    const output = await compilePrompt({
      source: "codex",
      rawText: "what is 2 + 2?",
      options: {
        intelligence: {
          enabled: false,
          provider: "deterministic",
        },
      },
    });

    expect(output.metadata.skipped).toBe(true);
    expect(output.prompt).toBe("");
    expect(output.metadata.skipReason).toContain("no enabled tool matched");

    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    const record = store.getCompilation(output.metadata.compileId);
    expect(record?.metadata.skipped).toBe(true);
    expect(record?.source).toBe("codex");
    store.close();

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("deduplicates repeated Codex hook history rows for the same prompt", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-codex-dedupe-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled: []\n");
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    process.env.PCR_INTELLIGENCE_ENABLED = "0";

    const first = await compilePrompt({
      source: "codex",
      rawText: "why is this duplicated?",
    });
    const second = await compilePrompt({
      source: "codex",
      rawText: "why is this duplicated?",
      options: { includeTrace: true },
    });

    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    const records = store.listCompilations(10).filter((record) => record.rawText === "why is this duplicated?");
    expect(records).toHaveLength(1);
    expect(second.metadata.compileId).toBe(first.metadata.compileId);
    expect(records[0]?.metadata.duplicateCount).toBe(2);
    expect(records[0]?.metadata.lastDuplicateAt).toBeDefined();
    expect(second.trace?.steps.map((step) => step.name)).toContain("dedupeCompilation");
    store.close();

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_INTELLIGENCE_ENABLED;
  });

  it("loads a bounded classifier history window before classification", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-classifier-history-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), [
      "intelligence:",
      "  historyWindow:",
      "    enabled: true",
      "    turns: 1",
      "    includeSkipped: true",
      "tools:",
      "  enabled:",
      "    - progress-assessment",
    ].join("\n"));
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    process.env.PCR_INTELLIGENCE_ENABLED = "0";

    await compilePrompt({
      source: "codex",
      rawText: "what is 2 + 2?",
    });
    const output = await compilePrompt({
      source: "codex",
      rawText: "help me figure out where I stand this week",
      options: { includeTrace: true },
    });

    const historyStep = output.trace?.steps.find((step) => step.name === "loadClassifierHistory");
    expect(historyStep?.details?.turns).toBe(1);

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_INTELLIGENCE_ENABLED;
  });

  it("compiles grammar prompt from the grammar keyword", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-grammar-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled:\n    - grammar\n");
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "cli",
      rawText: "grammar fix: this are bad sentence",
    });

    expect(output.metadata.skipped).toBe(false);
    expect(output.metadata.selectedToolId).toBe("grammar");
    expect(output.promptIr.intent).toBe("grammar-fix");
    expect(output.prompt).toContain("Corrected User Prompt");
    expect(output.prompt).not.toContain("grammar fix");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("planner attaches prompt-relevant docs from configured folder", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-planner-"));
    const userDir = join(tempDir, "user-pcr");
    const vault = join(tempDir, "vault");
    await mkdir(userDir, { recursive: true });
    await mkdir(vault, { recursive: true });
    await writeFile(join(vault, "launch.md"), "# Launch plan\nCoordinate dashboard rollout, reminders, and acceptance testing.\n");
    await writeFile(join(userDir, "config.yaml"), `tools:\n  enabled:\n    - planner\n  config:\n    planner:\n      docs:\n        folder: ${JSON.stringify(vault)}\n        limit: 2\n`);
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "cli",
      rawText: "plan the dashboard rollout and acceptance testing",
    });

    expect(output.metadata.selectedToolId).toBe("planner");
    expect(output.contextPack.projectContext[0]?.content).toContain("dashboard rollout");
    expect(output.prompt).toContain("Planning Documents");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("prefers planner when planner triggers compete with progress terms", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-planner-route-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled:\n    - progress-assessment\n    - planner\n");
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const explicit = await compilePrompt({
      source: "cli",
      rawText: "planner: create a concrete plan for my next actions this week",
    });
    const natural = await compilePrompt({
      source: "cli",
      rawText: "plan my next actions for prompt compiler this week",
    });

    expect(explicit.metadata.selectedToolId).toBe("planner");
    expect(natural.metadata.selectedToolId).toBe("planner");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("selects weekly reminder command and formats reminder descriptions for planner", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-planner-reminders-week-"));
    const command = await fakeRemindctl(tempDir);
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), `tools:\n  enabled:\n    - planner\n  config:\n    planner:\n      reminders:\n        enabled: true\n        command: ${JSON.stringify(command)}\n`);
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "cli",
      rawText: "let's plan this week",
    });

    const query = output.contextPack.schedule.find((block) => block.id === "planner-reminder-query");
    const reminders = output.contextPack.schedule.find((block) => block.id === "planner-reminders");
    expect(output.metadata.selectedToolId).toBe("planner");
    expect(query?.metadata?.command).toBe(`${command} show week --json`);
    expect(reminders?.content).toContain("Prompt Compiler review");
    expect(reminders?.content).toContain("Description: Review planner routing and dashboard history.");
    expect(output.prompt).toContain("Current Goals");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("selects next-month reminder horizon and filters reminders locally", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-planner-reminders-month-"));
    const command = await fakeRemindctl(tempDir);
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), `tools:\n  enabled:\n    - planner\n  config:\n    planner:\n      reminders:\n        enabled: true\n        command: ${JSON.stringify(command)}\n`);
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");
    process.env.PCR_NOW = "2026-05-21T12:00:00Z";

    const output = await compilePrompt({
      source: "cli",
      rawText: "Let's plan next month, so that I could launch both essencekit and prompt compiler.",
    });

    const query = output.contextPack.schedule.find((block) => block.id === "planner-reminder-query");
    const reminders = output.contextPack.schedule.find((block) => block.id === "planner-reminders");
    expect(output.metadata.selectedToolId).toBe("planner");
    expect(query?.metadata?.command).toBe(`${command} show upcoming --json`);
    expect(query?.content).toContain("next month's reminders (2026-06-01 to 2026-07-01)");
    expect(query?.content).toContain("Local date range: 2026-06-01 to 2026-07-01");
    expect(reminders?.content).toContain("Payment CanarySpace");
    expect(reminders?.content).not.toContain("Prompt Compiler review");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
    delete process.env.PCR_NOW;
  });

  it("filters reminders by specific reminder name or topic", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-planner-reminders-filter-"));
    const command = await fakeRemindctl(tempDir);
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(userDir, "config.yaml"), `tools:\n  enabled:\n    - planner\n  config:\n    planner:\n      reminders:\n        enabled: true\n        command: ${JSON.stringify(command)}\n`);
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "cli",
      rawText: "plan reminders about CanarySpace",
    });

    const query = output.contextPack.schedule.find((block) => block.id === "planner-reminder-query");
    const reminders = output.contextPack.schedule.find((block) => block.id === "planner-reminders");
    expect(query?.metadata?.command).toBe(`${command} show upcoming --json`);
    expect(query?.content).toContain("Local filter: CanarySpace");
    expect(reminders?.content).toContain("Payment CanarySpace");
    expect(reminders?.content).toContain("Description: Renew hosting payment and verify receipt.");
    expect(reminders?.content).not.toContain("Unrelated grocery task");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });

  it("coding attaches configured docs when docs are relevant", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pcr-coding-"));
    const userDir = join(tempDir, "user-pcr");
    await mkdir(userDir, { recursive: true });
    await writeFile(join(tempDir, "README.md"), "# Project\nUse the existing compiler pipeline before editing.\n");
    await writeFile(join(userDir, "config.yaml"), `tools:\n  enabled:\n    - coding\n  config:\n    coding:\n      docs:\n        files:\n          - README.md\n`);
    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_DB_PATH = join(tempDir, "pcr.sqlite");

    const output = await compilePrompt({
      source: "cli",
      cwd: tempDir,
      rawText: "implement a docs-aware coding change",
    });

    expect(output.metadata.selectedToolId).toBe("coding");
    expect(output.contextPack.projectContext[0]?.content).toContain("compiler pipeline");
    expect(output.prompt).toContain("Project Context");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });
});
