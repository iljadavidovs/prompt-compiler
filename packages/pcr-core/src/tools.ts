import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { codingTool } from "@pcr/tool-coding";
import { grammarTool } from "@pcr/tool-grammar";
import { plannerTool } from "@pcr/tool-planner";
import { progressAssessmentTool } from "@pcr/tool-progress-assessment";
import type { IntentClassification } from "@pcr/intelligence";
import {
  PCR_PROJECT_DIR_NAME,
  PCR_USER_DIR_NAME,
  PcrConfigSchema,
  type PcrConfig,
  type PcrTool,
} from "@pcr/shared";
import YAML from "yaml";

const AVAILABLE_TOOLS = [progressAssessmentTool, grammarTool, plannerTool, codingTool];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readConfig(path: string): Promise<PcrConfig> {
  if (!(await exists(path))) {
    return {};
  }
  return PcrConfigSchema.parse(YAML.parse(await readFile(path, "utf8")) ?? {});
}

export async function resolveConfig(cwd: string, userDir = join(homedir(), PCR_USER_DIR_NAME)): Promise<PcrConfig> {
  const userConfig = await readConfig(join(userDir, "config.yaml"));
  const projectConfig = await readConfig(join(cwd, PCR_PROJECT_DIR_NAME, "config.yaml"));
  return {
    ...userConfig,
    ...projectConfig,
    tools: {
      enabled: projectConfig.tools?.enabled ?? userConfig.tools?.enabled ?? [],
      config: {
        ...(userConfig.tools?.config ?? {}),
        ...(projectConfig.tools?.config ?? {}),
      },
    },
  };
}

export function listAvailableTools(): PcrTool[] {
  return [...AVAILABLE_TOOLS];
}

export function listEnabledTools(config: PcrConfig): PcrTool[] {
  const enabled = new Set(config.tools?.enabled ?? []);
  return AVAILABLE_TOOLS.filter((tool) => enabled.has(tool.metadata.id) || enabled.has(tool.metadata.packageName));
}

export function toolConfig(config: PcrConfig, tool: PcrTool): Record<string, unknown> {
  return {
    ...(config.tools?.config?.[tool.metadata.packageName] ?? {}),
    ...(config.tools?.config?.[tool.metadata.id] ?? {}),
  };
}

function includesAny(text: string, values: string[]): boolean {
  const lowered = text.toLowerCase();
  return values.some((value) => lowered.includes(value.toLowerCase()));
}

function configuredKeywords(config: PcrConfig, tool: PcrTool): string[] {
  const keywords = toolConfig(config, tool).keywords;
  return Array.isArray(keywords) ? keywords.filter((item): item is string => typeof item === "string") : [];
}

function configBool(config: PcrConfig, tool: PcrTool, key: string): boolean {
  const value = toolConfig(config, tool)[key];
  return value === true || value === "true" || value === 1;
}

function hasActivationSignal(rawText: string, tool: PcrTool, config: PcrConfig): boolean {
  if (tool.metadata.activation === "project" && configBool(config, tool, "autoActivate")) {
    return true;
  }
  const intentPhrases = tool.metadata.intents.map((intent) => intent.replace(/[-_]+/g, " "));
  return includesAny(rawText, [...tool.metadata.triggers, ...configuredKeywords(config, tool), ...intentPhrases]);
}

function triggerScore(rawText: string, trigger: string): number {
  const lowered = rawText.toLowerCase();
  const normalized = trigger.toLowerCase().trim();
  if (!normalized || !lowered.includes(normalized)) {
    return 0;
  }
  if (new RegExp(`^\\s*${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\b`).test(lowered)) {
    return 90;
  }
  return Math.min(60, 20 + normalized.length);
}

function toolScore(classification: IntentClassification, tool: PcrTool, rawText: string, config: PcrConfig): number {
  if (!hasActivationSignal(rawText, tool, config)) {
    return 0;
  }
  const triggers = [...tool.metadata.triggers, ...configuredKeywords(config, tool)];
  const classificationText = [
    classification.intent,
    classification.taskRewrite,
    ...classification.contextQueries,
  ].join(" ").toLowerCase();

  let score = 0;
  if (classification.adapter !== "skip" && tool.metadata.intents.includes(classification.intent)) {
    score += 100;
  }
  if (tool.metadata.modes.includes(classification.mode)) {
    score += 35;
  }
  if (rawText.toLowerCase().includes(tool.metadata.id.toLowerCase()) || rawText.toLowerCase().includes(tool.metadata.name.toLowerCase())) {
    score += 80;
  }
  if (tool.metadata.id === "planner" && /^\s*(plan|planner|planning|prioritize|roadmap)\b/i.test(rawText)) {
    score += 90;
  }
  score += triggers.reduce((total, trigger) => total + triggerScore(rawText, trigger), 0);
  score += triggers.some((trigger) => classificationText.includes(trigger.toLowerCase())) ? 25 : 0;
  return score;
}

export function selectTool(classification: IntentClassification, enabledTools: PcrTool[], rawText = "", config: PcrConfig = {}): PcrTool | null {
  const ranked = enabledTools
    .map((tool) => ({ tool, score: toolScore(classification, tool, rawText, config) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.tool ?? null;
}

export function enabledToolMetadata(tools: PcrTool[], config: PcrConfig = {}) {
  return tools.map((tool) => ({
    id: tool.metadata.id,
    name: tool.metadata.name,
    description: tool.metadata.description,
    modes: tool.metadata.modes,
    intents: tool.metadata.intents,
    triggers: [...tool.metadata.triggers, ...configuredKeywords(config, tool)],
    contextKinds: tool.metadata.contextKinds,
  }));
}

export async function getToolStates(cwd: string, userDir?: string) {
  const config = await resolveConfig(cwd, userDir);
  const enabled = new Set(config.tools?.enabled ?? []);
  return listAvailableTools().map((tool) => ({
    ...tool.metadata,
    enabled: enabled.has(tool.metadata.id) || enabled.has(tool.metadata.packageName),
    config: toolConfig(config, tool),
  }));
}
