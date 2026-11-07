import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// Only synthetic defaults, disposable SQLite, and test-owned loopback listeners.
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), "pcr-smoke-"));
const project = join(fixture, "project");
const path = process.env.PATH;
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, {
  PATH: path,
  HOME: join(fixture, "home"),
  PCR_USER_DIR: join(fixture, "user"),
  PCR_DB_PATH: join(fixture, "user", "pcr.sqlite"),
  PCR_SKIP_ENV_FILE: "1",
  PCR_INTELLIGENCE_ENABLED: "0",
  PCR_INTELLIGENCE_PROVIDER: "none",
});
await mkdir(project, { recursive: true });
await mkdir(process.env.HOME, { recursive: true });
const rawText = "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress";

function cli(args, input) {
  const command = [join(root, "apps/pcr-cli/dist/bin.js"), ...args];
  const result = spawnSync(process.execPath, command, {
    cwd: project, env: process.env, input, encoding: "utf8", timeout: 20000,
  });
  console.log(JSON.stringify({ command: [process.execPath, ...command], exitStatus: result.status,
    stdoutBytes: Buffer.byteLength(result.stdout ?? ""), stderr: result.stderr }));
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

let httpServer;
let mcp;
try {
  cli(["init"]);
  cli(["init"]);
  const indexed = cli(["context", "index"]);
  assert.match(indexed, /Indexed 6 file\(s\), 6 chunk\(s\)/);
  const matches = JSON.parse(cli(["context", "search", "goals schedule progress", "--json"]));
  assert.ok(matches.length > 0);
  const compiled = JSON.parse(cli(["compile", rawText, "--json", "--trace"]));
  assert.equal(compiled.metadata.skipped, false);
  assert.equal(compiled.metadata.selectedToolId, "progress-assessment");
  assert.match(compiled.prompt, /Finish PCR V0/);
  assert.ok(compiled.promptIr);
  assert.ok(compiled.contextPack.goals.length);
  assert.ok(compiled.trace.steps.length);
  const repeated = JSON.parse(cli(["compile", rawText, "--json"]));
  assert.equal(repeated.prompt, compiled.prompt);
  const skipped = JSON.parse(cli(["compile", "--stdin", "--json"], "what is 2 + 2?"));
  assert.equal(skipped.metadata.skipped, true);
  assert.equal(skipped.prompt, "");
  const compileId = compiled.metadata.compileId;
  const feedback = JSON.parse(cli(["feedback", compileId, "--rating", "like", "--comment", "Useful structure", "--json"]));
  assert.equal(feedback.rating, "like");
  assert.ok(JSON.parse(cli(["history", "--json"])).some(row => row.compileId === compileId));
  console.log(JSON.stringify({ check: "CLI init/index/FTS/compile/JSON/trace/determinism/skip/history/feedback", status: "PASS",
    indexed: indexed.trim(), searchResults: matches.length, traceSteps: compiled.trace.steps.map(step => step.name) }));

  const { createPcrStore } = await import("../packages/pcr-store/dist/index.js");
  const store = createPcrStore({ dbPath: process.env.PCR_DB_PATH });
  try {
    assert.equal(store.database.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(store.database.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(store.database.prepare("SELECT max(version) AS version FROM schema_migrations").get().version, 1);
    const fts = store.database.prepare("SELECT count(*) AS count FROM context_chunks_fts WHERE context_chunks_fts MATCH ?").get("goals");
    assert.ok(fts.count > 0);
    assert.equal(store.listFeedback(compileId).length, 1);
    console.log(JSON.stringify({ check: "native SQLite/migration/integrity/foreign keys/FTS5/feedback", status: "PASS", ftsMatches: fts.count }));
  } finally {
    store.close();
  }

  const { startServer } = await import("../apps/pcrd/dist/index.js");
  httpServer = await startServer({ port: 0 });
  assert.equal(httpServer.server.address().address, "127.0.0.1");
  const responses = [];
  async function http(route, body) {
    const response = await fetch(httpServer.url + route, {
      ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    responses.push({ route, status: response.status, type: response.headers.get("content-type") });
    assert.equal(response.status, 200, route);
    return response;
  }
  assert.equal((await (await http("/health")).json()).ok, true);
  assert.ok((await (await http("/v1/context/index", { cwd: project })).json()).indexedFiles > 0);
  assert.ok((await (await http("/v1/context/search?q=goals")).json()).length);
  const httpCompile = await (await http("/v1/compile", { rawText, cwd: project })).json();
  assert.equal(httpCompile.metadata.selectedToolId, "progress-assessment");
  assert.match(httpCompile.prompt, /Finish PCR V0/);
  await http("/v1/history/" + httpCompile.metadata.compileId);
  await http("/v1/history/" + httpCompile.metadata.compileId + "/feedback", { rating: "like" });
  for (const route of ["/v1/history", "/v1/templates", "/v1/profiles", "/v1/tools", "/v1/settings"]) await http(route);
  for (const route of ["/dashboard/", "/dashboard/history/", "/dashboard/tools/", "/dashboard/settings/"]) {
    assert.match(await (await http(route)).text(), /<html/i);
  }
  assert.match(await (await http("/dashboard/assets/dashboard.js")).text(), /renderHistory/);
  assert.ok((await (await http("/dashboard/assets/dashboard.css")).text()).length > 100);
  console.log(JSON.stringify({ check: "HTTP health/API flow/dashboard pages and assets", status: "PASS", responses }));
  await httpServer.close();
  httpServer = undefined;

  const mcpCommand = [resolve(root, "apps/pcr-mcp/dist/bin.js")];
  mcp = spawn(process.execPath, mcpCommand, { cwd: project, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(mcp, "exit");
  let stderr = "";
  mcp.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  const lines = createInterface({ input: mcp.stdout });
  let nextId = 0;
  const pending = new Map();
  lines.on("line", line => {
    const message = JSON.parse(line); // Any non-protocol stdout fails this check.
    pending.get(message.id)?.(message);
  });
  async function request(method, params = {}) {
    const id = ++nextId;
    const response = await new Promise((resolveResponse, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("MCP timeout: " + method)); }, 10000);
      pending.set(id, message => { clearTimeout(timer); pending.delete(id); resolveResponse(message); });
      mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
    assert.equal(response.error, undefined, JSON.stringify(response.error));
    return response.result;
  }
  const initialized = await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pcr-linux-smoke", version: "1" } });
  assert.equal(initialized.serverInfo.name, "pcr-mcp");
  mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const tools = (await request("tools/list")).tools.map(tool => tool.name).sort();
  assert.deepEqual(tools, ["pcr_add_feedback", "pcr_compile", "pcr_context_search", "pcr_get_history", "pcr_list_profiles", "pcr_list_templates"]);
  async function call(name, args = {}) {
    const response = await request("tools/call", { name, arguments: args });
    assert.notEqual(response.isError, true, JSON.stringify(response));
    return JSON.parse(response.content[0].text);
  }
  const mcpCompile = await call("pcr_compile", { rawText, cwd: project, intelligenceEnabled: false, intelligenceProvider: "none" });
  assert.equal(mcpCompile.skipped, false);
  assert.match(mcpCompile.prompt, /Finish PCR V0/);
  assert.ok((await call("pcr_context_search", { query: "goals", cwd: project })).length);
  assert.equal((await call("pcr_add_feedback", { compileId: mcpCompile.metadata.compileId, rating: "like" })).rating, "like");
  assert.ok((await call("pcr_list_templates")).length);
  assert.ok((await call("pcr_list_profiles")).length);
  assert.ok((await call("pcr_get_history")).some(row => row.compileId === mcpCompile.metadata.compileId));
  mcp.stdin.end();
  const [exitStatus, signal] = await Promise.race([
    exited,
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("MCP did not exit")), 10000); timer.unref(); }),
  ]);
  assert.equal(exitStatus, 0);
  assert.equal(signal, null);
  assert.equal(stderr, "");
  mcp = undefined;
  console.log(JSON.stringify({ check: "MCP stdio initialize/list/all six tools/clean exit", status: "PASS", command: [process.execPath, ...mcpCommand], tools, exitStatus, stderrBytes: 0 }));
  console.log(JSON.stringify({ status: "PASS", platform: process.platform, architecture: process.arch, node: process.version,
    credentialsInherited: false, codexRequired: false, providerCallsRequired: false, remindersEnabled: false }));
} finally {
  mcp?.kill();
  await httpServer?.close();
  await rm(fixture, { recursive: true, force: true });
}
