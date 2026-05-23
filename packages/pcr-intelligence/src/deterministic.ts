import type { ContextBlockKind, PromptMode } from "@pcr/shared";
import type { ClassifyIntentInput, IntentClassification, PcrAdapterKind } from "./types.js";

const MODE_KEYWORDS: Array<{ mode: PromptMode; keywords: string[] }> = [
  { mode: "coding", keywords: ["code", "bug", "test", "refactor", "implement", "typescript", "diff", "build"] },
  { mode: "research", keywords: ["research", "assessment", "assess", "progress", "goals", "schedule", "investigate", "figure out"] },
  { mode: "analysis", keywords: ["analyze", "analysis", "evaluate", "compare", "tradeoff", "why", "plan", "planning", "prioritize", "roadmap"] },
  { mode: "writing", keywords: ["write", "draft", "edit", "document", "article", "grammar"] },
  { mode: "reply", keywords: ["reply", "respond", "email", "message"] },
];

function resolveMode(rawText: string, explicitMode?: PromptMode): { mode: PromptMode; score: number } {
  if (explicitMode) {
    return { mode: explicitMode, score: 1 };
  }

  const lowered = rawText.toLowerCase();
  let best: { mode: PromptMode; score: number } = { mode: "generic", score: 0 };
  for (const candidate of MODE_KEYWORDS) {
    const score = candidate.keywords.reduce((sum, keyword) => sum + (lowered.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) {
      best = { mode: candidate.mode, score };
    }
  }
  return best;
}

function inputToolMatch(rawText: string, enabledTools?: ClassifyIntentInput["enabledTools"]): { mode: PromptMode; intent: string } | null {
  if (!enabledTools) {
    return null;
  }
  const lowered = rawText.toLowerCase();
  const tool = enabledTools.find((candidate) => candidate.triggers.some((trigger) => lowered.includes(trigger.toLowerCase())));
  if (!tool) {
    return null;
  }
  return {
    mode: tool.modes[0] ?? "generic",
    intent: tool.intents[0] ?? "generic-prompt",
  };
}

function contextNeedsFor(rawText: string, mode: PromptMode): ContextBlockKind[] {
  const lowered = rawText.toLowerCase();
  const needs = new Set<ContextBlockKind>();

  if (/goal|progress|stand|priority|objective/.test(lowered) || mode === "research") {
    needs.add("goal");
    needs.add("preference");
  }
  if (/schedule|week|today|tomorrow|friday|weekend|deadline|calendar/.test(lowered) || mode === "research") {
    needs.add("schedule");
  }
  if (/history|previous|feedback|pattern|again/.test(lowered) || mode === "research") {
    needs.add("history");
  }
  if (mode === "coding") {
    needs.add("repo");
    needs.add("file");
    needs.add("diff");
    needs.add("error");
  }
  if (needs.size === 0) {
    needs.add("manual");
  }
  return [...needs];
}

function intentFor(rawText: string, mode: PromptMode): string {
  const lowered = rawText.toLowerCase();
  if (mode === "research" && /progress|goal|schedule|assessment|assess|stand this week/.test(lowered)) {
    return "progress-assessment";
  }
  if (mode === "writing" && /grammar|fix|polish/.test(lowered)) {
    return "grammar-fix";
  }
  if ((mode === "analysis" || mode === "research") && /plan|planning|prioritize|roadmap|next action/.test(lowered)) {
    return "planning";
  }
  if (mode === "coding") {
    return "coding-task";
  }
  return `${mode}-prompt`;
}

function adapterFor(mode: PromptMode, intent: string): PcrAdapterKind {
  if (intent === "grammar-fix") {
    return "grammar_fix";
  }
  if (intent === "progress-assessment") {
    return "research_prompt_compile";
  }
  if (intent === "planning") {
    return "planning_prompt_compile";
  }
  if (mode === "coding") {
    return "coding_prompt_compile";
  }
  if (mode === "reply") {
    return "reply_prompt_compile";
  }
  if (mode === "research") {
    return "research_prompt_compile";
  }
  if (mode === "analysis") {
    return "contextual_prompt_compile";
  }
  return "generic_prompt_compile";
}

function skipClassification(rawText: string, reason: string): IntentClassification {
  return {
    mode: "generic",
    intent: "skip",
    confidence: 1,
    taskRewrite: rawText.replace(/^\s*\$pcr\s+/i, "").trim(),
    contextQueries: [],
    contextNeeds: [],
    adapter: "skip",
    complexity: "simple",
    shouldAskClarifyingQuestion: false,
    clarifyingQuestions: [],
    constraints: [],
    warnings: [reason],
    provider: "deterministic",
    usedLlm: false,
  };
}

function isPcrDiagnosticQuestion(rawText: string): boolean {
  const lowered = rawText.toLowerCase();
  const hasDiagnosticExcerpt = [
    "pcr metadata:",
    "compiled prompt:",
    "generated prompt",
    "context pack",
    "prompt ir",
    "selectedtoolid",
    "compileid",
    "## reminder query",
    "reminder query",
    "no narrower planning horizon",
  ].some((marker) => lowered.includes(marker));
  if (!hasDiagnosticExcerpt) {
    return false;
  }

  const asksAboutBehavior = /\b(why|what|how|explain|describe|return|returned|output|behavior|worked)\b/.test(lowered);
  const asksForImplementation = /\b(implement|build|add|create|fix|change|patch|refactor|test)\b/.test(lowered);
  return asksAboutBehavior && !asksForImplementation;
}

function rewriteTask(rawText: string, intent: string): string {
  const cleaned = rawText.replace(/^\s*\$pcr\s+/i, "").trim();
  if (intent === "progress-assessment") {
    return "Assess current progress against goals, near schedule, constraints, risks, and execution quality.";
  }
  if (intent === "grammar-fix") {
    return "Improve grammar and clarity while preserving the original meaning.";
  }
  if (intent === "planning") {
    return "Create a concrete plan using relevant schedule, reminders, project notes, constraints, and next actions.";
  }
  return cleaned;
}

export function deterministicClassifyIntent(input: ClassifyIntentInput): IntentClassification {
  if (isPcrDiagnosticQuestion(input.rawText)) {
    return skipClassification(input.rawText, "Skipped PCR because the prompt is asking about PCR diagnostic output.");
  }

  if (input.enabledTools?.length === 0) {
    return {
      ...skipClassification(input.rawText, "No PCR tools are enabled."),
      mode: input.explicitMode ?? "generic",
    };
  }

  const toolMatch = inputToolMatch(input.rawText, input.enabledTools);
  const resolved = toolMatch
    ? { mode: input.explicitMode ?? toolMatch.mode, score: 2 }
    : resolveMode(input.rawText, input.explicitMode);
  const intent = toolMatch?.intent ?? intentFor(input.rawText, resolved.mode);
  const needs = contextNeedsFor(input.rawText, resolved.mode);
  const confidence = input.explicitMode ? 0.8 : Math.min(0.85, 0.35 + resolved.score * 0.15);
  const taskRewrite = rewriteTask(input.rawText, intent);

  return {
    mode: resolved.mode,
    intent,
    confidence,
    taskRewrite,
    contextQueries: [
      taskRewrite,
      input.rawText,
      ...(input.history ?? []).slice(-3).map((turn) => `recent user request: ${turn.text}`),
      ...needs.map((need) => `${need} context`),
      ...(input.contextHints ?? []),
    ],
    contextNeeds: needs,
    adapter: adapterFor(resolved.mode, intent),
    complexity: resolved.score >= 3 ? "medium" : "simple",
    shouldAskClarifyingQuestion: false,
    clarifyingQuestions: [],
    constraints: [],
    warnings: resolved.score === 0 ? ["Deterministic classifier had weak signal."] : [],
    provider: "deterministic",
    usedLlm: false,
  };
}
