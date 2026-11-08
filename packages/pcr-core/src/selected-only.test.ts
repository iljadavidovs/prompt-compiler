import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPcrStore } from "@pcr/store";
import { rewriteGrammarPrompt } from "@pcr/intelligence";
import { compilePrompt, listAvailableTools } from "./index.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pcr-selected-"));
  const user = join(root, "user"); const a = join(root, "a"); const b = join(root, "b");
  for (const dir of [user, join(a, ".pcr"), join(b, ".pcr")]) await mkdir(dir, { recursive: true });
  vi.stubEnv("PCR_USER_DIR", user); vi.stubEnv("PCR_DB_PATH", join(root, "pcr.sqlite"));
  await writeFile(join(user, "config.yaml"), 'tools:\n  enabled: [coding, planner, grammar, progress-assessment]\n  config:\n    planner:\n      reminders:\n        enabled: true\n        command: unapproved-synthetic-command\nintelligence:\n  enabled: true\n  provider: openai\n  apiKey: synthetic-key\n  baseUrl: https://never-contact.invalid\n');
  await writeFile(join(a, ".pcr", "goals.md"), '# Goals\nPROJECT_A_SENTINEL progress goals schedule\n');
  await writeFile(join(b, ".pcr", "config.yaml"), 'tools:\n  enabled: []\nintelligence:\n  enabled: true\n  provider: openai\n');
  return { root, user, a, b };
}
const options = { contextMode: "selected-only" as const, includeTrace: true };

describe("selected-only compiler policy", () => {
  it("retains exact raw-request whitespace in matched and skipped history", async () => {
    const f = await fixture();
    for (const rawText of ["\n  implement a code review\n\t", " \n hello there \n "]) {
      const output = await compilePrompt({ source: "browser", cwd: f.b, rawText, options });
      const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
      try { expect(store.getCompilation(output.metadata.compileId)?.rawText).toBe(rawText); }
      finally { store.close(); }
    }
  });
  it("excludes indexed project A, classifier history, feedback and B config in a shared database", async () => {
    const f = await fixture();
    const initial = await compilePrompt({ source: "cli", cwd: f.a, rawText: "assess progress against goals schedule", options: { deterministic: true } });
    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    store.addFeedback({ compileId: initial.metadata.compileId, rating: "like", comment: "FEEDBACK_SENTINEL keep history" }); store.close();
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network denied in test"));
    const output = await compilePrompt({ source: "browser", cwd: f.b, rawText: "implement a code review", contextBlocks: [{ id: "selected", label: "Selected", kind: "manual", content: "ONLY_SELECTED_SOURCE" }], options });
    expect(output.prompt).toContain("ONLY_SELECTED_SOURCE");
    expect(JSON.stringify(output)).not.toContain("PROJECT_A_SENTINEL");
    expect(JSON.stringify(output)).not.toContain("FEEDBACK_SENTINEL");
    expect(output.metadata.effectivePolicy).toMatchObject({ contextMode: "selected-only", network: "denied", commands: "denied", classifierHistory: false });
    expect(output.trace?.steps.find(step => step.name === "loadClassifierHistory")?.details?.turns).toBe(0);
    expect(network).not.toHaveBeenCalled();
    expect(output.metadata.skipped).toBe(false); // project B's tools.enabled=[] was deliberately ignored
  });
  it.each(["plan this week", "implement the code", "grammar fix: we is ready", "assess progress"])("runs %s without any tool context loader or provider", async rawText => {
    const f = await fixture();
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network denied"));
    const loaders = listAvailableTools().filter(tool => tool.prepareContext).map(tool => vi.spyOn(tool, "prepareContext"));
    const output = await compilePrompt({ source: "browser", cwd: f.b, rawText, options });
    expect(output.metadata.skipped).toBe(false);
    if (rawText.startsWith("grammar")) { expect(output.prompt).toContain("No grammar correction was performed"); expect(output.prompt).not.toContain("# Corrected User Prompt"); }
    expect(network).not.toHaveBeenCalled(); loaders.forEach(loader => expect(loader).not.toHaveBeenCalled());
  });
  it("enforces deterministic and explicit no-provider precedence on classification and grammar", async () => {
    const f = await fixture(); const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network denied"));
    for (const intelligence of [{ enabled: true, provider: "openai" as const }, { enabled: true, provider: "none" as const }, { enabled: false, provider: "openai" as const }]) {
      await compilePrompt({ source: "cli", cwd: f.user, rawText: "grammar fix: we is ready", options: { deterministic: true, intelligence } });
    }
    await rewriteGrammarPrompt({ rawText: "grammar fix: we is ready", options: { enabled: true, provider: "none" } });
    expect(network).not.toHaveBeenCalled();
  });
  it("preserves ordered explicit contents, roles, omission reasons and immutable original history", async () => {
    const f = await fixture();
    const input = { source: "browser" as const, cwd: f.b, rawText: "implement a code review", options: { ...options, maxContextTokens: 256 }, contextBlocks: [{ id: "b", label: "B", kind: "manual" as const, content: "SECOND_REF", metadata: { bindingRole: "criteria" } }, { id: "a", label: "A", kind: "manual" as const, content: "FIRST_REF", metadata: { bindingRole: "requirement" } }, { id: "long", label: "Long", kind: "manual" as const, content: "x".repeat(2000) }] };
    const output = await compilePrompt(input);
    expect(output.prompt.indexOf("SECOND_REF")).toBeLessThan(output.prompt.indexOf("FIRST_REF"));
    expect(output.prompt).toContain("[criteria]"); expect(output.prompt).toContain("[requirement]");
    expect(output.metadata.warnings.join(" ")).toContain("1 selected source(s) omitted");
    expect(output.metadata.effectivePolicy?.maxContextTokens).toBe(256);
    expect(output.metadata.sources?.[2]).toEqual({ id: "long", included: false, reason: "Context budget exceeded" });
    input.rawText = "edited draft"; input.contextBlocks[0].content = "changed";
    const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
    expect(store.getCompilation(output.metadata.compileId)?.rawText).toBe("implement a code review");
    expect(store.getCompilation(output.metadata.compileId)?.prompt).toContain("SECOND_REF"); store.close();
  });
  it("redacts nested matched and skipped history, returned structures and feedback", async () => {
    const f = await fixture(); const sentinel = "sk-syntheticCredentialSentinel123456789";
    for (const rawText of [`implement ${sentinel}`, `hello ${sentinel}`]) {
      const output = await compilePrompt({ source: "browser", cwd: f.b, rawText, options, contextBlocks: [{ id: "x", label: sentinel, kind: "manual", content: `api_key=${sentinel}`, metadata: { password: sentinel } }] });
      expect(JSON.stringify(output)).not.toContain(sentinel);
      const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
      store.addFeedback({ compileId: output.metadata.compileId, rating: "neutral", outcome: `password=${sentinel}`, comment: `token=${sentinel}` });
      expect(JSON.stringify(store.getCompilation(output.metadata.compileId))).not.toContain(sentinel);
      expect(JSON.stringify(store.listFeedback())).not.toContain(sentinel); store.close();
    }
    expect((await readFile(process.env.PCR_DB_PATH!)).includes(Buffer.from(sentinel))).toBe(false);
  });
});
