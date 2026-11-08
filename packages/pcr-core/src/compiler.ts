import { resolve } from "node:path";
import { offlineGrammarTemplate } from "@pcr/tool-grammar";
import { buildContextPack } from "@pcr/context";
import { classifyIntent, rewriteGrammarPrompt, type ClassifierHistoryTurn } from "@pcr/intelligence";
import { createPcrStore } from "@pcr/store";
import {
  CompilePromptInputSchema,
  createCompileId,
  estimateTokens,
  isoNow,
  maxPromptTokens,
  maxContextTokens,
  PCR_COMPILER_VERSION,
  redactSecrets,
  redactStructured,
  type CompilePromptInput,
  type CompilePromptOutput,
  type CompileTrace,
  type ContextBlock,
  type CompilationHistoryRecord,
  type IntelligenceOptions,
  type PcrConfig,
  resolvePcrPaths,
} from "@pcr/shared";
import { resolveProfile } from "./profile.js";
import { buildPromptIr } from "./prompt-ir.js";
import { buildContextPackFromBlocks } from "./context-pack.js";
import { renderPrompt } from "./render.js";
import { enabledToolMetadata, listEnabledTools, resolveConfig, selectTool, toolConfig } from "./tools.js";

const DEFAULT_CODEX_HISTORY_DEDUPE_WINDOW_MS = 10_000;
const DEFAULT_CLASSIFIER_HISTORY_TURNS = 10;
const MAX_CLASSIFIER_HISTORY_TURNS = 50;

function traceStep(trace: CompileTrace, name: string, details?: Record<string, unknown>) {
  trace.steps.push({ name, at: isoNow(), details });
}

function explicitBlocks(input: CompilePromptInput): ContextBlock[] {
  return (input.contextBlocks ?? []).map((block) => ({
    ...block,
    content: redactSecrets(block.content),
  }));
}

function contextNeedQueryTerms(needs: string[]): string[] {
  const terms: string[] = [];
  for (const need of needs) {
    if (need === "goal") {
      terms.push("goals objectives priorities progress");
    }
    if (need === "schedule") {
      terms.push("schedule calendar today week friday weekend deadline");
    }
    if (need === "preference") {
      terms.push("preferences recurring instructions tone style constraints");
    }
    if (need === "history") {
      terms.push("history feedback positive patterns negative patterns avoid preserve");
    }
  }
  return terms;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function mergeIntelligenceOptions(config: PcrConfig, input?: IntelligenceOptions): IntelligenceOptions | undefined {
  const configured = config.intelligence;
  if (!configured && !input) {
    return undefined;
  }
  return {
    ...configured,
    ...input,
    historyWindow: {
      ...(configured?.historyWindow ?? {}),
      ...(input?.historyWindow ?? {}),
    },
  };
}

function classifierHistorySettings(options?: IntelligenceOptions): Required<NonNullable<IntelligenceOptions["historyWindow"]>> {
  return {
    enabled: options?.historyWindow?.enabled ?? true,
    turns: Math.min(options?.historyWindow?.turns ?? DEFAULT_CLASSIFIER_HISTORY_TURNS, MAX_CLASSIFIER_HISTORY_TURNS),
    includeSkipped: options?.historyWindow?.includeSkipped ?? true,
    providerVisible: options?.historyWindow?.providerVisible ?? true,
  };
}

function compactHistoryText(text: string): string {
  const clean = redactSecrets(text).replace(/\s+/g, " ").trim();
  return clean.length > 800 ? `${clean.slice(0, 797)}...` : clean;
}

function historyTurn(record: CompilationHistoryRecord): ClassifierHistoryTurn {
  return {
    role: "user",
    text: compactHistoryText(record.rawText),
    createdAt: record.createdAt,
    source: record.source,
    mode: record.mode,
    intent: record.promptIr.intent,
    selectedToolId: record.metadata.selectedToolId,
    skipped: record.metadata.skipped ?? false,
  };
}

function loadClassifierHistory(dbPath: string, options?: IntelligenceOptions): ClassifierHistoryTurn[] {
  if (process.env.PCR_DISABLE_HISTORY === "1") {
    return [];
  }
  const settings = classifierHistorySettings(options);
  if (!settings.enabled || !settings.providerVisible) {
    return [];
  }

  let store: ReturnType<typeof createPcrStore> | null = null;
  try {
    store = createPcrStore({ dbPath });
    return store
      .listCompilations(settings.turns * 3)
      .filter((record) => settings.includeSkipped || !record.metadata.skipped)
      .slice(0, settings.turns)
      .reverse()
      .map(historyTurn);
  } catch {
    return [];
  } finally {
    store?.close();
  }
}

function skippedOutput(
  input: CompilePromptInput,
  trace: CompileTrace,
  mode: string,
  intent: string,
  warnings: string[],
): CompilePromptOutput {
  const compileId = createCompileId();
  const createdAt = isoNow();
  const skipReason = warnings.at(-1) ?? "PCR skipped.";
  return {
    prompt: "",
    promptIr: {
      intent,
      mode: mode as CompilePromptOutput["promptIr"]["mode"],
      task: input.rawText.replace(/^\s*\$pcr\s+/i, "").trim(),
      assumptions: [],
      constraints: [],
      contextSummary: "PCR skipped; no prompt was compiled.",
      contextItems: [],
      positivePatterns: [],
      negativePatterns: [],
      outputFormat: { type: "markdown" },
      style: {},
      execution: {
        askClarifyingQuestions: false,
        allowWeb: false,
        requireCitations: false,
        requireTests: false,
        requirePlan: false,
      },
      metadata: {
        templateId: "",
        profileId: "",
        source: input.source,
      },
    },
    contextPack: {
      goals: [],
      schedule: [],
      preferences: [],
      recurringComments: [],
      positiveExamples: [],
      negativeExamples: [],
      projectContext: [],
      manualContext: [],
      summary: "PCR skipped; no enabled tool matched.",
      tokenEstimate: 0,
    },
    metadata: {
      compileId,
      createdAt,
      templateId: "",
      profileId: "",
      mode,
      source: input.source,
      tokenEstimate: 0,
      contextTokenEstimate: 0,
      warnings,
      compilerVersion: PCR_COMPILER_VERSION,
      skipped: true,
      skipReason,
    },
    trace: input.options?.includeTrace ? trace : undefined,
  };
}

function normalizedRawText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function codexHistoryDedupeWindowMs(): number {
  return Number(process.env.PCR_CODEX_HISTORY_DEDUPE_WINDOW_MS ?? DEFAULT_CODEX_HISTORY_DEDUPE_WINDOW_MS);
}

function findRecentCodexDuplicate(
  store: ReturnType<typeof createPcrStore>,
  input: CompilePromptInput,
  output: CompilePromptOutput,
): CompilationHistoryRecord | null {
  if (input.source !== "codex") {
    return null;
  }
  const createdAt = Date.parse(output.metadata.createdAt);
  if (!Number.isFinite(createdAt)) {
    return null;
  }
  const rawText = normalizedRawText(input.rawText);
  return store.listCompilations(20).find((record) => (
    record.source === "codex"
    && normalizedRawText(record.rawText) === rawText
    && Math.abs(createdAt - Date.parse(record.createdAt)) <= codexHistoryDedupeWindowMs()
  )) ?? null;
}

function shouldReplaceDuplicate(existing: CompilationHistoryRecord, output: CompilePromptOutput): boolean {
  if (existing.metadata.skipped && !output.metadata.skipped) {
    return true;
  }
  if (!existing.metadata.selectedToolId && output.metadata.selectedToolId) {
    return true;
  }
  return existing.metadata.tokenEstimate === 0 && output.metadata.tokenEstimate > 0;
}

function nextDuplicateMetadata(existing: CompilationHistoryRecord): Pick<CompilePromptOutput["metadata"], "duplicateCount" | "lastDuplicateAt"> {
  return {
    duplicateCount: Number(existing.metadata.duplicateCount ?? 1) + 1,
    lastDuplicateAt: isoNow(),
  };
}

function persistOutput(
  input: CompilePromptInput,
  output: CompilePromptOutput,
  trace: CompileTrace,
  dbPath: string,
): void {
  if (process.env.PCR_DISABLE_HISTORY === "1") {
    return;
  }

  let store: ReturnType<typeof createPcrStore> | null = null;
  try {
    store = createPcrStore({ dbPath });
    const duplicate = findRecentCodexDuplicate(store, input, output);
    if (duplicate) {
      const duplicateMetadata = nextDuplicateMetadata(duplicate);
      output.metadata.compileId = duplicate.compileId;
      output.metadata.createdAt = duplicate.createdAt;
      output.metadata.duplicateCount = duplicateMetadata.duplicateCount;
      output.metadata.lastDuplicateAt = duplicateMetadata.lastDuplicateAt;
      if (!shouldReplaceDuplicate(duplicate, output)) {
        store.saveCompilation({
          ...duplicate,
          metadata: {
            ...duplicate.metadata,
            ...duplicateMetadata,
          },
        });
        traceStep(trace, "dedupeCompilation", {
          compileId: duplicate.compileId,
          skipped: output.metadata.skipped ?? false,
          replaced: false,
          duplicateCount: duplicateMetadata.duplicateCount,
        });
        return;
      }
    }
    output.metadata.trace = input.options?.includeTrace ? structuredClone(trace) : undefined;
    const historyRecord: CompilationHistoryRecord = {
      compileId: output.metadata.compileId,
      createdAt: output.metadata.createdAt,
      source: input.source,
      mode: output.promptIr.mode,
      templateId: output.metadata.templateId,
      profileId: output.metadata.profileId,
      rawText: input.rawText,
      prompt: output.prompt,
      promptIr: output.promptIr,
      contextPack: output.contextPack,
      metadata: output.metadata,
    };
    store.saveCompilation(historyRecord);
    traceStep(trace, duplicate ? "dedupeCompilation" : "persistCompilation", {
      compileId: output.metadata.compileId,
      skipped: output.metadata.skipped ?? false,
      replaced: Boolean(duplicate),
      duplicateCount: output.metadata.duplicateCount,
    });
  } catch (error) {
    output.metadata.warnings.push(`Failed to persist compilation: ${(error as Error).message}`);
    traceStep(trace, "persistCompilationFailed", { message: (error as Error).message });
  } finally {
    store?.close();
  }
}

export async function compilePrompt(input: CompilePromptInput): Promise<CompilePromptOutput> {
  const parsed = CompilePromptInputSchema.parse(input);
  parsed.rawText = redactSecrets(parsed.rawText);
  parsed.contextBlocks = redactStructured(parsed.contextBlocks);
  parsed.provenance = redactStructured(parsed.provenance);
  parsed.vars = redactStructured(parsed.vars);
  const selectedOnly = parsed.options?.contextMode === "selected-only";
  const localOnly = selectedOnly || parsed.options?.executionPolicy === "local-only";
  const trace: CompileTrace = { steps: [] };
  traceStep(trace, "validateInput", { source: parsed.source });

  const cwd = resolve(parsed.cwd ?? process.cwd());
  traceStep(trace, "resolveCwd", { cwd });

  const paths = resolvePcrPaths(cwd, process.env.PCR_USER_DIR);
  const config = await resolveConfig(cwd, paths.userDir, selectedOnly ? "user" : "project");
  const configuredIntelligence = mergeIntelligenceOptions(config, parsed.options?.intelligence);
  const noNetwork = localOnly || parsed.options?.deterministic === true || configuredIntelligence?.enabled === false || ["none", "deterministic"].includes(configuredIntelligence?.provider ?? "");
  const intelligenceOptions = noNetwork ? { enabled: false, provider: "none" as const, historyWindow: { enabled: false } } : configuredIntelligence;
  traceStep(trace, "effectivePolicy", { contextMode: selectedOnly ? "selected-only" : "project", network: noNetwork ? "denied" : "configured", commands: localOnly ? "denied" : "configured" });
  const dbPath = process.env.PCR_DB_PATH ?? paths.dbPath;
  const enabledTools = listEnabledTools(config);
  traceStep(trace, "resolveTools", {
    enabledTools: enabledTools.map((tool) => tool.metadata.id),
  });

  const classifierHistory = selectedOnly ? [] : loadClassifierHistory(dbPath, intelligenceOptions);
  traceStep(trace, "loadClassifierHistory", {
    turns: classifierHistory.length,
    providerVisible: classifierHistorySettings(intelligenceOptions).providerVisible,
  });

  const classification = await classifyIntent({
    rawText: parsed.rawText,
    explicitMode: parsed.mode,
    contextHints: parsed.contextHints,
    profileId: parsed.profileId,
    history: classifierHistory,
    enabledTools: enabledToolMetadata(enabledTools, config),
    options: intelligenceOptions,
  });
  let mode = classification.mode;
  let intent = classification.intent;
  const classificationWarnings: string[] = [...classification.warnings];
  traceStep(trace, "classifyIntent", {
    mode,
    intent,
    confidence: classification.confidence,
    provider: classification.provider,
    usedLlm: classification.usedLlm,
    adapter: classification.adapter,
  });

  const skip = (reason: string, warnings: string[] = []): CompilePromptOutput => {
    const output = skippedOutput(parsed, trace, mode, intent, [...warnings, reason]);
    traceStep(trace, "skip", { reason });
    Object.assign(output.metadata, {
      requestId: parsed.requestId, inputHash: parsed.inputHash, provenance: parsed.provenance,
      effectivePolicy: { contextMode: selectedOnly ? "selected-only" : "project", network: noNetwork ? "denied" : "configured", commands: localOnly ? "denied" : "configured", classifierHistory: !selectedOnly && classifierHistory.length > 0, maxContextTokens: maxContextTokens(parsed.options) },
      sources: explicitBlocks(parsed).map((block) => ({ id: block.id, included: false, reason: "Compilation skipped" })),
    });
    persistOutput(parsed, output, trace, dbPath);
    return output;
  };
  const selectedTool = parsed.options?.skip || classification.adapter === "skip" ? null : selectTool(classification, enabledTools, parsed.rawText, config);
  if (!selectedTool) {
    return skip(parsed.options?.skip ? "PCR skipped explicitly by the user." : enabledTools.length === 0
      ? "PCR skipped because no tools are enabled." : "PCR skipped because no enabled tool matched the request.", classification.warnings);
  }
  traceStep(trace, "selectTool", { toolId: selectedTool.metadata.id });

  if (!selectedTool.metadata.modes.includes(mode) || !selectedTool.metadata.intents.includes(intent)) {
    classificationWarnings.push(`Classifier output was aligned to selected tool ${selectedTool.metadata.id}.`);
    mode = selectedTool.metadata.modes[0] ?? mode;
    intent = selectedTool.metadata.intents[0] ?? intent;
    traceStep(trace, "alignClassificationToTool", { mode, intent, toolId: selectedTool.metadata.id });
  }

  const profile = parsed.profileId && !selectedOnly
    ? await resolveProfile({ profileId: parsed.profileId, cwd })
    : selectedTool.profile;
  traceStep(trace, "resolveProfile", { profileId: profile.id });

  const selectedToolConfig = toolConfig(config, selectedTool);
  const grammarRewrite = selectedTool.metadata.id === "grammar"
    ? await rewriteGrammarPrompt({
        rawText: parsed.rawText,
        keywords: [...selectedTool.metadata.triggers, ...stringList(selectedToolConfig.keywords)],
        options: intelligenceOptions,
      })
    : null;
  if (grammarRewrite) {
    traceStep(trace, "rewriteGrammarPrompt", {
      provider: grammarRewrite.provider,
      usedLlm: grammarRewrite.usedLlm,
      warnings: grammarRewrite.warnings.length,
    });
  }

  if (grammarRewrite && !grammarRewrite.correctedPrompt) return skip("PCR skipped because no text remained after the grammar trigger.", grammarRewrite.warnings);

  const template = selectedOnly && grammarRewrite && !grammarRewrite.usedLlm ? offlineGrammarTemplate : selectedTool.template;
  traceStep(trace, "resolveTemplate", { templateId: template.id });

  const includeOriginalRequest = selectedTool.metadata.inputPolicy?.includeOriginalRequest ?? true;
  const task = grammarRewrite?.correctedPrompt
    ? grammarRewrite.correctedPrompt
    : selectedOnly
    ? parsed.rawText.replace(/^\s*\$pcr\s+/i, "").trim()
    : includeOriginalRequest
    ? [
        classification.taskRewrite,
        "",
        `Original request: ${parsed.rawText.replace(/^\s*\$pcr\s+/i, "").trim()}`,
      ].join("\n")
    : selectedTool.metadata.inputPolicy?.task ?? classification.taskRewrite;

  const toolContextBlocks = !localOnly && selectedTool.prepareContext
    ? await selectedTool.prepareContext({
        cwd,
        rawText: parsed.rawText,
        task,
        mode,
        intent,
        contextHints: parsed.contextHints ?? [],
        toolConfig: selectedToolConfig,
      })
    : [];
  traceStep(trace, "prepareToolContext", { blocks: toolContextBlocks.length });

  const contextPack = selectedOnly
    ? buildContextPackFromBlocks(explicitBlocks(parsed), parsed.options)
    : await buildContextPack({
    cwd,
    rawText: [
      ...contextNeedQueryTerms(classification.contextNeeds),
      ...contextNeedQueryTerms(selectedTool.metadata.contextKinds),
      classification.taskRewrite,
      parsed.rawText,
      ...classification.contextQueries,
    ].join("\n"),
    mode,
    profileId: profile.id,
    contextHints: [...(parsed.contextHints ?? []), ...classification.contextNeeds, ...selectedTool.metadata.contextKinds],
    contextBlocks: [...explicitBlocks(parsed), ...toolContextBlocks],
    options: parsed.options,
  });
  traceStep(trace, "buildContextPack", { tokenEstimate: contextPack.tokenEstimate });

  const promptIr = buildPromptIr({
    input: parsed,
    intent,
    mode,
    task,
    template,
    profile,
    contextPack,
  });
  traceStep(trace, "buildPromptIr", { contextItems: promptIr.contextItems.length });

  if (selectedOnly) {
    promptIr.metadata.contextMode = "selected-only";
    const included = new Set(promptIr.contextItems.map((block) => block.id));
    promptIr.contextItems = explicitBlocks(parsed).filter((block) => included.has(block.id));
  }
  const prompt = renderPrompt(template, promptIr, contextPack);
  const tokenEstimate = estimateTokens(prompt);
  const warnings: string[] = [...classificationWarnings, ...(grammarRewrite?.warnings ?? [])];
  const omittedSources = selectedOnly ? explicitBlocks(parsed).filter(block => !promptIr.contextItems.some(item => item.id === block.id)).length : 0;
  if (omittedSources) warnings.push(`${omittedSources} selected source(s) omitted because they exceed the context budget. Inspect Sources for exact omissions.`);
  if (tokenEstimate > maxPromptTokens(parsed.options)) {
    warnings.push("Compiled prompt exceeds maxPromptTokens.");
  }
  traceStep(trace, "renderPrompt", { tokenEstimate });

  const output: CompilePromptOutput = {
    prompt,
    promptIr,
    contextPack,
    metadata: {
      compileId: createCompileId(),
      createdAt: isoNow(),
      templateId: template.id,
      profileId: profile.id,
      mode,
      source: parsed.source,
      tokenEstimate,
      contextTokenEstimate: contextPack.tokenEstimate,
      warnings,
      compilerVersion: PCR_COMPILER_VERSION,
      requestId: parsed.requestId,
      inputHash: parsed.inputHash,
      provenance: parsed.provenance,
      effectivePolicy: { contextMode: selectedOnly ? "selected-only" : "project", network: noNetwork ? "denied" : "configured", commands: localOnly ? "denied" : "configured", classifierHistory: !selectedOnly && classifierHistory.length > 0, maxContextTokens: maxContextTokens(parsed.options) },
      sources: explicitBlocks(parsed).map((block) => ({ id: block.id, included: promptIr.contextItems.some((item) => item.id === block.id), reason: promptIr.contextItems.some((item) => item.id === block.id) ? undefined : "Context budget exceeded" })),
      skipped: false,
      selectedToolId: selectedTool.metadata.id,
    },
    trace: parsed.options?.includeTrace ? trace : undefined,
  };

  persistOutput(parsed, output, trace, dbPath);

  return output;
}
