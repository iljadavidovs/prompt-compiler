import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { compilePrompt } from "@pcr/core";
import type { CompilePromptInput, CompilePromptOutput } from "@pcr/shared";

export interface CodexInstallOptions {
  codexHome?: string;
  quietTrigger?: boolean;
}

export interface CodexAutoOptions {
  codexHome?: string;
  enabled: boolean;
}

export interface CodexHookOptions {
  codexHome?: string;
  enabled: boolean;
}

export interface CodexInstallResult {
  configPath: string;
  agentsPath: string;
  changedConfig: boolean;
  changedAgents: boolean;
  backupPaths: string[];
}

interface CodexHooksFile {
  hooks?: Record<string, CodexHookGroup[]>;
}

interface CodexHookGroup {
  matcher?: string;
  hooks?: CodexHookHandler[];
}

interface CodexHookHandler {
  type?: string;
  command?: string;
  timeout?: number;
  statusMessage?: string;
}

interface UserPromptSubmitHookInput {
  cwd?: string;
  prompt?: string;
  hook_event_name?: string;
  turn_id?: string;
}

const MCP_BLOCK_HEADER = "[mcp_servers.pcr]";
const QUIET_START = "<!-- PCR_QUIET_TRIGGER_START -->";
const QUIET_END = "<!-- PCR_QUIET_TRIGGER_END -->";
const AUTO_START = "<!-- PCR_AUTO_MODE_START -->";
const AUTO_END = "<!-- PCR_AUTO_MODE_END -->";
const PCR_PROMPT_HOOK_COMMAND_MARKER = "codex prompt-hook";
const DEFAULT_DAEMON_URL = "http://127.0.0.1:4317";

function repoRoot(): string {
  return resolve(new URL("../../..", import.meta.url).pathname);
}

function mcpBlock(): string {
  return [
    MCP_BLOCK_HEADER,
    'command = "node"',
    `args = ["${join(repoRoot(), "apps", "pcr-mcp", "dist", "bin.js")}"]`,
  ].join("\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function promptHookCommand(): string {
  return [
    `cd ${shellQuote(repoRoot())}`,
    "&&",
    "node",
    shellQuote(join(repoRoot(), "apps", "pcr-cli", "dist", "bin.js")),
    PCR_PROMPT_HOOK_COMMAND_MARKER,
  ].join(" ");
}

function quietTriggerBlock(): string {
  return [
    QUIET_START,
    "## PCR Prompt Compiler",
    "",
    "When a user message starts with `$pcr`, call the MCP tool `pcr_compile`.",
    "",
    "Use:",
    "- `rawText`: the user message after removing the `$pcr` prefix",
    "- `cwd`: current workspace when relevant",
    "",
    "Return only the compiled prompt text unless the user explicitly asks for JSON, trace, metadata, or an explanation.",
    "",
    "Do not announce that you are using PCR.",
    "Do not describe the tool call.",
    "Do not add a preface before the compiled prompt.",
    "If PCR fails, briefly report the error and one concrete recovery step.",
    QUIET_END,
  ].join("\n");
}

function autoModeBlock(): string {
  return [
    AUTO_START,
    "## PCR Auto Mode",
    "",
    "PCR auto mode is enabled.",
    "",
    "For substantive user requests, call the MCP tool `pcr_compile` before answering and use the compiled prompt as local context for the response.",
    "",
    "Use:",
    "- `rawText`: the full user message",
    "- `cwd`: current workspace when relevant",
    "",
    "Do not announce that you are using PCR.",
    "Do not describe the tool call.",
    "If `pcr_compile` returns `skipped: true` or `metadata.skipped: true`, ignore PCR output and answer the original user request normally.",
    "Do not replace a direct answer with the compiled prompt unless the user starts the message with `$pcr`.",
    "",
    "Skip automatic PCR for:",
    "- simple acknowledgements or status checks",
    "- messages explicitly asking not to use PCR",
    "- requests about PCR setup/debugging itself",
    "- cases where the PCR MCP tool is unavailable",
    "",
    "If the user starts a message with `$pcr`, use the quiet `$pcr` behavior instead: return only the compiled prompt text.",
    AUTO_END,
  ].join("\n");
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function backup(path: string, content: string): Promise<string | null> {
  if (!content) {
    return null;
  }
  const backupPath = `${path}.pcr-backup-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`;
  await writeFile(backupPath, content);
  return backupPath;
}

function replaceQuietBlock(content: string, block: string): string {
  const pattern = new RegExp(`${QUIET_START}[\\s\\S]*?${QUIET_END}`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }
  return `${content.trimEnd()}\n\n${block}\n`;
}

function parseHooksFile(content: string): CodexHooksFile {
  if (!content.trim()) {
    return { hooks: {} };
  }
  const parsed = JSON.parse(content) as CodexHooksFile;
  if (!parsed || typeof parsed !== "object") {
    return { hooks: {} };
  }
  if (!parsed.hooks || typeof parsed.hooks !== "object") {
    parsed.hooks = {};
  }
  return parsed;
}

function isPcrPromptHook(handler: CodexHookHandler): boolean {
  return typeof handler.command === "string" && handler.command.includes(PCR_PROMPT_HOOK_COMMAND_MARKER);
}

function withoutPcrPromptHook(hooksFile: CodexHooksFile): CodexHooksFile {
  const hooks = hooksFile.hooks ?? {};
  const groups = hooks.UserPromptSubmit ?? [];
  const nextGroups = groups
    .map((group) => ({
      ...group,
      hooks: (group.hooks ?? []).filter((handler) => !isPcrPromptHook(handler)),
    }))
    .filter((group) => (group.hooks ?? []).length > 0);

  if (nextGroups.length > 0) {
    hooks.UserPromptSubmit = nextGroups;
  } else {
    delete hooks.UserPromptSubmit;
  }
  return { ...hooksFile, hooks };
}

function setPromptHook(content: string, enabled: boolean): string {
  const hooksFile = withoutPcrPromptHook(parseHooksFile(content));
  if (enabled) {
    hooksFile.hooks ??= {};
    hooksFile.hooks.UserPromptSubmit ??= [];
    hooksFile.hooks.UserPromptSubmit.push({
      hooks: [
        {
          type: "command",
          command: promptHookCommand(),
          timeout: 30,
        },
      ],
    });
  }
  return `${JSON.stringify(hooksFile, null, 2)}\n`;
}

function removeBlock(content: string, start: string, end: string): string {
  const pattern = new RegExp(`\\n?${start}[\\s\\S]*?${end}\\n?`, "m");
  return content.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function replaceAutoBlock(content: string, enabled: boolean): string {
  const withoutExisting = removeBlock(content, AUTO_START, AUTO_END);
  if (!enabled) {
    return withoutExisting.endsWith("\n") ? withoutExisting : `${withoutExisting}\n`;
  }
  return `${withoutExisting.trimEnd()}\n\n${autoModeBlock()}\n`;
}

function upsertMcpBlock(content: string, block: string): string {
  const pattern = /(?:^|\n)\[mcp_servers\.pcr\]\n[\s\S]*?(?=\n\[|$)/;
  if (pattern.test(content)) {
    return content.replace(pattern, `\n${block}\n`);
  }
  return `${content.trimEnd()}\n\n${block}\n`;
}

export async function installCodexDesktop(options: CodexInstallOptions = {}): Promise<CodexInstallResult> {
  const codexHome = options.codexHome ?? join(homedir(), ".codex");
  const configPath = join(codexHome, "config.toml");
  const agentsPath = join(codexHome, "AGENTS.md");
  const backupPaths: string[] = [];

  await mkdir(codexHome, { recursive: true });
  await mkdir(dirname(configPath), { recursive: true });

  const currentConfig = await readOptional(configPath);
  const block = mcpBlock();
  const nextConfig = upsertMcpBlock(currentConfig, block);
  const changedConfig = nextConfig !== currentConfig;
  if (changedConfig) {
    const backupPath = await backup(configPath, currentConfig);
    if (backupPath) {
      backupPaths.push(backupPath);
    }
    await writeFile(configPath, nextConfig);
  }

  let changedAgents = false;
  if (options.quietTrigger ?? true) {
    const currentAgents = await readOptional(agentsPath);
    const nextAgents = replaceQuietBlock(currentAgents, quietTriggerBlock());
    changedAgents = nextAgents !== currentAgents;
    if (changedAgents) {
      const backupPath = await backup(agentsPath, currentAgents);
      if (backupPath) {
        backupPaths.push(backupPath);
      }
      await writeFile(agentsPath, nextAgents);
    }
  }

  return {
    configPath,
    agentsPath,
    changedConfig,
    changedAgents,
    backupPaths,
  };
}

export async function setCodexAutoMode(options: CodexAutoOptions): Promise<{
  agentsPath: string;
  enabled: boolean;
  changed: boolean;
  backupPath?: string;
}> {
  const codexHome = options.codexHome ?? join(homedir(), ".codex");
  const agentsPath = join(codexHome, "AGENTS.md");
  await mkdir(codexHome, { recursive: true });

  const currentAgents = await readOptional(agentsPath);
  const nextAgents = replaceAutoBlock(currentAgents, options.enabled);
  const changed = nextAgents !== currentAgents;
  let backupPath: string | undefined;
  if (changed) {
    backupPath = await backup(agentsPath, currentAgents) ?? undefined;
    await writeFile(agentsPath, nextAgents);
  }

  return {
    agentsPath,
    enabled: options.enabled,
    changed,
    backupPath,
  };
}

export async function setCodexPromptHook(options: CodexHookOptions): Promise<{
  hooksPath: string;
  enabled: boolean;
  changed: boolean;
  backupPath?: string;
}> {
  const codexHome = options.codexHome ?? join(homedir(), ".codex");
  const hooksPath = join(codexHome, "hooks.json");
  await mkdir(codexHome, { recursive: true });

  const currentHooks = await readOptional(hooksPath);
  const nextHooks = setPromptHook(currentHooks, options.enabled);
  const changed = nextHooks !== currentHooks;
  let backupPath: string | undefined;
  if (changed) {
    backupPath = await backup(hooksPath, currentHooks) ?? undefined;
    await writeFile(hooksPath, nextHooks);
  }

  return {
    hooksPath,
    enabled: options.enabled,
    changed,
    backupPath,
  };
}

function hookAdditionalContext(prompt: string, compileId: string, mode: string, selectedToolId?: string, extraInstruction?: string): string {
  return [
    "PCR Prompt Compiler already ran for this turn before Codex processed the user prompt.",
    "Do not call `pcr_compile` again for this turn unless the user explicitly asks to rerun PCR or inspect PCR metadata.",
    "Use the compiled prompt below as local developer context while answering the user's original request.",
    "Do not mention PCR, this hook, or the compilation step unless the user asks about it.",
    extraInstruction ? extraInstruction : "",
    "",
    `PCR metadata: compileId=${compileId}; mode=${mode}; selectedToolId=${selectedToolId ?? "unknown"}`,
    "",
    "Compiled prompt:",
    prompt,
  ].join("\n");
}

function hookErrorMessage(message: string): string {
  return JSON.stringify({
    continue: true,
    systemMessage: `PCR prompt hook failed; continuing with the original prompt. ${message}`,
  });
}

function hookDaemonBaseUrl(): string {
  return (process.env.PCR_DAEMON_URL ?? DEFAULT_DAEMON_URL).replace(/\/$/, "");
}

async function isDaemonAvailable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(Number(process.env.PCR_HOOK_HEALTH_TIMEOUT_MS ?? 500)),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function compileWithDaemon(input: CompilePromptInput, baseUrl: string): Promise<CompilePromptOutput> {
  const timeoutMs = Number(process.env.PCR_HOOK_DAEMON_TIMEOUT_MS ?? 10000);
  const response = await fetch(`${baseUrl}/v1/compile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`pcrd returned ${response.status}: ${await response.text()}`);
  }
  return await response.json() as CompilePromptOutput;
}

async function compileForHook(input: CompilePromptInput): Promise<CompilePromptOutput> {
  if (process.env.PCR_HOOK_USE_DAEMON === "0") {
    return compilePrompt(input);
  }
  const baseUrl = hookDaemonBaseUrl();
  if (!(await isDaemonAvailable(baseUrl))) {
    return compilePrompt(input);
  }
  return compileWithDaemon(input, baseUrl);
}

async function compileForHookOrNull(input: CompilePromptInput): Promise<CompilePromptOutput | null> {
  try {
    return await compileForHook(input);
  } catch {
    return null;
  }
}

export async function runCodexPromptHook(stdinText: string): Promise<string> {
  let input: UserPromptSubmitHookInput;
  try {
    input = JSON.parse(stdinText || "{}") as UserPromptSubmitHookInput;
  } catch (error) {
    return hookErrorMessage(`Invalid hook input JSON: ${(error as Error).message}`);
  }

  const rawText = input.prompt?.trim();
  if (!rawText) {
    return "";
  }

  try {
    const compileInput: CompilePromptInput = {
      source: "codex",
      rawText,
      cwd: input.cwd,
      options: {
        maxContextTokens: 1200,
      },
    };
    const output = await compileForHookOrNull(compileInput);
    if (!output) {
      return hookErrorMessage("pcrd was reachable but compilation failed or timed out; no local fallback was run to avoid duplicate history.");
    }

    if (output.metadata.skipped || !output.prompt.trim()) {
      return "";
    }

    return JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: hookAdditionalContext(
          output.prompt,
          output.metadata.compileId,
          output.metadata.mode,
          output.metadata.selectedToolId,
          output.promptIr.metadata.templateId === "writing.grammar-fix"
            ? "The compiled prompt contains a corrected user prompt. Treat it as the effective user request and answer it directly. Ignore the original grammar-fix wrapper in the user's message."
            : undefined,
        ),
      },
    });
  } catch (error) {
    return hookErrorMessage((error as Error).message);
  }
}
