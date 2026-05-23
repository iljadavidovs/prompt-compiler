import { openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

export interface DaemonPaths {
  pidPath: string;
  logPath: string;
}

export interface DaemonStartResult extends DaemonPaths {
  started: boolean;
  pid?: number;
  url: string;
}

export interface DaemonStopResult extends DaemonPaths {
  stopped: boolean;
  pid?: number;
}

export interface DaemonStatusResult extends DaemonPaths {
  running: boolean;
  pid?: number;
  health?: unknown;
}

function pcrHome(): string {
  return process.env.PCR_USER_DIR ?? join(homedir(), ".pcr");
}

export function daemonPaths(): DaemonPaths {
  const base = pcrHome();
  return {
    pidPath: join(base, "pcrd.pid"),
    logPath: join(base, "pcrd.log"),
  };
}

async function readPid(pidPath: string): Promise<number | null> {
  try {
    const raw = await readFile(pidPath, "utf8");
    const pid = Number(raw.trim());
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

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await health(url)) {
      return true;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  return false;
}

export async function startDaemon(options: { cwd?: string; port?: number } = {}): Promise<DaemonStartResult> {
  const paths = daemonPaths();
  const port = options.port ?? 4317;
  const url = `http://127.0.0.1:${port}`;
  await mkdir(dirname(paths.pidPath), { recursive: true });

  const existingPid = await readPid(paths.pidPath);
  if (existingPid && isRunning(existingPid) && await health(url)) {
    return { ...paths, started: false, pid: existingPid, url };
  }

  const out = openSync(paths.logPath, "a");
  const child = spawn(process.execPath, [resolve(new URL("./bin.js", import.meta.url).pathname), "serve", "--port", String(port)], {
    cwd: options.cwd ?? process.cwd(),
    detached: true,
    env: process.env,
    stdio: ["ignore", out, out],
  });
  child.unref();
  await writeFile(paths.pidPath, String(child.pid));
  await waitForHealth(url, 3000);
  return { ...paths, started: true, pid: child.pid, url };
}

export async function stopDaemon(): Promise<DaemonStopResult> {
  const paths = daemonPaths();
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

export async function statusDaemon(options: { port?: number } = {}): Promise<DaemonStatusResult> {
  const paths = daemonPaths();
  const pid = await readPid(paths.pidPath);
  const running = Boolean(pid && isRunning(pid));
  const daemonHealth = await health(`http://127.0.0.1:${options.port ?? 4317}`);
  return {
    ...paths,
    running: running || Boolean(daemonHealth),
    pid: pid ?? undefined,
    health: daemonHealth ?? undefined,
  };
}
