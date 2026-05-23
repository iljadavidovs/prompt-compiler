import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { truncateToTokenBudget, type ContextBlock, type PcrTool } from "@pcr/shared";

function configDocs(config: Record<string, unknown>): string[] {
  const docs = typeof config.docs === "object" && config.docs ? config.docs as Record<string, unknown> : {};
  const files = docs.files;
  return Array.isArray(files) ? files.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function wantsDocs(text: string, autoAttachDocs: unknown): boolean {
  if (autoAttachDocs === true) {
    return true;
  }
  return /\b(doc|docs|documentation|readme|architecture|api|usage|setup|config|configuration|convention|pattern)\b/i.test(text);
}

async function loadDoc(cwd: string, file: string): Promise<ContextBlock> {
  const resolved = resolve(cwd, file);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isFile()) {
    return {
      id: `coding-doc-missing-${resolved}`,
      label: `Missing coding doc: ${file}`,
      kind: "file",
      content: `Configured coding doc does not exist: ${resolved}`,
      metadata: { role: "codingWarning", path: resolved },
    };
  }
  return {
    id: `coding-doc-${resolved}`,
    label: `Coding doc: ${basename(file)}`,
    kind: "file",
    content: truncateToTokenBudget(await readFile(resolved, "utf8"), 900),
    metadata: { role: "codingDoc", path: resolved },
  };
}

export const codingTemplateMarkdown = `---
id: coding.context
name: Coding Context Prompt
mode: coding
description: Compiles coding prompts with configured project documentation.
outputFormat: markdown
---

# Task

{{task}}

# Project Context

{{projectContext}}

# Manual Context

{{manualContext}}

# Instructions

Work from the local project context and preserve existing architecture.
If documentation is attached, use it to follow project conventions.
Identify files that need inspection before editing.
Call out tests or verification commands that should be run.
Avoid broad refactors unless they are necessary for the requested change.
`;

export const codingTool: PcrTool = {
  metadata: {
    id: "coding",
    packageName: "@pcr/tool-coding",
    name: "Coding",
    description: "Compose coding prompts with project-configured documentation context.",
    modes: ["coding"],
    intents: ["coding-task"],
    triggers: ["code", "coding", "bug", "debug", "fix", "test", "refactor", "implement", "typescript", "docs"],
    contextKinds: ["file", "repo", "diff", "error"],
    defaultEnabled: true,
    activation: "project",
  },
  profile: {
    id: "coding",
    name: "Coding",
    tone: "direct",
    verbosity: "medium",
    strictness: "high",
    defaults: {
      askClarifyingQuestions: false,
      allowWeb: false,
      requireCitations: false,
      requirePlan: false,
      requireTests: true,
    },
    rules: [
      "Follow existing project patterns.",
      "Keep changes scoped to the request.",
      "Verify with relevant tests when practical.",
    ],
  },
  template: {
    id: "coding.context",
    name: "Coding Context Prompt",
    mode: "coding",
    description: "Compiles coding prompts with configured project documentation.",
    outputFormat: "markdown",
    body: codingTemplateMarkdown.replace(/^---[\s\S]*?---\n/, "").trim(),
  },
  async prepareContext(input) {
    if (!wantsDocs(`${input.rawText} ${input.task}`, input.toolConfig.autoAttachDocs)) {
      return [];
    }
    return Promise.all(configDocs(input.toolConfig).map((file) => loadDoc(input.cwd, file)));
  },
};

export const pcrTool = codingTool;
