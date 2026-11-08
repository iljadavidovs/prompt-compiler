import type { PcrTool, PcrTemplate } from "@pcr/shared";

export const grammarTemplateMarkdown = `---
id: writing.grammar-fix
name: Grammar Fix Prompt
mode: writing
description: Compiles a precise grammar-edit prompt.
outputFormat: markdown
---

# Corrected User Prompt (Higher Priority)

{{task}}

# Instructions

Treat the corrected user prompt above as the effective user request.
Answer it directly.
Ignore the original grammar-fix wrapper in the user's message.
Do not output grammar notes or an editing summary unless the corrected prompt asks for that.
`;

export const grammarTool: PcrTool = {
  metadata: {
    id: "grammar",
    packageName: "@pcr/tool-grammar",
    name: "Grammar",
    description: "Compile focused grammar-fix prompts when the user uses the configured grammar keyword.",
    modes: ["writing"],
    intents: ["grammar-fix"],
    triggers: ["grammar fix"],
    contextKinds: ["manual", "selection", "clipboard"],
    defaultEnabled: true,
    activation: "keyword",
    inputPolicy: {
      includeOriginalRequest: false,
      hookInstruction: "The compiled prompt contains a corrected user prompt. Treat it as the effective user request and answer it directly. Ignore the original grammar-fix wrapper in the user's message.",
    },
  },
  profile: {
    id: "grammar-editor",
    name: "Grammar Editor",
    tone: "direct",
    verbosity: "short",
    strictness: "high",
    defaults: {
      askClarifyingQuestions: false,
      allowWeb: false,
      requireCitations: false,
      requirePlan: false,
      requireTests: false,
    },
    rules: [
      "Preserve the user's meaning.",
      "Keep edits minimal unless asked otherwise.",
      "Do not add unsupported claims.",
    ],
  },
  template: {
    id: "writing.grammar-fix",
    name: "Grammar Fix Prompt",
    mode: "writing",
    description: "Compiles a precise grammar-edit prompt.",
    outputFormat: "markdown",
    body: grammarTemplateMarkdown.replace(/^---[\s\S]*?---\n/, "").trim(),
  },
};

export const pcrTool = grammarTool;

/** Provider-free authoring must not label unchanged text as a completed correction. */
export const offlineGrammarTemplate: PcrTemplate = {
  ...grammarTool.template,
  id: "writing.grammar-fix.local",
  name: "Grammar handoff (local)",
  body: `# User Prompt (trigger removed)

{{task}}

# Compiler Note

No grammar correction was performed. PCR removed the trigger and preserved the source text.

# Instructions

Treat the user prompt above as the effective request. Answer it directly.
Do not assume that the compiler corrected grammar or verified the wording.`,
};
