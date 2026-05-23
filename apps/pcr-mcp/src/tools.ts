import { compilePrompt, listBuiltinProfiles, listBuiltinTemplates } from "@pcr/core";
import { searchContext } from "@pcr/retrieval";
import { createPcrStore } from "@pcr/store";
import { resolvePcrPaths, type CompilePromptInput, type ContextBlock, type PromptMode } from "@pcr/shared";

function dbPathFor(cwd?: string): string {
  return process.env.PCR_DB_PATH ?? resolvePcrPaths(cwd, process.env.PCR_USER_DIR).dbPath;
}

export interface PcrCompileToolInput {
  rawText: string;
  mode?: PromptMode;
  templateId?: string;
  profileId?: string;
  contextHints?: string[];
  contextBlocks?: ContextBlock[];
  cwd?: string;
  maxContextTokens?: number;
  intelligenceEnabled?: boolean;
  intelligenceProvider?: "deterministic" | "openai" | "local" | "none";
  intelligenceModel?: string;
}

export async function pcrCompileTool(input: PcrCompileToolInput) {
  const compileInput: CompilePromptInput = {
    source: "mcp",
    rawText: input.rawText,
    mode: input.mode,
    templateId: input.templateId,
    profileId: input.profileId,
    contextHints: input.contextHints,
    contextBlocks: input.contextBlocks,
    cwd: input.cwd,
    options: {
      maxContextTokens: input.maxContextTokens,
      intelligence: input.intelligenceEnabled || input.intelligenceProvider || input.intelligenceModel
        ? {
            enabled: input.intelligenceEnabled,
            provider: input.intelligenceProvider,
            model: input.intelligenceModel,
          }
        : undefined,
    },
  };
  const output = await compilePrompt(compileInput);
  return {
    prompt: output.prompt,
    contextPack: output.contextPack,
    metadata: output.metadata,
    warnings: output.metadata.warnings,
    skipped: output.metadata.skipped ?? false,
    skipReason: output.metadata.skipReason,
  };
}

export function pcrContextSearchTool(input: {
  query: string;
  kinds?: ContextBlock["kind"][];
  limit?: number;
  cwd?: string;
}) {
  const store = createPcrStore({ dbPath: dbPathFor(input.cwd) });
  try {
    return searchContext(store, input.query, {
      kinds: input.kinds,
      limit: input.limit ?? 10,
    });
  } finally {
    store.close();
  }
}

export function pcrAddFeedbackTool(input: {
  compileId: string;
  rating: "like" | "dislike" | "neutral";
  outcome?: string;
  comment?: string;
  cwd?: string;
}) {
  const store = createPcrStore({ dbPath: dbPathFor(input.cwd) });
  try {
    return store.addFeedback({
      compileId: input.compileId,
      rating: input.rating,
      outcome: input.outcome,
      comment: input.comment,
    });
  } finally {
    store.close();
  }
}

export function pcrListTemplatesTool() {
  return listBuiltinTemplates();
}

export function pcrListProfilesTool() {
  return listBuiltinProfiles();
}

export function pcrGetHistoryTool(input: { limit?: number; cwd?: string } = {}) {
  const store = createPcrStore({ dbPath: dbPathFor(input.cwd) });
  try {
    return store.listCompilations(input.limit ?? 20);
  } finally {
    store.close();
  }
}
