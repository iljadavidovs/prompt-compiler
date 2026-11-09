import {
  estimateTokens,
  maxContextTokens,
  type CompileOptions,
  type ContextBlock,
  type ContextPack,
} from "@pcr/shared";

function blockTokenEstimate(block: ContextBlock): number {
  return estimateTokens(`${block.label}\n${block.content}`);
}

export function buildContextPackFromBlocks(blocks: ContextBlock[], options?: CompileOptions): ContextPack {
  const pack: ContextPack = { goals: [], schedule: [], preferences: [], recurringComments: [], positiveExamples: [], negativeExamples: [], projectContext: [], manualContext: [], summary: "", tokenEstimate: 0 };
  let accepted = 0;
  for (const block of blocks) {
    const tokens = blockTokenEstimate(block);
    if (pack.tokenEstimate + tokens > maxContextTokens(options)) continue;
    const group = block.kind === "goal" ? pack.goals
      : block.kind === "schedule" ? pack.schedule
      : block.kind === "preference" ? pack.preferences
      : ["file", "repo", "memory"].includes(block.kind) ? pack.projectContext
      : pack.manualContext;
    group.push(block);
    pack.tokenEstimate += tokens;
    accepted++;
  }
  pack.summary = `Selected ${accepted} explicit source(s); ${pack.tokenEstimate} estimated tokens. No implicit sources, history or feedback were retrieved.`;
  return pack;
}

export function flattenContextPack(pack: ContextPack): ContextBlock[] {
  return [
    ...pack.goals,
    ...pack.schedule,
    ...pack.preferences,
    ...pack.recurringComments,
    ...pack.positiveExamples,
    ...pack.negativeExamples,
    ...pack.projectContext,
    ...pack.manualContext,
  ];
}

