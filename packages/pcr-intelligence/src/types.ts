import type { ContextBlockKind, IntelligenceOptions, PromptMode } from "@pcr/shared";

export type PcrAdapterKind =
  | "skip"
  | "grammar_fix"
  | "direct_answer"
  | "contextual_prompt_compile"
  | "coding_prompt_compile"
  | "research_prompt_compile"
  | "planning_prompt_compile"
  | "reply_prompt_compile"
  | "generic_prompt_compile";

export interface IntentClassification {
  mode: PromptMode;
  intent: string;
  confidence: number;
  taskRewrite: string;
  contextQueries: string[];
  contextNeeds: ContextBlockKind[];
  adapter: PcrAdapterKind;
  complexity: "simple" | "medium" | "complex";
  shouldAskClarifyingQuestion: boolean;
  clarifyingQuestions: string[];
  constraints: string[];
  warnings: string[];
  provider: "deterministic" | "openai" | "local" | "none";
  usedLlm: boolean;
}

export interface ClassifierHistoryTurn {
  role: "user";
  text: string;
  createdAt?: string;
  source?: string;
  mode?: PromptMode;
  intent?: string;
  selectedToolId?: string;
  skipped?: boolean;
}

export interface ClassifyIntentInput {
  rawText: string;
  explicitMode?: PromptMode;
  contextHints?: string[];
  profileId?: string;
  history?: ClassifierHistoryTurn[];
  enabledTools?: Array<{
    id: string;
    name: string;
    description: string;
    modes: PromptMode[];
    intents: string[];
    triggers: string[];
    contextKinds: ContextBlockKind[];
  }>;
  options?: IntelligenceOptions;
}

export interface IntelligenceProvider {
  name: "deterministic" | "openai" | "local" | "none";
  classifyIntent(input: ClassifyIntentInput): Promise<IntentClassification>;
}
