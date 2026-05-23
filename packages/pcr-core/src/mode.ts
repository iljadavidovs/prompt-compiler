import type { PromptMode } from "@pcr/shared";

const MODE_KEYWORDS: Array<{ mode: PromptMode; keywords: string[] }> = [
  { mode: "coding", keywords: ["code", "bug", "test", "refactor", "implement", "typescript", "diff"] },
  { mode: "research", keywords: ["research", "assessment", "assess", "progress", "goals", "schedule", "investigate"] },
  { mode: "analysis", keywords: ["analyze", "analysis", "evaluate", "compare", "tradeoff"] },
  { mode: "writing", keywords: ["write", "draft", "edit", "document", "article"] },
  { mode: "reply", keywords: ["reply", "respond", "email", "message"] },
];

export function resolveMode(rawText: string, explicitMode?: PromptMode): PromptMode {
  if (explicitMode) {
    return explicitMode;
  }

  const lowered = rawText.toLowerCase();
  let best: { mode: PromptMode; score: number } = { mode: "generic", score: 0 };
  for (const candidate of MODE_KEYWORDS) {
    const score = candidate.keywords.reduce((sum, keyword) => sum + (lowered.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) {
      best = { mode: candidate.mode, score };
    }
  }

  return best.mode;
}

export function resolveIntent(rawText: string, mode: PromptMode): string {
  const lowered = rawText.toLowerCase();
  if (mode === "research" && /progress|goal|schedule|assessment|assess/.test(lowered)) {
    return "progress-assessment";
  }
  if (mode === "coding") {
    return "coding-task";
  }
  if (mode === "analysis") {
    return "analysis";
  }
  return `${mode}-prompt`;
}

export function normalizeTask(rawText: string, intent: string): string {
  const cleaned = rawText.replace(/^\s*\$pcr\s+/i, "").trim();
  if (intent === "progress-assessment") {
    return [
      "Compile a research prompt for assessing progress against current goals, nearest schedule commitments, constraints, and recent execution quality.",
      "",
      `Original request: ${cleaned}`,
    ].join("\n");
  }
  return cleaned;
}

