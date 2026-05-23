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
  return renderTemplate(template, {
    task: promptIr.task,
    contextSummary: promptIr.contextSummary,
    goals: formatBlocks(contextPack.goals),
    schedule: formatBlocks(contextPack.schedule),
    preferences: formatBlocks([...contextPack.preferences, ...contextPack.recurringComments]),
    projectContext: formatBlocks(contextPack.projectContext),
    manualContext: formatBlocks(contextPack.manualContext),
    positivePatterns: toArrayText(promptIr.positivePatterns),
    negativePatterns: toArrayText(promptIr.negativePatterns),
  });
}
