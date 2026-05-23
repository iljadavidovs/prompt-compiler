import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { estimateTokens, truncateToTokenBudget, type ContextBlock, type PcrTool, type PcrToolContextInput } from "@pcr/shared";

const execFileAsync = promisify(execFile);
const DOC_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

interface ReminderQuery {
  command: string;
  args: string[];
  label: string;
  reason: string;
  filterTerms: string[];
  filterReason?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface ReminderItem {
  id?: string;
  title?: string;
  notes?: string;
  dueDate?: string;
  listName?: string;
  priority?: string;
  isCompleted?: boolean;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function boolDefault(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return bool(value);
}

function quotedTerms(rawText: string): string[] {
  return [...rawText.matchAll(/"([^"]{2,80})"|'([^']{2,80})'|`([^`]{2,80})`/g)]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .map((term) => term.trim())
    .filter(Boolean);
}

function explicitSearchTerms(rawText: string): string[] {
  const quoted = quotedTerms(rawText);
  const patterns = [
    /\breminders?\s+(?:named|called|about|for|matching|related to)\s+([^.,;!?]+)/i,
    /\btasks?\s+(?:named|called|about|for|matching|related to)\s+([^.,;!?]+)/i,
    /\b(?:project|list)\s+([^.,;!?]+?)\s+reminders?\b/i,
  ];
  const matched = patterns
    .map((pattern) => rawText.match(pattern)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\b(today|tomorrow|this week|next week|week|until sunday|through sunday|by sunday|sunday)\b/gi, "").trim())
    .filter((value) => value.length > 1);
  return [...quoted, ...matched].slice(0, 4);
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function explicitDateFilter(rawText: string): string | null {
  const text = rawText.toLowerCase();
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) {
    return iso;
  }
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (slash) {
    const now = new Date();
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = slash[3] ? Number(slash[3]) : now.getFullYear();
    return isoDate(year, month - 1, day);
  }
  const monthNames = new Map([
    ["january", 0],
    ["february", 1],
    ["march", 2],
    ["april", 3],
    ["may", 4],
    ["june", 5],
    ["july", 6],
    ["august", 7],
    ["september", 8],
    ["october", 9],
    ["november", 10],
    ["december", 11],
  ]);
  const monthMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(20\d{2}))?\b/);
  if (monthMatch) {
    const now = new Date();
    const month = monthNames.get(monthMatch[1]);
    if (month !== undefined) {
      const day = Number(monthMatch[2]);
      let year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
      const candidate = new Date(Date.UTC(year, month, day));
      if (!monthMatch[3] && candidate < new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) {
        year += 1;
      }
      return isoDate(year, month, day);
    }
  }
  return null;
}

function currentDate(): Date {
  const override = process.env.PCR_NOW ? new Date(process.env.PCR_NOW) : null;
  return override && Number.isFinite(override.getTime()) ? override : new Date();
}

function monthRange(offset: number): { start: string; end: string } {
  const now = currentDate();
  const start = isoDate(now.getFullYear(), now.getMonth() + offset, 1);
  const end = isoDate(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

function resolveReminderQuery(rawText: string, reminders: Record<string, unknown>): ReminderQuery {
  const command = typeof reminders.command === "string" ? reminders.command : "remindctl";
  const configuredArgs = stringList(reminders.args);
  const searchScope = typeof reminders.searchScope === "string" ? reminders.searchScope : "upcoming";
  const dynamic = boolDefault(reminders.dynamic, true);
  const filterTerms = explicitSearchTerms(rawText);
  if (!dynamic && configuredArgs.length > 0) {
    return {
      command,
      args: configuredArgs,
      label: "configured reminder query",
      reason: "Planner reminders are configured with a fixed command.",
      filterTerms,
      filterReason: filterTerms.length ? "The request includes a specific reminder/list/topic search." : undefined,
    };
  }

  const text = rawText.toLowerCase();
  const dateFilter = explicitDateFilter(rawText);
  if (dateFilter) {
    return {
      command,
      args: ["show", dateFilter, "--json"],
      label: `reminders on ${dateFilter}`,
      reason: "The request contains a specific reminder date.",
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search." : undefined,
    };
  }
  if (/\boverdue|behind|late\b/.test(text)) {
    return {
      command,
      args: ["show", "overdue", "--json"],
      label: "overdue reminders",
      reason: "The request is focused on overdue or late work.",
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search." : undefined,
    };
  }
  if (/\btomorrow\b/.test(text)) {
    return {
      command,
      args: ["show", "tomorrow", "--json"],
      label: "tomorrow's reminders",
      reason: "The request asks for a tomorrow planning horizon.",
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search." : undefined,
    };
  }
  if (/\btoday\b/.test(text)) {
    return {
      command,
      args: ["show", "today", "--json"],
      label: "today's reminders",
      reason: "The request asks for today's plan.",
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search." : undefined,
    };
  }
  if (/\b(this\s+week|week|weekly|until\s+sunday|through\s+sunday|by\s+sunday|sunday)\b/.test(text)) {
    return {
      command,
      args: ["show", "week", "--json"],
      label: "this week's reminders through Sunday",
      reason: "The request asks to plan this week, so the planner should include upcoming tasks through Sunday.",
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search inside the weekly horizon." : undefined,
    };
  }
  if (/\b(next|coming)\s+month\b/.test(text)) {
    const dateRange = monthRange(1);
    return {
      command,
      args: ["show", searchScope, "--json"],
      label: `next month's reminders (${dateRange.start} to ${dateRange.end})`,
      reason: `The request asks for next month; remindctl has no month filter, so PCR queries ${searchScope} reminders and filters locally by due date.`,
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search inside the next-month horizon." : "Filter reminders by due date.",
      dateRange,
    };
  }
  if (/\b(this|current)\s+month\b/.test(text)) {
    const dateRange = monthRange(0);
    return {
      command,
      args: ["show", searchScope, "--json"],
      label: `this month's reminders (${dateRange.start} to ${dateRange.end})`,
      reason: `The request asks for this month; remindctl has no month filter, so PCR queries ${searchScope} reminders and filters locally by due date.`,
      filterTerms,
      filterReason: filterTerms.length ? "The request also includes a specific reminder/list/topic search inside the month horizon." : "Filter reminders by due date.",
      dateRange,
    };
  }
  if (filterTerms.length > 0) {
    return {
      command,
      args: ["show", searchScope, "--json"],
      label: `${searchScope} reminders matching ${filterTerms.join(", ")}`,
      reason: `The request asks for a specific reminder/list/topic search, so PCR queries ${searchScope} reminders and filters locally.`,
      filterTerms,
      filterReason: "Filter reminders by title, list name, notes/description, and id.",
    };
  }
  if (/\ball reminders|everything|backlog\b/.test(text)) {
    return {
      command,
      args: ["show", "all", "--json"],
      label: "all reminders",
      reason: "The request asks for a broad planning/backlog view.",
      filterTerms: [],
    };
  }
  return {
    command,
    args: configuredArgs.length > 0 ? configuredArgs : ["show", "upcoming", "--json"],
    label: "upcoming reminders",
    reason: "No narrower planning horizon was detected; use upcoming reminders.",
    filterTerms,
    filterReason: filterTerms.length ? "The request includes a specific reminder/list/topic search." : undefined,
  };
}

function commandText(query: ReminderQuery): string {
  return [query.command, ...query.args].join(" ");
}

function plannerScenario(input: PcrToolContextInput, query: ReminderQuery): ContextBlock[] {
  return [
    {
      id: "planner-reminder-query",
      label: "Reminder query",
      kind: "schedule",
      content: [
        `Command: ${commandText(query)}`,
        `Horizon: ${query.label}.`,
        `Reason: ${query.reason}`,
        query.dateRange ? `Local date range: ${query.dateRange.start} to ${query.dateRange.end}` : "",
        query.filterTerms.length ? `Local filter: ${query.filterTerms.join(", ")}` : "",
        query.filterReason ? `Filter reason: ${query.filterReason}` : "",
      ].join("\n"),
      metadata: { role: "plannerReminderQuery", command: commandText(query), args: query.args, filterTerms: query.filterTerms, dateRange: query.dateRange },
    },
    {
      id: "planner-scenario-instructions",
      label: "Planner scenario instructions",
      kind: "preference",
      content: [
        "Use current goals as the priority filter for reminders, schedule, and local planning documents.",
        "Treat reminders as commitments, not as a flat task list; identify conflicts, stale items, and defer/delete candidates.",
        "Use reminder title, due date, list, priority, and notes/description when available.",
        "Group the plan by horizon, priority, dependencies, risks, and next actions.",
        "Prefer a small executable plan over a comprehensive backlog rewrite.",
        "If reminders, goals, or schedule are unavailable, state the gap and continue with the available context.",
        `Reminder command selected for this scenario: ${commandText(query)}`,
        `Planner task: ${input.task}`,
      ].join("\n"),
      metadata: { role: "plannerScenario", reminderCommand: commandText(query), filterTerms: query.filterTerms, dateRange: query.dateRange },
    },
  ];
}

function termsFrom(text: string): string[] {
  const stop = new Set(["the", "and", "with", "that", "this", "from", "into", "what", "when", "where", "plan", "planning"]);
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])].filter((term) => !stop.has(term)).slice(0, 12);
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseReminderItems(stdout: string): ReminderItem[] {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: safeString(item.id),
        title: safeString(item.title),
        notes: safeString(item.notes),
        dueDate: safeString(item.dueDate),
        listName: safeString(item.listName),
        priority: safeString(item.priority),
        isCompleted: item.isCompleted === true,
      }));
  } catch {
    return [];
  }
}

function reminderSearchText(item: ReminderItem): string {
  return [item.title, item.notes, item.listName, item.id].filter(Boolean).join("\n").toLowerCase();
}

function reminderScore(item: ReminderItem, filterTerms: string[]): number {
  const text = reminderSearchText(item);
  return filterTerms.reduce((score, term) => {
    const normalized = term.toLowerCase();
    if (!normalized) {
      return score;
    }
    if (text.includes(normalized)) {
      return score + normalized.length + 20;
    }
    return score + termsFrom(normalized).reduce((inner, word) => inner + (text.includes(word) ? 5 : 0), 0);
  }, 0);
}

function inDateRange(item: ReminderItem, dateRange: ReminderQuery["dateRange"]): boolean {
  if (!dateRange) {
    return true;
  }
  const due = item.dueDate ? new Date(item.dueDate) : null;
  if (!due || !Number.isFinite(due.getTime())) {
    return false;
  }
  return due >= new Date(`${dateRange.start}T00:00:00Z`) && due < new Date(`${dateRange.end}T00:00:00Z`);
}

function filterReminders(items: ReminderItem[], query: ReminderQuery, limit: number): ReminderItem[] {
  const active = items.filter((item) => item.isCompleted !== true && inDateRange(item, query.dateRange));
  if (query.filterTerms.length === 0) {
    return active.slice(0, limit);
  }
  return active
    .map((item) => ({ item, score: reminderScore(item, query.filterTerms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function formatReminderItems(items: ReminderItem[], query: ReminderQuery): string {
  if (items.length === 0) {
    if (query.filterTerms.length) {
      return query.dateRange
        ? `No reminders matched local filter: ${query.filterTerms.join(", ")} in ${query.dateRange.start} to ${query.dateRange.end}`
        : `No reminders matched local filter: ${query.filterTerms.join(", ")}`;
    }
    return query.dateRange
      ? `No reminders matched local date range: ${query.dateRange.start} to ${query.dateRange.end}`
      : "No reminders returned by remindctl.";
  }
  return items
    .map((item, index) => [
      `${index + 1}. ${item.title || "Untitled reminder"}`,
      item.dueDate ? `   Due: ${item.dueDate}` : "",
      item.listName ? `   List: ${item.listName}` : "",
      item.priority && item.priority !== "none" ? `   Priority: ${item.priority}` : "",
      item.notes ? `   Description: ${item.notes}` : "",
      item.id ? `   Reminder ID: ${item.id}` : "",
    ].filter(Boolean).join("\n"))
    .join("\n\n");
}

async function loadReminders(input: PcrToolContextInput, query: ReminderQuery): Promise<ContextBlock[]> {
  const config = input.toolConfig;
  const reminders = typeof config.reminders === "object" && config.reminders ? config.reminders as Record<string, unknown> : {};
  if (!bool(reminders.enabled)) {
    return [];
  }
  try {
    const { stdout } = await execFileAsync(query.command, query.args, {
      timeout: Number(reminders.timeoutMs ?? 5000),
      maxBuffer: Number(reminders.maxBuffer ?? 2_000_000),
    });
    const limit = Number(reminders.limit ?? 12);
    const parsed = parseReminderItems(stdout.trim());
    const content = parsed.length > 0
      ? truncateToTokenBudget(formatReminderItems(filterReminders(parsed, query, limit), query), Number(reminders.maxTokens ?? 900))
      : truncateToTokenBudget(stdout.trim(), Number(reminders.maxTokens ?? 900));
    return content ? [{
      id: "planner-reminders",
      label: `Local reminders: ${query.label}`,
      kind: "schedule",
      content,
      metadata: { role: "plannerReminders", command: commandText(query), horizon: query.label, filterTerms: query.filterTerms, dateRange: query.dateRange },
    }] : [];
  } catch (error) {
    return [{
      id: "planner-reminders-unavailable",
      label: "Local reminders unavailable",
      kind: "schedule",
      content: `remindctl could not be read: ${(error as Error).message}`,
      metadata: { role: "plannerWarning" },
    }];
  }
}

async function walkDocs(folder: string, limit = 80): Promise<string[]> {
  const output: string[] = [];
  async function visit(dir: string): Promise<void> {
    if (output.length >= limit) {
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
      } else if (entry.isFile() && DOC_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        output.push(file);
      }
      if (output.length >= limit) {
        break;
      }
    }
  }
  await visit(folder);
  return output;
}

function scoreDoc(text: string, terms: string[]): number {
  const lowered = text.toLowerCase();
  return terms.reduce((score, term) => score + (lowered.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"))?.length ?? 0), 0);
}

function relevantSnippet(text: string, terms: string[]): string {
  if (estimateTokens(text) <= 700) {
    return text.trim();
  }
  const lines = text.split(/\r?\n/);
  const matches = lines
    .map((line, index) => ({ line, index, score: scoreDoc(line, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .sort((a, b) => a.index - b.index);
  const snippet = matches.length > 0
    ? matches.map((item) => item.line.trim()).filter(Boolean).join("\n")
    : lines.slice(0, 20).join("\n");
  return truncateToTokenBudget(`Prompt-relevant excerpts:\n${snippet}`, 700);
}

async function loadFolderDocs(input: PcrToolContextInput): Promise<ContextBlock[]> {
  const docs = typeof input.toolConfig.docs === "object" && input.toolConfig.docs ? input.toolConfig.docs as Record<string, unknown> : {};
  const folder = typeof docs.folder === "string" ? docs.folder : "";
  if (!folder) {
    return [];
  }
  const resolved = resolve(input.cwd, folder);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isDirectory()) {
    return [{
      id: "planner-doc-folder-missing",
      label: "Planner docs folder missing",
      kind: "file",
      content: `Configured planning docs folder does not exist: ${resolved}`,
      metadata: { role: "plannerWarning" },
    }];
  }
  const terms = termsFrom(`${input.rawText} ${input.task}`);
  const ranked = await Promise.all((await walkDocs(resolved)).map(async (file) => {
    const text = await readFile(file, "utf8");
    return { file, text, score: scoreDoc(`${basename(file)}\n${text}`, terms) };
  }));
  return ranked
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(docs.limit ?? 3))
    .map((item) => ({
      id: `planner-doc-${item.file}`,
      label: `Planning doc: ${basename(item.file)}`,
      kind: "file",
      content: relevantSnippet(item.text, terms),
      metadata: { role: "plannerDoc", path: item.file, score: item.score },
    }));
}

export const plannerTemplateMarkdown = `---
id: analysis.planner
name: Planner Prompt
mode: analysis
description: Compiles planning prompts using reminders and local planning documents when configured.
outputFormat: markdown
---

# Task

{{task}}

# Relevant Context

{{contextSummary}}

# Schedule And Reminders

{{schedule}}

# Current Goals

{{goals}}

# Planning Documents

{{projectContext}}

# Preferences

{{preferences}}

# Instructions

Create a concrete plan that respects deadlines, constraints, current commitments, and available context.
Use the selected reminder command and planning scenario instructions when present.
Identify dependencies, risks, sequencing, and the next three actions.
If context is missing or stale, call that out explicitly.
Return a structured markdown plan.
`;

export const plannerTool: PcrTool = {
  metadata: {
    id: "planner",
    packageName: "@pcr/tool-planner",
    name: "Planner",
    description: "Compile planning prompts with optional Reminders and local folder context.",
    modes: ["analysis", "research"],
    intents: ["planning"],
    triggers: ["plan", "planner", "planning", "roadmap", "prioritize", "schedule", "next actions"],
    contextKinds: ["goal", "schedule", "file", "preference", "history"],
    defaultEnabled: true,
    activation: "hybrid",
  },
  profile: {
    id: "planner",
    name: "Planner",
    tone: "direct",
    verbosity: "medium",
    strictness: "high",
    defaults: {
      askClarifyingQuestions: false,
      allowWeb: false,
      requireCitations: false,
      requirePlan: true,
      requireTests: false,
    },
    rules: [
      "Prefer concrete next actions.",
      "Surface constraints and risks.",
      "Use local reminders and docs only when available.",
    ],
  },
  template: {
    id: "analysis.planner",
    name: "Planner Prompt",
    mode: "analysis",
    description: "Compiles planning prompts using reminders and local planning documents when configured.",
    outputFormat: "markdown",
    body: plannerTemplateMarkdown.replace(/^---[\s\S]*?---\n/, "").trim(),
  },
  async prepareContext(input) {
    const reminders = typeof input.toolConfig.reminders === "object" && input.toolConfig.reminders ? input.toolConfig.reminders as Record<string, unknown> : {};
    const query = resolveReminderQuery(input.rawText, reminders);
    return [
      ...plannerScenario(input, query),
      ...(await loadReminders(input, query)),
      ...(await loadFolderDocs(input)),
    ];
  },
};

export const pcrTool = plannerTool;
