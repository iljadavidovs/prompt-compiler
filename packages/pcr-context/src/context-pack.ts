import { createPcrStore, type PcrStore } from "@pcr/store";
import { getFeedbackExamples, rankedBlockToContextBlock, searchContext } from "@pcr/retrieval";
import {
  estimateTokens,
  maxContextTokens,
  resolvePcrPaths,
  uniqueStable,
  type CompileOptions,
  type ContextBlock,
  type ContextPack,
  type PromptMode,
} from "@pcr/shared";
import { buildContextQuery, indexLocalContext } from "./files.js";

export interface BuildContextPackOptions {
  cwd?: string;
  userDir?: string;
  dbPath?: string;
  rawText: string;
  mode: PromptMode;
  profileId?: string;
  contextHints?: string[];
  contextBlocks?: ContextBlock[];
  options?: CompileOptions;
  store?: PcrStore;
}

function metadataRole(block: ContextBlock): string {
  return typeof block.metadata?.role === "string" ? block.metadata.role : "";
}

function classify(block: ContextBlock): keyof Omit<ContextPack, "summary" | "tokenEstimate"> {
  const role = metadataRole(block);
  if (block.kind === "goal" || role === "goals") {
    return "goals";
  }
  if (block.kind === "schedule" || role === "schedule") {
    return "schedule";
  }
  if (role === "recurringComments") {
    return "recurringComments";
  }
  if (role === "positivePatterns" || /positive|like|success/i.test(block.label)) {
    return "positiveExamples";
  }
  if (role === "negativePatterns" || /negative|dislike|avoid|fail/i.test(block.label)) {
    return "negativeExamples";
  }
  if (block.kind === "preference" || role === "preferences") {
    return "preferences";
  }
  if (["manual", "selection", "clipboard", "diff", "error"].includes(block.kind)) {
    return "manualContext";
  }
  return "projectContext";
}

function emptyPack(): ContextPack {
  return {
    goals: [],
    schedule: [],
    preferences: [],
    recurringComments: [],
    positiveExamples: [],
    negativeExamples: [],
    projectContext: [],
    manualContext: [],
    summary: "",
    tokenEstimate: 0,
  };
}

function addBlock(pack: ContextPack, block: ContextBlock): void {
  pack[classify(block)].push(block);
}

function summarize(pack: ContextPack): string {
  const parts = [
    pack.goals.length ? `${pack.goals.length} goal block(s)` : "",
    pack.schedule.length ? `${pack.schedule.length} schedule block(s)` : "",
    pack.preferences.length ? `${pack.preferences.length} preference block(s)` : "",
    pack.recurringComments.length ? `${pack.recurringComments.length} recurring instruction block(s)` : "",
    pack.positiveExamples.length ? `${pack.positiveExamples.length} positive history/example block(s)` : "",
    pack.negativeExamples.length ? `${pack.negativeExamples.length} negative history/example block(s)` : "",
    pack.projectContext.length ? `${pack.projectContext.length} project context block(s)` : "",
    pack.manualContext.length ? `${pack.manualContext.length} manual context block(s)` : "",
  ].filter(Boolean);
  return parts.length
    ? `Context pack includes ${parts.join(", ")}.`
    : "No local context was available; rely only on the user request and explicit constraints.";
}

function blockTokens(block: ContextBlock): number {
  return estimateTokens(`${block.label}\n${block.content}`);
}

export async function buildContextPack(options: BuildContextPackOptions): Promise<ContextPack> {
  const paths = resolvePcrPaths(options.cwd, options.userDir ?? process.env.PCR_USER_DIR);
  const store = options.store ?? createPcrStore({ dbPath: options.dbPath ?? process.env.PCR_DB_PATH ?? paths.dbPath });
  let shouldCloseStore = !options.store;

  try {
    await indexLocalContext({
      cwd: paths.cwd,
      userDir: paths.userDir,
      store,
    });

    const query = buildContextQuery({
      rawText: options.rawText,
      mode: options.mode,
      contextHints: options.contextHints,
      profileId: options.profileId,
    });

    const searchResults = searchContext(store, query, {
      mode: options.mode,
      contextHints: options.contextHints,
      limit: 20,
    }).map(rankedBlockToContextBlock);
    const examples = getFeedbackExamples(store, { query, mode: options.mode, limit: 3 });
    const orderedBlocks = uniqueStable(
      [
        ...(options.contextBlocks ?? []),
        ...searchResults,
        ...examples.positive,
        ...examples.negative,
      ],
      (block) => block.id,
    );

    const budget = maxContextTokens(options.options);
    const pack = emptyPack();
    for (const block of orderedBlocks) {
      const nextTokens = blockTokens(block);
      if (pack.tokenEstimate + nextTokens > budget) {
        continue;
      }
      addBlock(pack, block);
      pack.tokenEstimate += nextTokens;
    }
    pack.summary = summarize(pack);
    return pack;
  } finally {
    if (shouldCloseStore) {
      store.close();
      shouldCloseStore = false;
    }
  }
}

