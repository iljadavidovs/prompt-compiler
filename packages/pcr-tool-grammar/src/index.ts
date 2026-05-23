import type { PcrTool } from "@pcr/shared";

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
