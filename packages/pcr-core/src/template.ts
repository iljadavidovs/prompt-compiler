import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import {
  DEFAULT_TEMPLATE_ID,
  PCR_PROJECT_DIR_NAME,
  PCR_USER_DIR_NAME,
  type PcrTemplate,
} from "@pcr/shared";
import { BUILTIN_TEMPLATE, BUILTIN_TEMPLATES } from "./builtins.js";

interface TemplateFrontmatter {
  id?: string;
  name?: string;
  mode?: PcrTemplate["mode"];
  description?: string;
  outputFormat?: PcrTemplate["outputFormat"];
}

export function parseMarkdownTemplate(markdown: string): PcrTemplate {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Template must include YAML frontmatter.");
  }

  const frontmatter = YAML.parse(match[1] ?? "") as TemplateFrontmatter;
  const body = (match[2] ?? "").trim();
  if (!frontmatter.id || !frontmatter.name || !frontmatter.mode || !frontmatter.outputFormat) {
    throw new Error("Template frontmatter requires id, name, mode, and outputFormat.");
  }

  return {
    id: frontmatter.id,
    name: frontmatter.name,
    mode: frontmatter.mode,
    description: frontmatter.description,
    outputFormat: frontmatter.outputFormat,
    body,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveTemplate(options: {
  templateId?: string;
  mode?: PcrTemplate["mode"];
  cwd: string;
}): Promise<PcrTemplate> {
  const templateId = options.templateId ?? (options.mode === "research" ? DEFAULT_TEMPLATE_ID : undefined);
  const candidateIds = templateId ? [templateId] : [DEFAULT_TEMPLATE_ID];
  const templateDirs = [
    join(options.cwd, PCR_PROJECT_DIR_NAME, "templates"),
    join(homedir(), PCR_USER_DIR_NAME, "templates"),
  ];

  for (const id of candidateIds) {
    for (const dir of templateDirs) {
      for (const extension of [".md", ".markdown"]) {
        const file = join(dir, `${id}${extension}`);
        if (await exists(file)) {
          return parseMarkdownTemplate(await readFile(file, "utf8"));
        }
      }
    }
  }

  const builtin = BUILTIN_TEMPLATES.find((template) => template.id === templateId || template.mode === options.mode);
  return builtin ?? BUILTIN_TEMPLATE;
}

export function listBuiltinTemplates(): PcrTemplate[] {
  return [...BUILTIN_TEMPLATES];
}

export function renderTemplate(template: PcrTemplate, vars: Record<string, unknown>): string {
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (Array.isArray(value)) {
      return value.length ? value.map((item) => String(item)).join("\n") : "- None found.";
    }
    if (value === undefined || value === null || value === "") {
      return "- None found.";
    }
    return String(value);
  }).trim();
}

