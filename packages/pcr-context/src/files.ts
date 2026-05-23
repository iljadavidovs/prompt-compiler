import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import {
  CONTEXT_KIND_BY_FILENAME,
  estimateTokens,
  normalizeWhitespace,
  resolvePcrPaths,
  type ContextBlockKind,
  type PromptMode,
} from "@pcr/shared";
import { createPcrStore, type ContextChunkRecord, type PcrStore } from "@pcr/store";

export interface IndexLocalContextOptions {
  cwd?: string;
  userDir?: string;
  dbPath?: string;
  store?: PcrStore;
}

export interface IndexLocalContextResult {
  indexedFiles: number;
  indexedChunks: number;
}

interface ContextFile {
  path: string;
  scope: "user" | "project";
  kind: ContextBlockKind;
  role: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function contextRole(file: string): string {
  const name = basename(file).toLowerCase();
  if (name === "goals.md") {
    return "goals";
  }
  if (name === "schedule.md") {
    return "schedule";
  }
  if (name === "preferences.md") {
    return "preferences";
  }
  if (name === "recurring-comments.md") {
    return "recurringComments";
  }
  if (name === "positive-patterns.md") {
    return "positivePatterns";
  }
  if (name === "negative-patterns.md") {
    return "negativePatterns";
  }
  return "projectContext";
}

function detectKind(file: string): ContextBlockKind {
  const known = CONTEXT_KIND_BY_FILENAME[basename(file).toLowerCase()];
  if (known) {
    return known;
  }
  return "file";
}

async function collectMarkdownFiles(dir: string, scope: "user" | "project"): Promise<ContextFile[]> {
  if (!(await exists(dir))) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const output: ContextFile[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await collectMarkdownFiles(fullPath, scope)));
      continue;
    }
    if (entry.isFile() && [".md", ".markdown", ".txt"].includes(extname(entry.name).toLowerCase())) {
      output.push({
        path: fullPath,
        scope,
        kind: detectKind(fullPath),
        role: contextRole(fullPath),
      });
    }
  }
  return output.sort((a, b) => a.path.localeCompare(b.path));
}

function chunkContent(file: ContextFile, content: string): ContextChunkRecord[] {
  const normalized = normalizeWhitespace(content);
  if (!normalized) {
    return [];
  }

  const sections = normalized
    .split(/\n(?=#{1,3}\s+)/g)
    .flatMap((section) => {
      if (section.length <= 1800) {
        return [section];
      }
      return section.split(/\n\s*\n/g);
    })
    .map((section) => normalizeWhitespace(section))
    .filter(Boolean);

  const sourceId = `src_${hash(file.path)}`;
  const documentId = `doc_${hash(file.path)}`;
  return sections.map((section, index) => ({
    id: `chunk_${hash(`${file.path}:${index}:${section}`)}`,
    documentId,
    sourceId,
    kind: file.kind,
    label: `${basename(file.path)}${sections.length > 1 ? `:${index + 1}` : ""}`,
    content: section,
    tokenEstimate: estimateTokens(section),
    metadata: {
      path: file.path,
      role: file.role,
      scope: file.scope,
    },
  }));
}

export async function indexLocalContext(options: IndexLocalContextOptions = {}): Promise<IndexLocalContextResult> {
  const paths = resolvePcrPaths(options.cwd, options.userDir ?? process.env.PCR_USER_DIR);
  const store = options.store ?? createPcrStore({ dbPath: options.dbPath ?? process.env.PCR_DB_PATH ?? paths.dbPath });
  let shouldCloseStore = !options.store;
  let indexedFiles = 0;
  let indexedChunks = 0;

  try {
    const files = [
      ...(await collectMarkdownFiles(join(paths.userDir, "context"), "user")),
      ...(await collectMarkdownFiles(join(paths.projectDir, "context"), "project")),
    ];

    for (const file of files) {
      const content = await readFile(file.path, "utf8");
      const sourceId = `src_${hash(file.path)}`;
      const documentId = `doc_${hash(file.path)}`;
      const contentHash = hash(content);
      const title = relative(file.scope === "user" ? paths.userDir : paths.projectDir, file.path);

      store.upsertContextSource({
        id: sourceId,
        scope: file.scope,
        kind: file.kind,
        path: file.path,
        metadata: { role: file.role },
      });
      store.upsertContextDocument({
        id: documentId,
        sourceId,
        path: file.path,
        kind: file.kind,
        title,
        contentHash,
        metadata: { role: file.role },
      });

      const chunks = chunkContent(file, content);
      store.replaceDocumentChunks(documentId, chunks);
      indexedFiles += 1;
      indexedChunks += chunks.length;
    }

    return { indexedFiles, indexedChunks };
  } finally {
    if (shouldCloseStore) {
      store.close();
      shouldCloseStore = false;
    }
  }
}

export function buildContextQuery(input: {
  rawText: string;
  mode: PromptMode;
  contextHints?: string[];
  profileId?: string;
}): string {
  const modeTerms =
    input.mode === "research"
      ? "research progress assessment goals schedule preferences risks bottlenecks"
      : input.mode;
  return [input.rawText, modeTerms, input.profileId, ...(input.contextHints ?? [])]
    .filter(Boolean)
    .join(" ");
}

