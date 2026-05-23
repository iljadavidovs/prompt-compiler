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

function classifyExplicitBlocks(blocks: ContextBlock[]) {
  return {
    goals: blocks.filter((block) => block.kind === "goal"),
    schedule: blocks.filter((block) => block.kind === "schedule"),
    preferences: blocks.filter((block) => block.kind === "preference"),
    recurringComments: blocks.filter((block) => block.kind === "history" && block.label.toLowerCase().includes("recurring")),
    positiveExamples: blocks.filter((block) => block.kind === "history" && /positive|like|success/i.test(block.label)),
    negativeExamples: blocks.filter((block) => block.kind === "history" && /negative|dislike|fail|avoid/i.test(block.label)),
    projectContext: blocks.filter((block) => ["file", "repo", "memory"].includes(block.kind)),
    manualContext: blocks.filter((block) => ["manual", "selection", "clipboard", "diff", "error"].includes(block.kind)),
  };
}

export function buildContextPackFromBlocks(blocks: ContextBlock[], options?: CompileOptions): ContextPack {
  const budget = maxContextTokens(options);
  const accepted: ContextBlock[] = [];
  let runningTokens = 0;

  for (const block of blocks) {
    const nextTokens = blockTokenEstimate(block);
    if (runningTokens + nextTokens > budget) {
      continue;
    }
    accepted.push(block);
    runningTokens += nextTokens;
  }

  const grouped = classifyExplicitBlocks(accepted);
  const summaryParts = [
    grouped.goals.length ? `${grouped.goals.length} goal block(s)` : "",
    grouped.schedule.length ? `${grouped.schedule.length} schedule block(s)` : "",
    grouped.preferences.length ? `${grouped.preferences.length} preference block(s)` : "",
    grouped.positiveExamples.length ? `${grouped.positiveExamples.length} positive history example(s)` : "",
    grouped.negativeExamples.length ? `${grouped.negativeExamples.length} negative history example(s)` : "",
  ].filter(Boolean);

  return {
    ...grouped,
    summary: summaryParts.length
      ? `Context pack includes ${summaryParts.join(", ")}.`
      : "No local context was available; rely only on the user request and explicit constraints.",
    tokenEstimate: runningTokens,
  };
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

