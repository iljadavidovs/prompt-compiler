export type CompileSource =
  | "cli"
  | "http"
  | "mcp"
  | "codex"
  | "claude-code"
  | "browser"
  | "unknown";

export type PromptMode =
  | "coding"
  | "writing"
  | "research"
  | "analysis"
  | "reply"
  | "generic";

export type ContextBlockKind =
  | "selection"
  | "file"
  | "repo"
  | "clipboard"
  | "memory"
  | "manual"
  | "diff"
  | "error"
  | "goal"
  | "schedule"
  | "preference"
  | "history";

export interface CompileOptions {
  deterministic?: boolean;
  skip?: boolean;
  contextMode?: "selected-only" | "project";
  executionPolicy?: "local-only" | "configured";
  includeTrace?: boolean;
  maxContextTokens?: number;
  maxPromptTokens?: number;
  intelligence?: IntelligenceOptions;
}

export type IntelligenceProviderName = "deterministic" | "openai" | "local" | "none";

export interface ClassifierHistoryOptions {
  enabled?: boolean;
  turns?: number;
  includeSkipped?: boolean;
  providerVisible?: boolean;
}

export interface IntelligenceOptions {
  enabled?: boolean;
  provider?: IntelligenceProviderName;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  historyWindow?: ClassifierHistoryOptions;
}

export interface ContextBlock {
  id: string;
  label: string;
  kind: ContextBlockKind;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CompilePromptInput {
  source: CompileSource;
  requestId?: string;
  inputHash?: string;
  provenance?: CompilationProvenance;
  rawText: string;
  mode?: PromptMode;
  templateId?: string;
  profileId?: string;
  cwd?: string;
  contextHints?: string[];
  contextBlocks?: ContextBlock[];
  vars?: Record<string, unknown>;
  options?: CompileOptions;
}

export interface PromptOutputFormat {
  type: "markdown" | "json" | "patch" | "plan";
  schema?: unknown;
}

export interface PromptStyle {
  tone?: string;
  verbosity?: "short" | "medium" | "deep";
  strictness?: "low" | "medium" | "high";
}

export interface PromptExecution {
  askClarifyingQuestions: boolean;
  allowWeb: boolean;
  requireCitations: boolean;
  requireTests: boolean;
  requirePlan: boolean;
}

export interface PromptIR {
  intent: string;
  mode: PromptMode;
  task: string;
  assumptions: string[];
  constraints: string[];
  contextSummary: string;
  contextItems: ContextBlock[];
  positivePatterns: string[];
  negativePatterns: string[];
  outputFormat: PromptOutputFormat;
  style: PromptStyle;
  execution: PromptExecution;
  metadata: {
    templateId: string;
    profileId: string;
    source: CompileSource;
    contextMode?: "selected-only" | "project";
  };
}

export interface ContextPack {
  goals: ContextBlock[];
  schedule: ContextBlock[];
  preferences: ContextBlock[];
  recurringComments: ContextBlock[];
  positiveExamples: ContextBlock[];
  negativeExamples: ContextBlock[];
  projectContext: ContextBlock[];
  manualContext: ContextBlock[];
  summary: string;
  tokenEstimate: number;
}

export interface CompileMetadata {
  compileId: string;
  createdAt: string;
  templateId: string;
  profileId: string;
  mode: string;
  source: string;
  tokenEstimate: number;
  contextTokenEstimate: number;
  warnings: string[];
  compilerVersion: string;
  requestId?: string;
  inputHash?: string;
  trace?: CompileTrace;
  provenance?: CompilationProvenance;
  effectivePolicy?: { contextMode: string; network: "denied" | "configured"; commands: "denied" | "configured"; classifierHistory: boolean; maxContextTokens?: number };
  sources?: Array<{ id: string; included: boolean; reason?: string }>;
  skipped?: boolean;
  skipReason?: string;
  selectedToolId?: string;
  duplicateCount?: number;
  lastDuplicateAt?: string;
}

export interface CompileTraceStep {
  name: string;
  at: string;
  details?: Record<string, unknown>;
}

export interface CompileTrace {
  steps: CompileTraceStep[];
}

export interface CompilePromptOutput {
  prompt: string;
  promptIr: PromptIR;
  contextPack: ContextPack;
  metadata: CompileMetadata;
  trace?: CompileTrace;
}

export interface PcrProfile {
  id: string;
  name: string;
  tone?: string;
  verbosity?: "short" | "medium" | "deep";
  strictness?: "low" | "medium" | "high";
  defaults?: Partial<PromptExecution>;
  rules: string[];
}

export interface PcrTemplate {
  id: string;
  name: string;
  mode: PromptMode;
  description?: string;
  outputFormat: PromptOutputFormat["type"];
  body: string;
}

export interface PcrToolMetadata {
  id: string;
  packageName: string;
  name: string;
  description: string;
  modes: PromptMode[];
  intents: string[];
  triggers: string[];
  contextKinds: ContextBlockKind[];
  defaultEnabled: boolean;
  activation?: "keyword" | "project" | "hybrid";
  inputPolicy?: {
    includeOriginalRequest?: boolean;
    task?: string;
    hookInstruction?: string;
  };
}

export interface PcrToolContextInput {
  cwd: string;
  rawText: string;
  task: string;
  mode: PromptMode;
  intent: string;
  contextHints: string[];
  toolConfig: Record<string, unknown>;
}

export interface PcrTool {
  metadata: PcrToolMetadata;
  template: PcrTemplate;
  profile: PcrProfile;
  prepareContext?: (input: PcrToolContextInput) => Promise<ContextBlock[]> | ContextBlock[];
}

export interface PcrConfig {
  tools?: {
    enabled?: string[];
    config?: Record<string, Record<string, unknown>>;
  };
  intelligence?: IntelligenceOptions;
  defaultProfile?: string;
  defaultTemplate?: string;
}

export type FeedbackRating = "like" | "dislike" | "neutral";

export interface FeedbackInput {
  compileId: string;
  rating: FeedbackRating;
  outcome?: string;
  comment?: string;
}

export interface CompilationHistoryRecord {
  compileId: string;
  createdAt: string;
  source: CompileSource;
  mode: PromptMode;
  templateId: string;
  profileId: string;
  rawText: string;
  prompt: string;
  promptIr: PromptIR;
  contextPack: ContextPack;
  metadata: CompileMetadata;
}

export interface RankedContextBlock extends ContextBlock {
  score: number;
  source?: string;
}

export interface ResolvedPcrPaths {
  cwd: string;
  projectDir: string;
  userDir: string;
  dbPath: string;
}

export interface SourceReference {
  host: "local" | "quaggit-fixture";
  projectId: string;
  artifactId: string;
  revision: number;
  contentHash: string;
}

export type BindingRole = "background" | "requirement" | "criteria" | "example" | "goal" | "schedule" | "preference";

export interface CompilationProvenance {
  schemaVersion: 1;
  projectId: string;
  derivedFrom: Array<{ source: SourceReference; role: BindingRole; order: number }>;
}
