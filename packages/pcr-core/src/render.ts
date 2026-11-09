import type { ContextBlock, ContextPack, PromptIR, PcrTemplate } from "@pcr/shared";
import { toArrayText } from "@pcr/shared";
import { renderTemplate } from "./template.js";

function formatBlocks(blocks: ContextBlock[], fallback = "- None found."): string {
  if (blocks.length === 0) {
    return fallback;
  }

  return blocks
    .map((block) => {
      const content = block.content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => (line.startsWith("-") ? line : `- ${line}`))
        .join("\n");
      return `## ${block.label}\n${content}`;
    })
    .join("\n\n");
}

export function renderPrompt(template: PcrTemplate, promptIr: PromptIR, contextPack: ContextPack): string {
  const selectedOnly = promptIr.metadata.contextMode === "selected-only";
  const selectedPlaceholder = "See selected context below.";
  const rendered = renderTemplate(template, {
    task: promptIr.task,
    contextSummary: promptIr.contextSummary,
    goals: selectedOnly ? selectedPlaceholder : formatBlocks(contextPack.goals),
    schedule: selectedOnly ? selectedPlaceholder : formatBlocks(contextPack.schedule),
    preferences: selectedOnly ? selectedPlaceholder : formatBlocks([...contextPack.preferences, ...contextPack.recurringComments]),
    projectContext: selectedOnly ? selectedPlaceholder : formatBlocks(contextPack.projectContext),
    manualContext: selectedOnly ? selectedPlaceholder : formatBlocks(contextPack.manualContext),
    positivePatterns: toArrayText(promptIr.positivePatterns),
    negativePatterns: toArrayText(promptIr.negativePatterns),
  });
  if (!selectedOnly) return rendered;
  // One ordered representation preserves exact source content across all built-in templates.
  const sources = promptIr.contextItems.map((block, index) => {
    const source = block.metadata?.source as { artifactId?: string; revision?: number; contentHash?: string } | undefined;
    return `## ${index + 1}. ${block.label} [${String(block.metadata?.bindingRole ?? "background")}]\nSource: ${source?.artifactId ?? block.id} @ ${source?.revision ?? "explicit"} | SHA-256: ${source?.contentHash ?? "not supplied"}\n\n${block.content}`;
  });
  return `${rendered}\n\n# Selected context (in binding order)\n\n${sources.join("\n\n") || "No context sources contributed to this compilation."}`;
}
