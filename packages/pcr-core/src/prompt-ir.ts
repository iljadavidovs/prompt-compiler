import type {
  CompilePromptInput,
  ContextBlock,
  ContextPack,
  PcrProfile,
  PcrTemplate,
  PromptExecution,
  PromptIR,
  PromptMode,
} from "@pcr/shared";
import { flattenContextPack } from "./context-pack.js";

const DEFAULT_EXECUTION: PromptExecution = {
  askClarifyingQuestions: false,
  allowWeb: false,
  requireCitations: false,
  requireTests: false,
  requirePlan: false,
};

function blockLines(blocks: ContextBlock[]): string[] {
  return blocks
    .flatMap((block) => block.content.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ""));
}

export function buildPromptIr(args: {
  input: CompilePromptInput;
  intent: string;
  mode: PromptMode;
  task: string;
  template: PcrTemplate;
  profile: PcrProfile;
  contextPack: ContextPack;
}): PromptIR {
  const profileExecution = { ...DEFAULT_EXECUTION, ...args.profile.defaults };
  const positivePatterns = [
    ...args.profile.rules,
    ...blockLines(args.contextPack.positiveExamples),
  ];
  const negativePatterns = blockLines(args.contextPack.negativeExamples);
  const contextItems = flattenContextPack(args.contextPack);

  return {
    intent: args.intent,
    mode: args.mode,
    task: args.task,
    assumptions: [
      "Local files may be incomplete or stale.",
      "The compiled prompt should preserve the user's stated intent.",
    ],
    constraints: args.profile.rules,
    contextSummary: args.contextPack.summary,
    contextItems,
    positivePatterns,
    negativePatterns,
    outputFormat: {
      type: args.template.outputFormat,
    },
    style: {
      tone: args.profile.tone,
      verbosity: args.profile.verbosity,
      strictness: args.profile.strictness,
    },
    execution: profileExecution,
    metadata: {
      templateId: args.template.id,
      profileId: args.profile.id,
      source: args.input.source,
    },
  };
}

