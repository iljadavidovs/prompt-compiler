import { createServer, request, type Server } from "node:http";
import { openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface GatewayPaths {
  pidPath: string;
  logPath: string;
}

export interface GatewayStartResult extends GatewayPaths {
  started: boolean;
  pid?: number;
  url: string;
}

export interface GatewayStopResult extends GatewayPaths {
  stopped: boolean;
  pid?: number;
}

export interface GatewayStatusResult extends GatewayPaths {
  running: boolean;
  pid?: number;
  health?: unknown;
}

export interface StartedGateway {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

function pcrHome(): string {
  if (process.env.PCR_USER_DIR) {
    return process.env.PCR_USER_DIR;
  }
  if (process.env.SUDO_USER && process.env.SUDO_USER !== "root") {
    return join("/Users", process.env.SUDO_USER, ".pcr");
  }
  return join(homedir(), ".pcr");
}

export function gatewayPaths(): GatewayPaths {
  const base = pcrHome();
  return {
    pidPath: join(base, "pcr-gateway.pid"),
    logPath: join(base, "pcr-gateway.log"),
  };
}

async function readPid(pidPath: string): Promise<number | null> {
  try {
    const pid = Number((await readFile(pidPath, "utf8")).trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function health(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForGateway(url: string, timeoutMs: number, child: ChildProcess): Promise<{ reachable: boolean; exitReason?: string }> {
  const startedAt = Date.now();
  let exitReason: string | undefined;
  let spawnError: Error | undefined;
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    exitReason = signal ? `exited with signal ${signal}` : `exited with code ${code ?? "unknown"}`;
  };
  const onError = (error: Error) => {
    spawnError = error;
  };

  child.once("exit", onExit);
  child.once("error", onError);
  await sleep(100);

  while (Date.now() - startedAt < timeoutMs) {
    if (spawnError) {
      return { reachable: false, exitReason: spawnError.message };
    }
    if (exitReason) {
      return { reachable: false, exitReason };
    }
    if (await reachable(url)) {
      child.off("exit", onExit);
      child.off("error", onError);
      return { reachable: true };
    }
    await sleep(150);
  }

  child.off("exit", onExit);
  child.off("error", onError);
  return { reachable: false, exitReason };
}

function gatewayUrl(host: string, port: number): string {
  return port === 80 ? `http://${host}` : `http://${host}:${port}`;
}

function requestPath(requestUrl: string | undefined): string {
  if (!requestUrl) {
    return "/";
  }
  if (requestUrl.startsWith("/")) {
    return requestUrl;
  }
  try {
    const parsed = new URL(requestUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

export function mapGatewayPath(path: string | undefined): string {
  const normalized = requestPath(path);
  if (normalized === "/") {
    return "/dashboard/history/";
  }
  if (normalized.startsWith("/?")) {
    return `/dashboard/history/${normalized.slice(1)}`;
  }
  return normalized;
}

export async function startGatewayServer(options: {
  host?: string;
  port?: number;
  target?: string;
} = {}): Promise<StartedGateway> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 80;
  const target = options.target ?? "http://127.0.0.1:4317";
  const targetBase = new URL(target);

  const server = createServer((incoming, outgoing) => {
    const targetUrl = new URL(mapGatewayPath(incoming.url), targetBase);
    const proxy = request({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: incoming.method,
      headers: {
        ...incoming.headers,
        host: targetUrl.host,
      },
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });

    proxy.on("error", () => {
      if (!outgoing.headersSent) {
        outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      outgoing.end(`PCR daemon is not reachable at ${target}.\n`);
    });

    incoming.pipe(proxy);
  });

  await new Promise<void>((resolveStart, rejectStart) => {
    const onError = (error: Error) => rejectStart(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolveStart();
    });
  });

  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  return {
    server,
    url: gatewayUrl(host, resolvedPort),
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    }),
  };
}

export async function startGateway(options: { port?: number; target?: string } = {}): Promise<GatewayStartResult> {
  const paths = gatewayPaths();
  const port = options.port ?? 80;
  const listenUrl = `http://127.0.0.1:${port}`;
  const url = gatewayUrl("127.0.0.1", port);
  await mkdir(dirname(paths.pidPath), { recursive: true });

  const existingPid = await readPid(paths.pidPath);
  if (existingPid && isRunning(existingPid)) {
    return { ...paths, started: false, pid: existingPid, url };
  }

  const out = openSync(paths.logPath, "a");
  const binPath = resolve(fileURLToPath(new URL("./bin.js", import.meta.url)));
  const child = spawn(process.execPath, [
    binPath,
    "gateway",
    "serve",
    "--port",
    String(port),
    "--target",
    options.target ?? "http://127.0.0.1:4317",
  ], {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: ["ignore", out, out],
  });
  child.unref();
  if (!child.pid) {
    throw new Error("Failed to start PCR gateway process.");
  }
  await writeFile(paths.pidPath, String(child.pid));
  const ready = await waitForGateway(listenUrl, 3000, child);
  if (!ready.reachable) {
    await rm(paths.pidPath, { force: true });
    throw new Error(`PCR gateway did not become reachable at ${url}${ready.exitReason ? ` (${ready.exitReason})` : ""}. See log: ${paths.logPath}`);
  }
  return { ...paths, started: true, pid: child.pid, url };
}

export async function stopGateway(): Promise<GatewayStopResult> {
  const paths = gatewayPaths();
  const pid = await readPid(paths.pidPath);
  if (!pid) {
    return { ...paths, stopped: false };
  }
  if (isRunning(pid)) {
    process.kill(pid, "SIGTERM");
  }
  await rm(paths.pidPath, { force: true });
  return { ...paths, stopped: true, pid };
}

export async function statusGateway(options: { port?: number } = {}): Promise<GatewayStatusResult> {
  const paths = gatewayPaths();
  const pid = await readPid(paths.pidPath);
  const running = Boolean(pid && isRunning(pid));
  const gatewayHealth = await health(`http://127.0.0.1:${options.port ?? 80}`);
  return {
    ...paths,
    running: running || Boolean(gatewayHealth),
    pid: pid ?? undefined,
    health: gatewayHealth ?? undefined,
  };
}
