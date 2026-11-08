import { z } from "zod";

export const CompileSourceSchema = z.enum([
  "cli",
  "http",
  "mcp",
  "codex",
  "claude-code",
  "browser",
  "unknown",
]);

export const PromptModeSchema = z.enum([
  "coding",
  "writing",
  "research",
  "analysis",
  "reply",
  "generic",
]);

export const ContextBlockKindSchema = z.enum([
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
]);

export const ContextBlockSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: ContextBlockKindSchema,
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const CompileOptionsSchema = z.object({
  deterministic: z.boolean().optional(),
  skip: z.boolean().optional(),
  contextMode: z.enum(["selected-only", "project"]).optional(),
  executionPolicy: z.enum(["local-only", "configured"]).optional(),
  includeTrace: z.boolean().optional(),
  maxContextTokens: z.number().int().positive().optional(),
  maxPromptTokens: z.number().int().positive().optional(),
  intelligence: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(["deterministic", "openai", "local", "none"]).optional(),
    model: z.string().optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    historyWindow: z.object({
      enabled: z.boolean().optional(),
      turns: z.number().int().positive().max(50).optional(),
      includeSkipped: z.boolean().optional(),
      providerVisible: z.boolean().optional(),
    }).optional(),
  }).optional(),
}).optional();

export const CompilePromptInputSchema = z.object({
  source: CompileSourceSchema,
  requestId: z.string().max(100).optional(),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  provenance: z.object({ schemaVersion: z.literal(1), projectId: z.string().min(1), derivedFrom: z.array(z.object({ source: z.object({ host: z.enum(["local", "quaggit-fixture"]), projectId: z.string(), artifactId: z.string(), revision: z.number().int().positive(), contentHash: z.string().regex(/^[a-f0-9]{64}$/) }), role: z.enum(["background", "requirement", "criteria", "example", "goal", "schedule", "preference"]), order: z.number().int().nonnegative() })) }).optional(),
  rawText: z.string().refine((value) => value.trim().length > 0, "Write a non-empty request."),
  mode: PromptModeSchema.optional(),
  templateId: z.string().min(1).optional(),
  profileId: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
  contextHints: z.array(z.string()).optional(),
  contextBlocks: z.array(ContextBlockSchema).optional(),
  vars: z.record(z.unknown()).optional(),
  options: CompileOptionsSchema,
});

export const PcrConfigSchema = z.object({
  tools: z.object({
    enabled: z.array(z.string()).optional(),
    config: z.record(z.record(z.unknown())).optional(),
  }).optional(),
  intelligence: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(["deterministic", "openai", "local", "none"]).optional(),
    model: z.string().optional(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    historyWindow: z.object({
      enabled: z.boolean().optional(),
      turns: z.number().int().positive().max(50).optional(),
      includeSkipped: z.boolean().optional(),
      providerVisible: z.boolean().optional(),
    }).optional(),
  }).optional(),
  defaultProfile: z.string().optional(),
  defaultTemplate: z.string().optional(),
}).passthrough();

export const FeedbackInputSchema = z.object({
  compileId: z.string().min(1),
  rating: z.enum(["like", "dislike", "neutral"]),
  outcome: z.string().optional(),
  comment: z.string().optional(),
});
