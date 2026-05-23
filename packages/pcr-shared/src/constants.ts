export const PCR_COMPILER_VERSION = "0.1.0";

export const PCR_USER_DIR_NAME = ".pcr";
export const PCR_PROJECT_DIR_NAME = ".pcr";
export const PCR_SQLITE_FILE = "pcr.sqlite";

export const DEFAULT_PROFILE_ID = "reflective-research";
export const DEFAULT_TEMPLATE_ID = "research.progress-assessment";

export const DEFAULT_MAX_CONTEXT_TOKENS = 3000;
export const DEFAULT_MAX_PROMPT_TOKENS = 8000;

export const CONTEXT_FILENAMES_BY_KIND = {
  goals: "goals.md",
  schedule: "schedule.md",
  preferences: "preferences.md",
  recurringComments: "recurring-comments.md",
  positivePatterns: "positive-patterns.md",
  negativePatterns: "negative-patterns.md",
} as const;

export const CONTEXT_KIND_BY_FILENAME: Record<string, ContextFileKind> = {
  "goals.md": "goal",
  "schedule.md": "schedule",
  "preferences.md": "preference",
  "recurring-comments.md": "preference",
  "positive-patterns.md": "history",
  "negative-patterns.md": "history",
};

export type ContextFileKind = "goal" | "schedule" | "preference" | "history";

