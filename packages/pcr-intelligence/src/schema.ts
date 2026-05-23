import { z } from "zod";

export const AdapterKindSchema = z.enum([
  "skip",
  "grammar_fix",
  "direct_answer",
  "contextual_prompt_compile",
  "coding_prompt_compile",
  "research_prompt_compile",
  "planning_prompt_compile",
  "reply_prompt_compile",
  "generic_prompt_compile",
]);

export const IntentClassificationSchema = z.object({
  mode: z.enum(["coding", "writing", "research", "analysis", "reply", "generic"]),
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  taskRewrite: z.string().min(1),
  contextQueries: z.array(z.string()),
  contextNeeds: z.array(z.enum([
    "selection",
    "file",
    "repo",
    "clipboard",
    "memory",
    "manual",
    "diff",
    "error",
    "goal",
    "schedule",
    "preference",
    "history",
  ])),
  adapter: AdapterKindSchema,
  complexity: z.enum(["simple", "medium", "complex"]),
  shouldAskClarifyingQuestion: z.boolean(),
  clarifyingQuestions: z.array(z.string()),
  constraints: z.array(z.string()),
  warnings: z.array(z.string()),
  provider: z.enum(["deterministic", "openai", "local", "none"]),
  usedLlm: z.boolean(),
});

export const OpenAiIntentClassificationSchema = IntentClassificationSchema.omit({
  provider: true,
  usedLlm: true,
}).strict();

export const GrammarRewriteSchema = z.object({
  correctedPrompt: z.string().min(1),
});

export const OPENAI_GRAMMAR_REWRITE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["correctedPrompt"],
  properties: {
    correctedPrompt: { type: "string" },
  },
} as const;

export const OPENAI_INTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "intent",
    "confidence",
    "taskRewrite",
    "contextQueries",
    "contextNeeds",
    "adapter",
    "complexity",
    "shouldAskClarifyingQuestion",
    "clarifyingQuestions",
    "constraints",
    "warnings",
  ],
  properties: {
    mode: {
      type: "string",
      enum: ["coding", "writing", "research", "analysis", "reply", "generic"],
    },
    intent: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    taskRewrite: { type: "string" },
    contextQueries: { type: "array", items: { type: "string" } },
    contextNeeds: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "selection",
          "file",
          "repo",
          "clipboard",
          "memory",
          "manual",
          "diff",
          "error",
          "goal",
          "schedule",
          "preference",
          "history",
        ],
      },
    },
    adapter: {
      type: "string",
      enum: [
        "grammar_fix",
        "direct_answer",
        "contextual_prompt_compile",
        "coding_prompt_compile",
        "research_prompt_compile",
        "planning_prompt_compile",
        "reply_prompt_compile",
          "generic_prompt_compile",
          "skip",
        ],
      },
    complexity: { type: "string", enum: ["simple", "medium", "complex"] },
    shouldAskClarifyingQuestion: { type: "boolean" },
    clarifyingQuestions: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;
