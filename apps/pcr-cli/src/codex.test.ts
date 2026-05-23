import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { installCodexDesktop, runCodexPromptHook, setCodexAutoMode, setCodexPromptHook } from "./index.js";

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe("codex desktop installer", () => {
  it("installs MCP config and quiet trigger idempotently", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "pcr-codex-"));

    const first = await installCodexDesktop({ codexHome });
    expect(first.changedConfig).toBe(true);
    expect(first.changedAgents).toBe(true);

    const config = await readFile(join(codexHome, "config.toml"), "utf8");
    const agents = await readFile(join(codexHome, "AGENTS.md"), "utf8");
    expect(config).toContain("[mcp_servers.pcr]");
    expect(agents).toContain("Do not announce that you are using PCR.");

    const second = await installCodexDesktop({ codexHome });
    expect(second.changedConfig).toBe(false);
    expect(second.changedAgents).toBe(false);
  });

  it("toggles auto mode", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "pcr-codex-auto-"));
    await installCodexDesktop({ codexHome });

    const on = await setCodexAutoMode({ codexHome, enabled: true });
    expect(on.changed).toBe(true);
    let agents = await readFile(join(codexHome, "AGENTS.md"), "utf8");
    expect(agents).toContain("PCR auto mode is enabled.");

    const onAgain = await setCodexAutoMode({ codexHome, enabled: true });
    expect(onAgain.changed).toBe(false);

    const off = await setCodexAutoMode({ codexHome, enabled: false });
    expect(off.changed).toBe(true);
    agents = await readFile(join(codexHome, "AGENTS.md"), "utf8");
    expect(agents).not.toContain("PCR auto mode is enabled.");
    expect(agents).toContain("PCR Prompt Compiler");
  });

  it("toggles the deterministic UserPromptSubmit hook", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "pcr-codex-hook-"));

    const on = await setCodexPromptHook({ codexHome, enabled: true });
    expect(on.changed).toBe(true);
    let hooks = await readFile(join(codexHome, "hooks.json"), "utf8");
    expect(hooks).toContain("UserPromptSubmit");
    expect(hooks).toContain("codex prompt-hook");

    const onAgain = await setCodexPromptHook({ codexHome, enabled: true });
    expect(onAgain.changed).toBe(false);

    const off = await setCodexPromptHook({ codexHome, enabled: false });
    expect(off.changed).toBe(true);
    hooks = await readFile(join(codexHome, "hooks.json"), "utf8");
    expect(hooks).not.toContain("codex prompt-hook");
  });

  it("emits no hook context when PCR skips", async () => {
    const userDir = await mkdtemp(join(tmpdir(), "pcr-hook-skip-"));
    const previousUserDir = process.env.PCR_USER_DIR;
    const previousSkipEnv = process.env.PCR_SKIP_ENV_FILE;
    const previousIntelligence = process.env.PCR_INTELLIGENCE_ENABLED;
    const previousHookDaemon = process.env.PCR_HOOK_USE_DAEMON;

    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_SKIP_ENV_FILE = "1";
    process.env.PCR_INTELLIGENCE_ENABLED = "0";
    process.env.PCR_HOOK_USE_DAEMON = "0";
    try {
      const result = await runCodexPromptHook(JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: process.cwd(),
        prompt: "what is 2 + 2?",
      }));
      expect(result).toBe("");
    } finally {
      restoreEnv("PCR_USER_DIR", previousUserDir);
      restoreEnv("PCR_SKIP_ENV_FILE", previousSkipEnv);
      restoreEnv("PCR_INTELLIGENCE_ENABLED", previousIntelligence);
      restoreEnv("PCR_HOOK_USE_DAEMON", previousHookDaemon);
    }
  });

  it("does not run local fallback after a reachable daemon compile fails", async () => {
    const userDir = await mkdtemp(join(tmpdir(), "pcr-hook-daemon-fail-"));
    const previousUserDir = process.env.PCR_USER_DIR;
    const previousSkipEnv = process.env.PCR_SKIP_ENV_FILE;
    const previousHookDaemon = process.env.PCR_HOOK_USE_DAEMON;
    const previousDaemonUrl = process.env.PCR_DAEMON_URL;
    const previousFetch = globalThis.fetch;

    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_SKIP_ENV_FILE = "1";
    delete process.env.PCR_HOOK_USE_DAEMON;
    process.env.PCR_DAEMON_URL = "http://127.0.0.1:4317";
    globalThis.fetch = (async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (href.endsWith("/health")) {
        return new Response("ok", { status: 200 });
      }
      throw new Error("daemon compile failed");
    }) as typeof fetch;

    try {
      const result = await runCodexPromptHook(JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: process.cwd(),
        prompt: "plan this week",
      }));
      expect(result).toContain("no local fallback was run");
    } finally {
      globalThis.fetch = previousFetch;
      restoreEnv("PCR_USER_DIR", previousUserDir);
      restoreEnv("PCR_SKIP_ENV_FILE", previousSkipEnv);
      restoreEnv("PCR_HOOK_USE_DAEMON", previousHookDaemon);
      restoreEnv("PCR_DAEMON_URL", previousDaemonUrl);
    }
  });

  it("emits compiled prompt context when a tool matches", async () => {
    const userDir = await mkdtemp(join(tmpdir(), "pcr-hook-match-"));
    await mkdir(join(userDir, "context"), { recursive: true });
    await writeFile(join(userDir, "config.yaml"), "tools:\n  enabled:\n    - progress-assessment\n");

    const previousUserDir = process.env.PCR_USER_DIR;
    const previousSkipEnv = process.env.PCR_SKIP_ENV_FILE;
    const previousIntelligence = process.env.PCR_INTELLIGENCE_ENABLED;
    const previousDisableHistory = process.env.PCR_DISABLE_HISTORY;
    const previousHookDaemon = process.env.PCR_HOOK_USE_DAEMON;

    process.env.PCR_USER_DIR = userDir;
    process.env.PCR_SKIP_ENV_FILE = "1";
    process.env.PCR_INTELLIGENCE_ENABLED = "0";
    process.env.PCR_DISABLE_HISTORY = "1";
    process.env.PCR_HOOK_USE_DAEMON = "0";
    try {
      const result = await runCodexPromptHook(JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: process.cwd(),
        prompt: "help me assess my progress against goals this week",
      }));
      const parsed = JSON.parse(result) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
      expect(parsed.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
      expect(parsed.hookSpecificOutput.additionalContext).toContain("PCR Prompt Compiler already ran");
      expect(parsed.hookSpecificOutput.additionalContext).toContain("progress assessment");
    } finally {
      restoreEnv("PCR_USER_DIR", previousUserDir);
      restoreEnv("PCR_SKIP_ENV_FILE", previousSkipEnv);
      restoreEnv("PCR_INTELLIGENCE_ENABLED", previousIntelligence);
      restoreEnv("PCR_DISABLE_HISTORY", previousDisableHistory);
      restoreEnv("PCR_HOOK_USE_DAEMON", previousHookDaemon);
    }
  });
});
