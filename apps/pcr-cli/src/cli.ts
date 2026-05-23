import { Command } from "commander";
import { compilePrompt } from "@pcr/core";
import { indexLocalContext } from "@pcr/context";
import { searchContext } from "@pcr/retrieval";
import { createPcrStore } from "@pcr/store";
import { resolvePcrPaths, type CompilePromptInput, type IntelligenceProviderName, type PromptMode } from "@pcr/shared";
import { installCodexDesktop, runCodexPromptHook, setCodexAutoMode, setCodexPromptHook } from "./codex.js";
import { startDaemon, statusDaemon, stopDaemon } from "./daemon.js";
import { startGateway, startGatewayServer, statusGateway, stopGateway } from "./gateway.js";
import { initPcr } from "./init.js";
import { listToolStates, setToolEnabled } from "./tool-config.js";

interface CliIo {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
  stdin: NodeJS.ReadStream;
}

function print(io: CliIo, value: string): void {
  io.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
}

function printError(io: CliIo, value: string): void {
  io.stderr.write(value.endsWith("\n") ? value : `${value}\n`);
}

async function readStdin(io: CliIo): Promise<string> {
  if (io.stdin.isTTY) {
    return "";
  }
  const chunks: Buffer[] = [];
  for await (const chunk of io.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function textFromArgs(textParts: string[] | undefined): string {
  return (textParts ?? []).join(" ").trim();
}

function dbPathFor(cwd?: string): string {
  return process.env.PCR_DB_PATH ?? resolvePcrPaths(cwd, process.env.PCR_USER_DIR).dbPath;
}

function openStore(cwd?: string) {
  return createPcrStore({ dbPath: dbPathFor(cwd) });
}

export function createCli(io: CliIo = { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin }): Command {
  const program = new Command();
  program
    .name("pcr")
    .description("Local-first prompt/context compiler")
    .version("0.1.0");

  program
    .command("init")
    .description("Create default PCR files in ~/.pcr")
    .option("--cwd <cwd>", "working directory")
    .action(async (options: { cwd?: string }) => {
      const result = await initPcr({ cwd: options.cwd });
      print(io, `Initialized PCR user directory: ${result.userDir}`);
      print(io, `Created or preserved ${result.files.length} default file(s).`);
    });

  program
    .command("compile")
    .description("Compile rough intent into a structured prompt")
    .argument("[text...]", "prompt intent text")
    .option("--stdin", "read prompt intent from stdin")
    .option("--mode <mode>", "prompt mode")
    .option("--template <templateId>", "template id")
    .option("--profile <profileId>", "profile id")
    .option("--cwd <cwd>", "working directory")
    .option("--max-context-tokens <tokens>", "context token budget")
    .option("--intelligence", "enable optional intelligence classifier")
    .option("--intelligence-provider <provider>", "intelligence provider: openai, deterministic, local, or none")
    .option("--intelligence-model <model>", "intelligence model, for example gpt-5.5")
    .option("--trace", "include compiler trace")
    .option("--json", "print full JSON output")
    .action(async (textParts: string[], options: Record<string, string | boolean | undefined>) => {
      const rawText = options.stdin ? await readStdin(io) : textFromArgs(textParts);
      if (!rawText) {
        throw new Error("compile requires text or --stdin input.");
      }

      const input: CompilePromptInput = {
        source: "cli",
        rawText,
        mode: options.mode as PromptMode | undefined,
        templateId: options.template as string | undefined,
        profileId: options.profile as string | undefined,
        cwd: options.cwd as string | undefined,
        options: {
          includeTrace: Boolean(options.trace),
          maxContextTokens: options.maxContextTokens
            ? Number(options.maxContextTokens)
            : undefined,
          intelligence: options.intelligence || options.intelligenceProvider || options.intelligenceModel
            ? {
                enabled: Boolean(options.intelligence),
                provider: options.intelligenceProvider as IntelligenceProviderName | undefined,
                model: options.intelligenceModel as string | undefined,
              }
            : undefined,
        },
      };
      const output = await compilePrompt(input);
      print(io, options.json ? JSON.stringify(output, null, 2) : output.prompt);
    });

  const context = program.command("context").description("Index and search local context");
  context
    .command("index")
    .description("Index user and project context files")
    .option("--cwd <cwd>", "working directory")
    .action(async (options: { cwd?: string }) => {
      const result = await indexLocalContext({ cwd: options.cwd, dbPath: dbPathFor(options.cwd) });
      print(io, `Indexed ${result.indexedFiles} file(s), ${result.indexedChunks} chunk(s).`);
    });

  const tools = program.command("tools").description("List and configure PCR tools");
  tools
    .command("list")
    .description("List available PCR tools")
    .option("--cwd <cwd>", "working directory")
    .option("--json", "print JSON")
    .action(async (options: { cwd?: string; json?: boolean }) => {
      const states = await listToolStates(options.cwd);
      if (options.json) {
        print(io, JSON.stringify(states, null, 2));
        return;
      }
      print(io, states.map((tool) => `${tool.enabled ? "enabled " : "disabled"}  ${tool.id}  ${tool.description}`).join("\n"));
    });

  tools
    .command("enable")
    .description("Enable a PCR tool")
    .argument("<toolId>", "tool id")
    .option("--cwd <cwd>", "working directory")
    .action(async (toolId: string, options: { cwd?: string }) => {
      const result = await setToolEnabled(toolId, true, options.cwd);
      print(io, `Enabled ${result.tool.id} in ${result.configPath}.`);
    });

  tools
    .command("disable")
    .description("Disable a PCR tool")
    .argument("<toolId>", "tool id")
    .option("--cwd <cwd>", "working directory")
    .action(async (toolId: string, options: { cwd?: string }) => {
      const result = await setToolEnabled(toolId, false, options.cwd);
      print(io, `Disabled ${result.tool.id} in ${result.configPath}.`);
    });

  context
    .command("search")
    .description("Search indexed local context")
    .argument("<query>", "search query")
    .option("--cwd <cwd>", "working directory")
    .option("--json", "print JSON")
    .option("--limit <limit>", "result limit", "10")
    .action(async (query: string, options: { cwd?: string; json?: boolean; limit: string }) => {
      const store = openStore(options.cwd);
      try {
        const results = searchContext(store, query, { limit: Number(options.limit) });
        if (options.json) {
          print(io, JSON.stringify(results, null, 2));
        } else {
          print(
            io,
            results
              .map((result) => `- [${result.kind}] ${result.label} (${result.score.toFixed(1)})\n${result.content}`)
              .join("\n\n") || "No results.",
          );
        }
      } finally {
        store.close();
      }
    });

  program
    .command("history")
    .description("List compilation history")
    .option("--cwd <cwd>", "working directory")
    .option("--json", "print JSON")
    .option("--limit <limit>", "result limit", "20")
    .action((options: { cwd?: string; json?: boolean; limit: string }) => {
      const store = openStore(options.cwd);
      try {
        const records = store.listCompilations(Number(options.limit));
        if (options.json) {
          print(io, JSON.stringify(records, null, 2));
        } else {
          print(
            io,
            records
              .map((record) => `${record.compileId}  ${record.createdAt}  ${record.mode}  ${record.rawText}`)
              .join("\n") || "No history.",
          );
        }
      } finally {
        store.close();
      }
    });

  program
    .command("feedback")
    .description("Attach feedback to a compilation")
    .argument("<compileId>", "compile id")
    .requiredOption("--rating <rating>", "like, dislike, or neutral")
    .option("--outcome <outcome>", "outcome tag")
    .option("--comment <comment>", "feedback comment")
    .option("--cwd <cwd>", "working directory")
    .option("--json", "print JSON")
    .action((compileId: string, options: { rating: "like" | "dislike" | "neutral"; outcome?: string; comment?: string; cwd?: string; json?: boolean }) => {
      const store = openStore(options.cwd);
      try {
        const feedback = store.addFeedback({
          compileId,
          rating: options.rating,
          outcome: options.outcome,
          comment: options.comment,
        });
        print(io, options.json ? JSON.stringify(feedback, null, 2) : `Recorded ${feedback.rating} feedback for ${compileId}.`);
      } finally {
        store.close();
      }
    });

  program
    .command("serve")
    .description("Start the local PCR HTTP daemon")
    .option("--port <port>", "port", "4317")
    .action(async (options: { port: string }) => {
      const pcrd = await import("@pcr/pcrd") as { startServer?: (options?: { port?: number }) => Promise<{ url: string }> };
      if (!pcrd.startServer) {
        throw new Error("pcrd startServer is not available yet.");
      }
      const server = await pcrd.startServer({ port: Number(options.port) });
      print(io, `PCR daemon listening at ${server.url}`);
    });

  const daemon = program.command("daemon").description("Manage the local PCR HTTP daemon as a background process");
  daemon
    .command("start")
    .description("Start pcrd in the background")
    .option("--cwd <cwd>", "working directory")
    .option("--port <port>", "port", "4317")
    .action(async (options: { cwd?: string; port: string }) => {
      const result = await startDaemon({ cwd: options.cwd, port: Number(options.port) });
      print(io, `${result.started ? "Started" : "Already running"} PCR daemon at ${result.url}.`);
      if (result.pid) {
        print(io, `PID: ${result.pid}`);
      }
      print(io, `Log: ${result.logPath}`);
    });

  daemon
    .command("stop")
    .description("Stop the background pcrd process")
    .action(async () => {
      const result = await stopDaemon();
      print(io, result.stopped ? `Stopped PCR daemon PID ${result.pid}.` : "No PCR daemon PID file was found.");
    });

  daemon
    .command("status")
    .description("Show background pcrd status")
    .option("--port <port>", "port", "4317")
    .option("--json", "print JSON")
    .action(async (options: { port: string; json?: boolean }) => {
      const result = await statusDaemon({ port: Number(options.port) });
      if (options.json) {
        print(io, JSON.stringify(result, null, 2));
        return;
      }
      print(io, `PCR daemon: ${result.running ? "running" : "stopped"}`);
      if (result.pid) {
        print(io, `PID: ${result.pid}`);
      }
      print(io, `PID file: ${result.pidPath}`);
      print(io, `Log: ${result.logPath}`);
    });

  const gateway = program.command("gateway").description("Manage the local pcr.lan gateway on port 80");
  gateway
    .command("serve")
    .description("Run the pcr.lan gateway in the foreground")
    .option("--port <port>", "port", "80")
    .option("--target <url>", "target PCR daemon URL", "http://127.0.0.1:4317")
    .action(async (options: { port: string; target: string }) => {
      const server = await startGatewayServer({ port: Number(options.port), target: options.target });
      print(io, `PCR gateway listening at ${server.url}`);
    });

  gateway
    .command("start")
    .description("Start the pcr.lan gateway in the background")
    .option("--port <port>", "port", "80")
    .option("--target <url>", "target PCR daemon URL", "http://127.0.0.1:4317")
    .action(async (options: { port: string; target: string }) => {
      const result = await startGateway({ port: Number(options.port), target: options.target });
      print(io, `${result.started ? "Started" : "Already running"} PCR gateway at ${result.url}.`);
      if (result.pid) {
        print(io, `PID: ${result.pid}`);
      }
      print(io, `Log: ${result.logPath}`);
    });

  gateway
    .command("stop")
    .description("Stop the background pcr.lan gateway")
    .action(async () => {
      const result = await stopGateway();
      print(io, result.stopped ? `Stopped PCR gateway PID ${result.pid}.` : "No PCR gateway PID file was found.");
    });

  gateway
    .command("status")
    .description("Show pcr.lan gateway status")
    .option("--port <port>", "port", "80")
    .option("--json", "print JSON")
    .action(async (options: { port: string; json?: boolean }) => {
      const result = await statusGateway({ port: Number(options.port) });
      if (options.json) {
        print(io, JSON.stringify(result, null, 2));
        return;
      }
      print(io, `PCR gateway: ${result.running ? "running" : "stopped"}`);
      if (result.pid) {
        print(io, `PID: ${result.pid}`);
      }
      print(io, `PID file: ${result.pidPath}`);
      print(io, `Log: ${result.logPath}`);
    });

  const codex = program.command("codex").description("Codex Desktop integration helpers");
  codex
    .command("install")
    .description("Install PCR MCP server and quiet $pcr trigger into Codex Desktop config")
    .option("--codex-home <path>", "Codex config directory")
    .option("--no-quiet-trigger", "do not install the quiet $pcr instruction")
    .action(async (options: { codexHome?: string; quietTrigger?: boolean }) => {
      const result = await installCodexDesktop({
        codexHome: options.codexHome,
        quietTrigger: options.quietTrigger,
      });
      print(io, `Codex config: ${result.configPath} (${result.changedConfig ? "updated" : "already configured"})`);
      if (options.quietTrigger !== false) {
        print(io, `Codex instructions: ${result.agentsPath} (${result.changedAgents ? "updated" : "already configured"})`);
      }
      if (result.backupPaths.length > 0) {
        print(io, `Backups: ${result.backupPaths.join(", ")}`);
      }
      print(io, "Restart Codex Desktop to load PCR.");
    });

  codex
    .command("auto")
    .description("Turn automatic PCR use in Codex Desktop on or off")
    .argument("<state>", "on or off")
    .option("--codex-home <path>", "Codex config directory")
    .action(async (state: string, options: { codexHome?: string }) => {
      if (!["on", "off"].includes(state)) {
        throw new Error("codex auto state must be 'on' or 'off'.");
      }
      const result = await setCodexAutoMode({
        codexHome: options.codexHome,
        enabled: state === "on",
      });
      print(io, `PCR auto mode ${result.enabled ? "enabled" : "disabled"} in ${result.agentsPath} (${result.changed ? "updated" : "already set"}).`);
      if (result.backupPath) {
        print(io, `Backup: ${result.backupPath}`);
      }
      print(io, "Restart Codex Desktop for the change to apply.");
    });

  codex
    .command("hook")
    .description("Turn deterministic Codex UserPromptSubmit PCR hook on or off")
    .argument("<state>", "on or off")
    .option("--codex-home <path>", "Codex config directory")
    .action(async (state: string, options: { codexHome?: string }) => {
      if (!["on", "off"].includes(state)) {
        throw new Error("codex hook state must be 'on' or 'off'.");
      }
      const result = await setCodexPromptHook({
        codexHome: options.codexHome,
        enabled: state === "on",
      });
      print(io, `PCR prompt hook ${result.enabled ? "enabled" : "disabled"} in ${result.hooksPath} (${result.changed ? "updated" : "already set"}).`);
      if (result.backupPath) {
        print(io, `Backup: ${result.backupPath}`);
      }
      print(io, "Restart Codex Desktop, then review/trust the hook with /hooks if prompted.");
    });

  codex
    .command("prompt-hook", { hidden: true })
    .description("Run the Codex UserPromptSubmit hook handler")
    .action(async () => {
      const result = await runCodexPromptHook(await readStdin(io));
      if (result) {
        print(io, result);
      }
    });

  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => io.stdout.write(str),
    writeErr: (str) => io.stderr.write(str),
  });

  program.showHelpAfterError();
  return program;
}

export async function runCli(argv = process.argv, io?: CliIo): Promise<void> {
  const program = createCli(io);
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if ((error as { code?: string }).code === "commander.helpDisplayed") {
      return;
    }
    printError(io ?? { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin }, (error as Error).message);
    process.exitCode = 1;
  }
}
